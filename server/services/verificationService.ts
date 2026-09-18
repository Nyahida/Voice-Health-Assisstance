import { db } from '../db/database.js';
import { 
  Appointment, 
  IntegrationVerification, 
  ReconciliationRecord,
  IntegrationMode 
} from '../types/entities.js';
import { ehrConnector, mockEhr } from './ehrService.js';
import { v4 as uuidv4 } from 'uuid';

export interface VerificationResult {
  success: boolean;
  appointment: Appointment;
  externalAppointmentId?: string;
  verification?: IntegrationVerification;
  reconciliationRecord?: ReconciliationRecord;
  error?: string;
  failureModeEncountered?: IntegrationMode;
  recoveryNote?: string;
}

export class VerificationService {
  /**
   * Orchestrates the complete booking, external submission, verification, and recovery chain:
   * Create -> External Response -> Verify External Record -> Synchronize State -> Confirm (PRD Section 13).
   */
  public async processAndVerifyAppointment(
    appointment: Appointment,
    correlationId: string,
    modeOverride?: IntegrationMode
  ): Promise<VerificationResult> {
    const platform = db.getPlatformConfig();
    const maxRetries = platform.globalMaxRetries || 3;

    let attempts = 0;
    let externalAppointmentId: string | undefined;
    let lastError: string | undefined;
    let recoveryNote: string | undefined;

    // Step 1: Submit to EHR (Attempt 1)
    attempts++;
    let { operation, response } = await ehrConnector.submitAppointmentToEhr(appointment, correlationId, modeOverride);

    // ========================================================
    // CASE 1: TRANSIENT TIMEOUT (Option A Demonstration)
    // ========================================================
    if (!response.success && response.errorType === 'TIMEOUT' && response.retryable) {
      recoveryNote = `EHR Gateway Timeout encountered on attempt 1. Classified as retryable failure. Retrying operation...`;
      console.log(`[Verification] ⚠️ ${recoveryNote}`);

      // Perform retry
      while (attempts < maxRetries && !response.success) {
        attempts++;
        operation.attemptCount = attempts;
        console.log(`[Verification] 🔄 Executing retry attempt ${attempts}/${maxRetries} for correlation ${correlationId}`);

        const retryRes = await ehrConnector.submitAppointmentToEhr(appointment, correlationId, modeOverride);
        operation = retryRes.operation;
        response = retryRes.response;

        if (response.success) {
          externalAppointmentId = response.externalAppointmentId;
          recoveryNote = `Option A Recovery Successful: EHR responded with ${externalAppointmentId} on retry attempt ${attempts}.`;
          console.log(`[Verification] ✅ ${recoveryNote}`);
          break;
        }
      }
    }

    // ========================================================
    // CASE 2: UNKNOWN OUTCOME / NETWORK DROP (Option B Demonstration)
    // ========================================================
    else if (!response.success && response.errorType === 'UNKNOWN_OUTCOME') {
      recoveryNote = `Network connection dropped during response (Unknown Outcome). System paused blind retry to prevent duplicate appointment. Actively querying EHR status...`;
      console.log(`[Verification] ⚠️ ${recoveryNote}`);

      // Query EHR to see if appointment was actually created
      const discovered = mockEhr.findByIdempotencyToken(appointment.idempotencyKey);
      if (discovered) {
        externalAppointmentId = discovered.externalId;
        recoveryNote = `Option B Recovery Successful: Appointment was verified in EHR database (${externalAppointmentId}) despite network drop. Synchronized state without duplicate creation!`;
        console.log(`[Verification] ✅ ${recoveryNote}`);
        response = {
          success: true,
          externalAppointmentId: discovered.externalId,
          status: discovered.status
        };
      } else {
        lastError = 'EHR state queried, appointment not found in external system.';
      }
    }

    // Direct success on attempt 1
    if (response.success && response.externalAppointmentId) {
      externalAppointmentId = response.externalAppointmentId;
    } else {
      lastError = response.error || lastError || 'EHR operation failed';
    }

    // ========================================================
    // CASE 3: UNRECOVERABLE FAILURE (Option C Demonstration)
    // ========================================================
    if (!externalAppointmentId) {
      console.warn(`[Verification] ❌ Unrecoverable failure for appointment ${appointment.id}: ${lastError}`);

      // Release slot so calendar isn't indefinitely locked
      db.markSlotAvailable(appointment.slotId);

      appointment.status = 'Reconciliation Required';
      appointment.verificationStatus = 'Failed';
      appointment.notes = lastError;
      appointment.statusHistory.push({
        status: 'Reconciliation Required',
        timestamp: new Date().toISOString(),
        changedBy: 'VerificationService',
        reason: `EHR failure: ${lastError}`
      });
      db.saveAppointment(appointment);

      // Create Reconciliation Record (PRD Section 13 & 28)
      const recRecord: ReconciliationRecord = {
        id: `rec-${uuidv4().substring(0, 8)}`,
        correlationId,
        hospitalId: appointment.hospitalId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        reason: lastError || 'Unknown external failure',
        failureType: 'UNRECOVERABLE_EHR_ERROR',
        recommendedAction: 'Operational escalation: Clinical staff to contact patient or manually verify EHR availability',
        isResolved: false,
        createdAt: new Date().toISOString()
      };
      db.addReconciliationRecord(recRecord);

      // Log Audit Event
      db.logAuditEvent({
        id: `audit-${uuidv4().substring(0, 8)}`,
        correlationId,
        hospitalId: appointment.hospitalId,
        actorRole: 'SYSTEM',
        actorId: 'VerificationService',
        action: 'RECONCILIATION_REQUIRED',
        entityType: 'Appointment',
        entityId: appointment.id,
        timestamp: new Date().toISOString(),
        details: { failureReason: lastError, attempts }
      });

      return {
        success: false,
        appointment,
        reconciliationRecord: recRecord,
        error: lastError,
        recoveryNote: 'Option C Triggered: Retries exhausted. Created reconciliation record and escalated to human operator.'
      };
    }

    // ========================================================
    // EXTERNAL VERIFICATION STEP (PRD Section 13: Verify External Record)
    // ========================================================
    const externalRecord = mockEhr.getAppointment(externalAppointmentId);
    const verifId = `verif-${uuidv4().substring(0, 8)}`;

    const isRecordValid = !!(
      externalRecord && 
      externalRecord.status === 'Booked' &&
      externalRecord.start === appointment.startTime
    );

    const verif: IntegrationVerification = {
      id: verifId,
      correlationId,
      appointmentId: appointment.id,
      externalAppointmentId,
      status: isRecordValid ? 'Verified' : 'Discrepancy',
      externalRecordFound: !!externalRecord,
      matchesInternalSlot: isRecordValid,
      discrepancies: isRecordValid ? [] : ['External record timeslot or status mismatch'],
      verifiedAt: new Date().toISOString()
    };
    db.logVerification(verif);

    if (!isRecordValid) {
      appointment.status = 'Synchronization Pending';
      appointment.verificationStatus = 'Discrepancy';
      db.saveAppointment(appointment);

      return {
        success: false,
        appointment,
        externalAppointmentId,
        verification: verif,
        error: 'External verification detected discrepancy with EHR record'
      };
    }

    // ========================================================
    // STATE SYNCHRONIZATION & CONFIRMATION TO PATIENT
    // ========================================================
    appointment.status = 'Confirmed';
    appointment.externalAppointmentId = externalAppointmentId;
    appointment.verificationStatus = 'Verified';
    appointment.statusHistory.push({
      status: 'Confirmed',
      timestamp: new Date().toISOString(),
      changedBy: 'VerificationService',
      reason: `Verified against external record ${externalAppointmentId}`
    });
    db.saveAppointment(appointment);

    // Release reservation lock and confirm slot booking
    db.markSlotBooked(appointment.slotId, appointment.id);

    // Log Successful Audit
    db.logAuditEvent({
      id: `audit-${uuidv4().substring(0, 8)}`,
      correlationId,
      hospitalId: appointment.hospitalId,
      actorRole: 'SYSTEM',
      actorId: 'VerificationService',
      action: 'APPOINTMENT_CONFIRMED',
      entityType: 'Appointment',
      entityId: appointment.id,
      timestamp: new Date().toISOString(),
      details: {
        externalAppointmentId,
        verifiedAt: verif.verifiedAt,
        attempts
      }
    });

    return {
      success: true,
      appointment,
      externalAppointmentId,
      verification: verif,
      recoveryNote
    };
  }
}

export const verificationService = new VerificationService();
