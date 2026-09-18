import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { schedulingService } from '../services/schedulingService.js';
import { capabilitiesService } from '../services/capabilitiesService.js';
import { aiAgentService } from '../services/aiAgentService.js';
import { workflowService } from '../services/workflowService.js';
import { v4 as uuidv4 } from 'uuid';
import { IntegrationMode, UserRole } from '../types/entities.js';
const param = (value: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export const apiRouter = Router();

// ==========================================
// 1. SYSTEM HEALTH & PLATFORM METRICS
// ==========================================
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

apiRouter.get('/platform/config', (req: Request, res: Response) => {
  res.json(db.getPlatformConfig());
});

apiRouter.patch('/platform/config', (req: Request, res: Response) => {
  const updated = db.updatePlatformConfig(req.body);
  res.json(updated);
});

apiRouter.get('/metrics', (req: Request, res: Response) => {
  const appts = db.getAppointments();
  const confirmed = appts.filter(a => a.status === 'Confirmed').length;
  const reconciliations = db.getReconciliationRecords();
  const evals = db.getAiEvaluations();
  const avgLatency = evals.length > 0 
    ? Math.round(evals.reduce((acc, e) => acc + e.latencyMs, 0) / evals.length) 
    : 420;

  res.json({
    totalAppointments: appts.length,
    confirmedAppointments: confirmed,
    reconciliationsRequired: reconciliations.filter(r => !r.isResolved).length,
    averageAiLatencyMs: avgLatency,
    activeHospitals: db.getHospitals('Approved').length,
    activeDoctors: db.getDoctors().filter(d => d.status === 'Active').length,
    totalWorkflows: db.getWorkflows().length,
    auditEventsCount: db.getAuditEvents().length
  });
});

apiRouter.get('/traces/:correlationId', (req: Request, res: Response) => {
  const trace = db.getTrace(param(req.params.correlationId));
  res.json(trace);
});

apiRouter.get('/audit-logs', (req: Request, res: Response) => {
  const hospitalId = req.query.hospitalId as string | undefined;
  res.json(db.getAuditEvents(hospitalId));
});

apiRouter.get('/ai/evaluations', (req: Request, res: Response) => {
  res.json(db.getAiEvaluations());
});

// ==========================================
// 2. HOSPITALS (Multi-tenant)
// ==========================================
apiRouter.get('/hospitals', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  res.json(db.getHospitals(status));
});

apiRouter.get('/hospitals/:id', (req: Request, res: Response) => {
  const hosp = db.getHospitalById(param(req.params.id) );
  if (!hosp) return res.status(404).json({ error: 'Hospital not found' });
  res.json(hosp);
});

apiRouter.post('/hospitals', (req: Request, res: Response) => {
  const newHospital = {
    id: `hosp-${uuidv4().substring(0, 6)}`,
    ...req.body,
    status: 'Submitted', // Requires platform admin approval (PRD Section 5)
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const created = db.createHospital(newHospital);

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'HospitalAdmin',
    actorId: req.body.contactEmail || 'admin',
    action: 'HOSPITAL_REGISTERED',
    entityType: 'Hospital',
    entityId: created.id,
    details: { name: created.name },
    timestamp: new Date().toISOString()
  });

  res.status(201).json(created);
});

apiRouter.patch('/hospitals/:id/status', (req: Request, res: Response) => {
  const { status, reason } = req.body;
  const updated = db.updateHospital(param(req.params.id), { 
    status, 
    rejectionReason: reason 
  });
  if (!updated) return res.status(404).json({ error: 'Hospital not found' });

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'PlatformAdmin',
    actorId: 'platform-admin',
    action: `HOSPITAL_STATUS_${status.toUpperCase()}`,
    entityType: 'Hospital',
    entityId: updated.id,
    details: { status, reason },
    timestamp: new Date().toISOString()
  });

  res.json(updated);
});

apiRouter.patch('/hospitals/:id/failure-mode', (req: Request, res: Response) => {
  const { mode } = req.body; // 'NORMAL' | 'OPTION_A_TIMEOUT_RETRY' | 'OPTION_B_UNKNOWN_OUTCOME' | 'OPTION_C_UNRECOVERABLE'
  db.setHospitalFailureMode(param(req.params.id), mode as IntegrationMode);
  res.json({ success: true, hospitalId: param(req.params.id), mode });
});

// ==========================================
// 3. DOCTORS & CALENDARS
// ==========================================
apiRouter.get('/doctors', (req: Request, res: Response) => {
  const hospitalId = req.query.hospitalId as string | undefined;
  res.json(db.getDoctors(hospitalId));
});

apiRouter.get('/doctors/:id', (req: Request, res: Response) => {
  const doc = db.getDoctorById(param(req.params.id) );
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  res.json(doc);
});

apiRouter.get('/doctors/:id/calendar', (req: Request, res: Response) => {
  const cal = db.getDoctorCalendar(param(req.params.id));
  const blocked = db.getBlockedSlots(param(req.params.id) );
  res.json({ calendar: cal, blockedSlots: blocked });
});

apiRouter.post('/doctors/:id/blocked-slots', (req: Request, res: Response) => {
  const doc = db.getDoctorById(param(req.params.id) );
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });

  const blocked = db.addBlockedSlot({
    id: `block-${uuidv4().substring(0, 8)}`,
    doctorId: param(req.params.id) ,
    hospitalId: doc.hospitalId,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    reason: req.body.reason || 'Doctor blocked time',
    createdAt: new Date().toISOString()
  });

  res.status(201).json(blocked);
});

apiRouter.delete('/doctors/blocked-slots/:id', (req: Request, res: Response) => {
  const deleted = db.deleteBlockedSlot(param(req.params.id) );
  res.json({ success: deleted });
});

// ==========================================
// 4. SCHEDULING & REAL AVAILABILITY (Zero invented slots)
// ==========================================
apiRouter.get('/scheduling/slots', (req: Request, res: Response) => {
  const { doctorId, hospitalId, specialty, startDate, endDate } = req.query;
  const slots = schedulingService.getAvailableSlots({
    doctorId: doctorId as string,
    hospitalId: hospitalId as string,
    specialty: specialty as string,
    startDate: startDate as string,
    endDate: endDate as string
  });
  res.json(slots);
});

apiRouter.post('/scheduling/reserve', (req: Request, res: Response) => {
  const { slotId, patientId } = req.body;
  const result = schedulingService.reserveSlot(slotId, patientId);
  if (!result.success) {
    return res.status(409).json(result);
  }
  res.json(result);
});

apiRouter.post('/scheduling/release', (req: Request, res: Response) => {
  const { slotId } = req.body;
  schedulingService.releaseReservation(slotId);
  res.json({ success: true });
});

// ==========================================
// 5. APPOINTMENTS & RECONCILIATION
// ==========================================
apiRouter.get('/appointments', (req: Request, res: Response) => {
  const { hospitalId, doctorId, patientId } = req.query;
  res.json(db.getAppointments(hospitalId as string, doctorId as string, patientId as string));
});

apiRouter.get('/appointments/:id', (req: Request, res: Response) => {
  const appt = db.getAppointmentById(param(req.params.id) );
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  res.json(appt);
});

apiRouter.post('/appointments', async (req: Request, res: Response) => {
  const { slotId, patientId, reason, consultationType, modeOverride } = req.body;
  const correlationId = req.headers['x-correlation-id'] as string || `corr-${uuidv4().substring(0, 8)}`;

  const result = await capabilitiesService.executeCapability('create_appointment', {
    slotId,
    patientId,
    reason: reason || 'Scheduled Consultation',
    consultationType: consultationType || 'in-person',
    modeOverride
  }, correlationId, patientId, 'Patient');

  if (!result.success || !result.result?.success) {
    return res.status(400).json(result);
  }

  // Trigger workflow
  if (result.result?.appointment) {
    await workflowService.triggerEvent(
      'APPOINTMENT_VERIFIED',
      'Appointment',
      result.result.appointment.id,
      correlationId
    );
  }

  res.status(201).json(result.result);
});

apiRouter.post('/appointments/:id/reschedule', async (req: Request, res: Response) => {
  const { newSlotId, reason } = req.body;
  const correlationId = `corr-${uuidv4().substring(0, 8)}`;
  const result = await capabilitiesService.executeCapability('reschedule_appointment', {
    appointmentId: param(req.params.id) ,
    newSlotId,
    reason
  }, correlationId, 'patient', 'Patient');

  res.json(result);
});

apiRouter.post('/appointments/:id/cancel', async (req: Request, res: Response) => {
  const { reason } = req.body;
  const correlationId = `corr-${uuidv4().substring(0, 8)}`;
  const result = await capabilitiesService.executeCapability('cancel_appointment', {
    appointmentId: param(req.params.id) ,
    reason: reason || 'Patient cancelled'
  }, correlationId, 'patient', 'Patient');

  if (result.success) {
    await workflowService.triggerEvent(
      'APPOINTMENT_CANCELLED',
      'Appointment',
      param(req.params.id) ,
      correlationId
    );
  }

  res.json(result);
});

apiRouter.get('/reconciliation', (req: Request, res: Response) => {
  const hospitalId = req.query.hospitalId as string | undefined;
  res.json(db.getReconciliationRecords(hospitalId));
});

apiRouter.post('/reconciliation/:id/resolve', (req: Request, res: Response) => {
  const { resolvedBy } = req.body;
  const resolved = db.resolveReconciliation(param(req.params.id) , resolvedBy || 'Clinical Staff');
  res.json({ success: resolved });
});

// ==========================================
// 6. QUESTIONNAIRES & RESPONSES
// ==========================================
apiRouter.get('/questionnaires', (req: Request, res: Response) => {
  const hospitalId = req.query.hospitalId as string | undefined;
  res.json(db.getQuestionnaires(hospitalId));
});

apiRouter.get('/questionnaire-responses', (req: Request, res: Response) => {
  const { appointmentId, doctorId } = req.query;
  res.json(db.getQuestionnaireResponses(appointmentId as string, doctorId as string));
});

apiRouter.post('/questionnaire-responses', async (req: Request, res: Response) => {
  const { questionnaireId, appointmentId, answers, collectedVia } = req.body;
  const correlationId = `corr-${uuidv4().substring(0, 8)}`;
  const result = await capabilitiesService.executeCapability('submit_questionnaire', {
    questionnaireId,
    appointmentId,
    answers,
    collectedVia: collectedVia || 'web_form'
  }, correlationId, 'patient', 'Patient');

  if (result.success) {
    await workflowService.triggerEvent(
      'QUESTIONNAIRE_COMPLETED',
      'Appointment',
      appointmentId,
      correlationId
    );
  }

  res.json(result);
});

// ==========================================
// 7. PATIENTS & CONTEXT
// ==========================================
apiRouter.get('/patients', (req: Request, res: Response) => {
  res.json(db.getPatients());
});

apiRouter.get('/patients/:id', (req: Request, res: Response) => {
  const pat = db.getPatientById(param(req.params.id) );
  if (!pat) return res.status(404).json({ error: 'Patient not found' });
  res.json(pat);
});

apiRouter.get('/patients/:id/context', (req: Request, res: Response) => {
  res.json(db.getUserContext(param(req.params.id) ));
});

// ==========================================
// 8. WORKFLOWS & NOTIFICATIONS
// ==========================================
apiRouter.get('/workflows', (req: Request, res: Response) => {
  res.json(db.getWorkflows());
});

apiRouter.get('/notifications', (req: Request, res: Response) => {
  const { recipientType, recipientId } = req.query;
  res.json(db.getNotifications(recipientType as string, recipientId as string));
});

// ==========================================
// 9. AI CONVERSATIONAL PATIENT AGENT
// ==========================================
apiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  const { conversationId, patientId, message, channel, correlationId, modeOverride } = req.body;
  const result = await aiAgentService.processPatientTurn({
    conversationId,
    patientId: patientId || 'pat-1',
    channel: channel || 'web_voice',
    message,
    correlationId,
    modeOverride
  });

  res.json(result);
});

// ==========================================
// 10. DEPARTMENTS CRUD
// ==========================================
apiRouter.get('/departments', (req: Request, res: Response) => {
  const hospitalId = req.query.hospitalId as string | undefined;
  res.json(db.getDepartments(hospitalId));
});

apiRouter.get('/departments/:id', (req: Request, res: Response) => {
  const dept = db.getDepartmentById(param(req.params.id) );
  if (!dept) return res.status(404).json({ error: 'Department not found' });
  res.json(dept);
});

apiRouter.post('/departments', (req: Request, res: Response) => {
  const dept = {
    id: `dept-${uuidv4().substring(0, 8)}`,
    ...req.body
  };
  const created = db.createDepartment(dept);

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'HospitalAdmin',
    actorId: 'admin',
    action: 'DEPARTMENT_CREATED',
    entityType: 'Department',
    entityId: created.id,
    details: { name: created.name },
    timestamp: new Date().toISOString()
  });

  res.status(201).json(created);
});

apiRouter.patch('/departments/:id', (req: Request, res: Response) => {
  const updated = db.updateDepartment(param(req.params.id) , req.body);
  if (!updated) return res.status(404).json({ error: 'Department not found' });

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'HospitalAdmin',
    actorId: 'admin',
    action: 'DEPARTMENT_UPDATED',
    entityType: 'Department',
    entityId: param(req.params.id) ,
    details: req.body,
    timestamp: new Date().toISOString()
  });

  res.json(updated);
});

apiRouter.delete('/departments/:id', (req: Request, res: Response) => {
  const deleted = db.deleteDepartment(param(req.params.id) );

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'HospitalAdmin',
    actorId: 'admin',
    action: 'DEPARTMENT_DELETED',
    entityType: 'Department',
    entityId: param(req.params.id)  ,
    details: {},
    timestamp: new Date().toISOString()
  });

  res.json({ success: deleted });
});

// ==========================================
// 11. DOCTOR CRUD (create, update, delete)
// ==========================================
apiRouter.post('/doctors', (req: Request, res: Response) => {
  const doctor = {
    id: `doc-${uuidv4().substring(0, 8)}`,
    ...req.body,
    createdAt: new Date().toISOString()
  };
  const created = db.createDoctor(doctor);

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'HospitalAdmin',
    actorId: 'admin',
    action: 'DOCTOR_CREATED',
    entityType: 'Doctor',
    entityId: created.id,
    details: { name: created.name, specialty: created.specialty },
    hospitalId: created.hospitalId,
    timestamp: new Date().toISOString()
  });

  res.status(201).json(created);
});

apiRouter.patch('/doctors/:id', (req: Request, res: Response) => {
  const updated = db.updateDoctor(param(req.params.id)  , req.body);
  if (!updated) return res.status(404).json({ error: 'Doctor not found' });

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'HospitalAdmin',
    actorId: 'admin',
    action: 'DOCTOR_UPDATED',
    entityType: 'Doctor',
    entityId: param(req.params.id)  ,
    details: req.body,
    hospitalId: updated.hospitalId,
    timestamp: new Date().toISOString()
  });

  res.json(updated);
});

apiRouter.delete('/doctors/:id', (req: Request, res: Response) => {
  const doc = db.getDoctorById(param(req.params.id)  );
  const deleted = db.deleteDoctor(param(req.params.id) );

  if (doc) {
    db.logAuditEvent({
      id: `audit-${uuidv4().substring(0, 8)}`,
      actorRole: 'HospitalAdmin',
      actorId: 'admin',
      action: 'DOCTOR_REMOVED',
      entityType: 'Doctor',
      entityId: param(req.params.id)  ,
      details: { name: doc.name },
      hospitalId: doc.hospitalId,
      timestamp: new Date().toISOString()
    });
  }

  res.json({ success: deleted });
});

// ==========================================
// 12. APPOINTMENT STATUS UPDATE
// ==========================================
apiRouter.patch('/appointments/:id/status', (req: Request, res: Response) => {
  const { status, reason } = req.body;
  const updated = db.updateAppointmentStatus(param(req.params.id)  , status, reason);
  if (!updated) return res.status(404).json({ error: 'Appointment not found' });

  db.logAuditEvent({
    id: `audit-${uuidv4().substring(0, 8)}`,
    actorRole: 'HospitalAdmin',
    actorId: 'admin',
    action: `APPOINTMENT_STATUS_${status.toUpperCase()}`,
    entityType: 'Appointment',
    entityId: param(req.params.id) ,
    details: { status, reason },
    timestamp: new Date().toISOString()
  });

  res.json(updated);
});

