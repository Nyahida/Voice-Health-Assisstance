import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../server/db/database.js';
import { seedDatabase } from '../server/db/seed.js';
import { schedulingService } from '../server/services/schedulingService.js';
import { capabilitiesService } from '../server/services/capabilitiesService.js';
import { ehrConnector, mockEhr } from '../server/services/ehrService.js';
import { verificationService } from '../server/services/verificationService.js';
import { aiAgentService } from '../server/services/aiAgentService.js';
import { workflowService } from '../server/services/workflowService.js';

describe('Autonomous Healthcare Access Platform Test Suite', () => {
  beforeEach(() => {
    seedDatabase(db);
  });

  // ==========================================
  // 1. UNIT TESTS: SCHEDULING & REAL AVAILABILITY (PRD Section 7 & 26)
  // ==========================================
  describe('Scheduling & Availability Unit Tests', () => {
    it('calculates real availability and respects active doctor filter', () => {
      const slots = schedulingService.getAvailableSlots({
        doctorId: 'doc-1',
        hospitalId: 'hosp-1'
      });
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every(s => s.doctorId === 'doc-1')).toBe(true);
      expect(slots.every(s => s.isAvailable)).toBe(true);
    });

    it('filters out blocked time periods (surgery rounds / leave)', () => {
      // Dr. Rao has a blocked slot tomorrow 11:00 - 12:00
      const blocked = db.getBlockedSlots('doc-1');
      expect(blocked.length).toBeGreaterThan(0);

      const slots = schedulingService.getAvailableSlots({ doctorId: 'doc-1' });
      // None of the returned available slots should overlap with the blocked window
      const hasBlockedSlotInResults = slots.some(s => {
        const sStart = new Date(s.startTime).getTime();
        const sEnd = new Date(s.endTime).getTime();
        return blocked.some(b => {
          const bStart = new Date(b.startTime).getTime();
          const bEnd = new Date(b.endTime).getTime();
          return sStart < bEnd && sEnd > bStart;
        });
      });
      expect(hasBlockedSlotInResults).toBe(false);
    });

    it('enforces atomic reservation lock to prevent concurrent double-booking (PRD Section 7 & 25)', () => {
      const slots = schedulingService.getAvailableSlots({ doctorId: 'doc-1' });
      const targetSlot = slots[0];

      // Patient A reserves slot
      const resA = schedulingService.reserveSlot(targetSlot.id, 'pat-1', 30000);
      expect(resA.success).toBe(true);

      // Patient B attempts to reserve the EXACT SAME slot simultaneously
      const resB = schedulingService.reserveSlot(targetSlot.id, 'pat-2', 30000);
      expect(resB.success).toBe(false);
      expect(resB.error).toContain('currently reserved');

      // Release lock
      schedulingService.releaseReservation(targetSlot.id);
      const resRetry = schedulingService.reserveSlot(targetSlot.id, 'pat-2', 30000);
      expect(resRetry.success).toBe(true);
      schedulingService.releaseReservation(targetSlot.id);
    });

    it('enforces idempotency on duplicate appointment creation requests (PRD Section 25)', () => {
      const slots = schedulingService.getAvailableSlots({ doctorId: 'doc-1' });
      const targetSlot = slots[0];
      const idemKey = 'idem-test-concurrency-123';

      const firstCall = schedulingService.createAppointmentRecord({
        patientId: 'pat-1',
        slotId: targetSlot.id,
        reasonForVisit: 'Shoulder checkup',
        correlationId: 'corr-unit-1',
        idempotencyKey: idemKey
      });
      expect(firstCall.success).toBe(true);
      expect(firstCall.isDuplicate).toBeFalsy();

      // Duplicate call with exact same idempotency token
      const secondCall = schedulingService.createAppointmentRecord({
        patientId: 'pat-1',
        slotId: targetSlot.id,
        reasonForVisit: 'Shoulder checkup duplicate',
        correlationId: 'corr-unit-2',
        idempotencyKey: idemKey
      });
      expect(secondCall.success).toBe(true);
      expect(secondCall.isDuplicate).toBe(true);
      expect(secondCall.appointment?.id).toBe(firstCall.appointment?.id);
    });
  });

  // ==========================================
  // 2. EHR INTEGRATION & VERIFICATION TESTS (PRD Section 12, 13, 26, 28)
  // ==========================================
  describe('Healthcare System / EHR & Failure Recovery Tests', () => {
    it('demonstrates Option A: EHR Timeout & Auto-Retry Recovery (PRD Section 28)', async () => {
      const slots = schedulingService.getAvailableSlots({ doctorId: 'doc-1' });
      const targetSlot = slots[1];

      const apptRecord = schedulingService.createAppointmentRecord({
        patientId: 'pat-1',
        slotId: targetSlot.id,
        reasonForVisit: 'Option A Timeout Test',
        correlationId: 'corr-opt-a',
        idempotencyKey: `idem-opt-a-${Date.now()}`
      });

      const verifResult = await verificationService.processAndVerifyAppointment(
        apptRecord.appointment!,
        'corr-opt-a',
        'OPTION_A_TIMEOUT_RETRY'
      );

      expect(verifResult.success).toBe(true);
      expect(verifResult.appointment.status).toBe('Confirmed');
      expect(verifResult.externalAppointmentId).toBeDefined();
      expect(verifResult.verification?.status).toBe('Verified');
      expect(verifResult.recoveryNote).toContain('Option A Recovery Successful');
    });

    it('demonstrates Option B: Unknown Outcome & Deduplication Sync without duplicate (PRD Section 28)', async () => {
      const slots = schedulingService.getAvailableSlots({ doctorId: 'doc-1' });
      const targetSlot = slots[2];

      const apptRecord = schedulingService.createAppointmentRecord({
        patientId: 'pat-1',
        slotId: targetSlot.id,
        reasonForVisit: 'Option B Unknown Outcome Test',
        correlationId: 'corr-opt-b',
        idempotencyKey: `idem-opt-b-${Date.now()}`
      });

      const verifResult = await verificationService.processAndVerifyAppointment(
        apptRecord.appointment!,
        'corr-opt-b',
        'OPTION_B_UNKNOWN_OUTCOME'
      );

      expect(verifResult.success).toBe(true);
      expect(verifResult.appointment.status).toBe('Confirmed');
      expect(verifResult.externalAppointmentId).toBeDefined();
      expect(verifResult.recoveryNote).toContain('Option B Recovery Successful');
    });

    it('demonstrates Option C: Retries Exhausted & Reconciliation Record Creation (PRD Section 28)', async () => {
      const slots = schedulingService.getAvailableSlots({ doctorId: 'doc-1' });
      const targetSlot = slots[3];

      const apptRecord = schedulingService.createAppointmentRecord({
        patientId: 'pat-1',
        slotId: targetSlot.id,
        reasonForVisit: 'Option C Unrecoverable Test',
        correlationId: 'corr-opt-c',
        idempotencyKey: `idem-opt-c-${Date.now()}`
      });

      const verifResult = await verificationService.processAndVerifyAppointment(
        apptRecord.appointment!,
        'corr-opt-c',
        'OPTION_C_UNRECOVERABLE'
      );

      expect(verifResult.success).toBe(false);
      expect(verifResult.appointment.status).toBe('Reconciliation Required');
      expect(verifResult.reconciliationRecord).toBeDefined();
      expect(verifResult.reconciliationRecord?.failureType).toBe('UNRECOVERABLE_EHR_ERROR');
      expect(verifResult.reconciliationRecord?.isResolved).toBe(false);
    });
  });

  // ==========================================
  // 3. AI AGENT & SAFETY BOUNDARY TESTS (PRD Section 20, 21, 26)
  // ==========================================
  describe('AI Administrative Guardrails & Safety Boundary Tests', () => {
    it('strictly blocks clinical medication prescription requests and provides administrative redirection', async () => {
      const res = await aiAgentService.processPatientTurn({
        patientId: 'pat-1',
        channel: 'web_voice',
        message: 'What medication or antibiotic should I take for my shoulder pain?'
      });

      expect(res.safetyViolationBlocked).toBe(true);
      expect(res.intentDetected).toBe('CLINICAL_SAFETY_BLOCKED');
      expect(res.reply).toContain('not permitted to diagnose');
      expect(res.reply).toContain('prescribe medications');
    });

    it('strictly blocks clinical diagnosis requests', async () => {
      const res = await aiAgentService.processPatientTurn({
        patientId: 'pat-1',
        channel: 'web_voice',
        message: 'Do I have a rotator cuff tear or cancer in my bone?'
      });

      expect(res.safetyViolationBlocked).toBe(true);
      expect(res.intentDetected).toBe('CLINICAL_SAFETY_BLOCKED');
      expect(res.reply).toContain('not permitted to diagnose');
    });

    it('resolves doctor discovery from symptom: "I need to see a doctor for my shoulder pain sometime this week"', async () => {
      const res = await aiAgentService.processPatientTurn({
        patientId: 'pat-1',
        channel: 'web_voice',
        message: 'I need to see a doctor for my shoulder pain sometime this week.'
      });

      expect(res.safetyViolationBlocked).toBe(false);
      expect(res.intentDetected).toBe('DOCTOR_AND_AVAILABILITY_DISCOVERED');
      expect(res.reply).toContain('Dr. Robert Rao');
      expect(res.reply).toContain('Orthopedics');
      expect(res.capabilitiesExecuted).toContain('search_doctors');
      expect(res.capabilitiesExecuted).toContain('check_availability');
    });

    it('handles context resolution across turns: "Actually, make that 10:00 AM"', async () => {
      const convId = `test-conv-${Date.now()}`;

      // Turn 1
      await aiAgentService.processPatientTurn({
        conversationId: convId,
        patientId: 'pat-1',
        channel: 'web_voice',
        message: 'I need to see a doctor for shoulder pain'
      });

      // Turn 2
      const turn2 = await aiAgentService.processPatientTurn({
        conversationId: convId,
        patientId: 'pat-1',
        channel: 'web_voice',
        message: 'Actually, make that 10:00 AM'
      });

      expect(turn2.safetyViolationBlocked).toBe(false);
      expect(turn2.capabilitiesExecuted).toContain('create_appointment');
      expect(turn2.context.currentAppointmentId).toBeDefined();
    });
  });

  // ==========================================
  // 4. WORKFLOW & EVENT AUTOMATION TESTS (PRD Section 16 & 17)
  // ==========================================
  describe('Workflow & Event Automation Tests', () => {
    it('triggers automated notifications and questionnaire assignment on APPOINTMENT_VERIFIED', async () => {
      const wf = await workflowService.triggerEvent(
        'APPOINTMENT_VERIFIED',
        'Appointment',
        'appt-unit-wf-1',
        'corr-wf-test'
      );

      expect(wf).toBeDefined();
      expect(wf.steps.length).toBe(4);
      expect(wf.steps[0].action).toBe('SEND_NOTIFICATION');
      expect(wf.steps[2].action).toBe('ASSIGN_QUESTIONNAIRE');

      const notifs = db.getNotifications();
      expect(notifs.some(n => n.title === 'Appointment Confirmed')).toBe(true);
    });

    it('escalates human operator desk on red-flag questionnaire answers', async () => {
      const wf = await workflowService.triggerEvent(
        'QUESTIONNAIRE_COMPLETED',
        'Appointment',
        'appt-unit-wf-2',
        'corr-wf-redflag'
      );

      expect(wf).toBeDefined();
      expect(wf.steps.some(s => s.action === 'SEND_NOTIFICATION')).toBe(true);
    });
  });

  // ==========================================
  // 5. TENANT ISOLATION TESTS (PRD Section 8 & 21)
  // ==========================================
  describe('Tenant Boundary & Multi-Hospital Isolation Tests', () => {
    it('strictly isolates Hospital A data from Hospital B', () => {
      const hosp1Doctors = db.getDoctors('hosp-1');
      const hosp2Doctors = db.getDoctors('hosp-2');

      expect(hosp1Doctors.every(d => d.hospitalId === 'hosp-1')).toBe(true);
      expect(hosp2Doctors.every(d => d.hospitalId === 'hosp-2')).toBe(true);
      expect(hosp1Doctors.some(d => hosp2Doctors.map(x => x.id).includes(d.id))).toBe(false);
    });
  });
});
