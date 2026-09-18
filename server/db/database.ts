import fs from 'fs';
import path from 'path';
import {
  PlatformConfig,
  Hospital,
  Doctor,
  Department,
  Specialty,
  HospitalAdmin,
  HealthConcern,
  DoctorCalendar,
  BlockedSlot,
  TimeSlot,
  Patient,
  UserContext,
  Appointment,
  Questionnaire,
  QuestionnaireResponse,
  AIConversation,
  AIContext,
  CapabilityExecution,
  HealthcareSystemConnection,
  ExternalIdentifierMapping,
  IntegrationOperation,
  IntegrationVerification,
  ReconciliationRecord,
  WorkflowExecution,
  Notification,
  AuditEvent,
  AIEvaluationRecord,
  IntegrationMode
} from '../types/entities.js';

interface DatabaseSchema {
  platform: PlatformConfig;
  hospitals: Hospital[];
  departments: Department[];
  specialties: Specialty[];
  hospitalAdmins: HospitalAdmin[];
  doctors: Doctor[];
  calendars: DoctorCalendar[];
  blockedSlots: BlockedSlot[];
  slots: TimeSlot[];
  patients: Patient[];
  userContexts: UserContext[];
  healthConcerns: HealthConcern[];
  appointments: Appointment[];
  questionnaires: Questionnaire[];
  questionnaireResponses: QuestionnaireResponse[];
  conversations: AIConversation[];
  aiContexts: AIContext[];
  capabilityExecutions: CapabilityExecution[];
  connections: HealthcareSystemConnection[];
  identifierMappings: ExternalIdentifierMapping[];
  integrationOperations: IntegrationOperation[];
  verifications: IntegrationVerification[];
  reconciliationRecords: ReconciliationRecord[];
  workflows: WorkflowExecution[];
  notifications: Notification[];
  auditEvents: AuditEvent[];
  aiEvaluations: AIEvaluationRecord[];
}

export class Database {
  private data: DatabaseSchema;
  private filePath: string;
  private slotLocks: Map<string, { patientId: string; expiresAt: number }> = new Map();

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'db.json');
    this.data = this.loadInitialData();
  }

  private loadInitialData(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...this.createEmptySchema(),
          ...parsed
        };
      }
    } catch (e) {
      console.warn('Could not read existing db.json, initializing fresh store');
    }

    return this.createEmptySchema();
  }

  private createEmptySchema(): DatabaseSchema {
    return {
      platform: {
        id: 'platform-1',
        name: 'OmniHealth AI Platform',
        version: '2.0.0',
        globalMaxRetries: 3,
        verificationTimeoutMs: 3000,
        defaultEhrMode: 'NORMAL',
        aiGuardrailsActive: true,
        activeVoiceLanguage: 'en-US',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      hospitals: [],
      departments: [],
      specialties: [],
      hospitalAdmins: [],
      doctors: [],
      calendars: [],
      blockedSlots: [],
      slots: [],
      patients: [],
      userContexts: [],
      healthConcerns: [],
      appointments: [],
      questionnaires: [],
      questionnaireResponses: [],
      conversations: [],
      aiContexts: [],
      capabilityExecutions: [],
      connections: [],
      identifierMappings: [],
      integrationOperations: [],
      verifications: [],
      reconciliationRecords: [],
      workflows: [],
      notifications: [],
      auditEvents: [],
      aiEvaluations: []
    };
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist db.json:', e);
    }
  }

  // ==========================================
  // CONCURRENCY & ATOMIC LOCKING (Section 6 & 7)
  // ==========================================

  public acquireSlotLock(slotId: string, patientId: string, durationMs: number = 60000): boolean {
    const now = Date.now();
    const existing = this.slotLocks.get(slotId);

    if (existing && existing.expiresAt > now && existing.patientId !== patientId) {
      return false; // already locked by someone else
    }

    // Check if slot exists and is available
    const slot = this.data.slots.find(s => s.id === slotId);
    if (!slot || !slot.isAvailable) {
      return false;
    }

    // Acquire lock
    this.slotLocks.set(slotId, {
      patientId,
      expiresAt: now + durationMs
    });
    slot.reservationLockedUntil = now + durationMs;
    slot.reservedByPatientId = patientId;
    return true;
  }

  public releaseSlotLock(slotId: string): void {
    this.slotLocks.delete(slotId);
    const slot = this.data.slots.find(s => s.id === slotId);
    if (slot) {
      slot.reservationLockedUntil = undefined;
      slot.reservedByPatientId = undefined;
    }
  }

  public isSlotLocked(slotId: string): boolean {
    const now = Date.now();
    const existing = this.slotLocks.get(slotId);
    return !!(existing && existing.expiresAt > now);
  }

  // ==========================================
  // PLATFORM & HOSPITALS (Tenant boundaries)
  // ==========================================

  public getPlatformConfig(): PlatformConfig {
    return this.data.platform;
  }

  public updatePlatformConfig(updates: Partial<PlatformConfig>): PlatformConfig {
    this.data.platform = { ...this.data.platform, ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.platform;
  }

  public getHospitals(statusFilter?: string): Hospital[] {
    if (statusFilter) {
      return this.data.hospitals.filter(h => h.status === statusFilter);
    }
    return this.data.hospitals;
  }

  public getHospitalById(id: string): Hospital | undefined {
    return this.data.hospitals.find(h => h.id === id);
  }

  public createHospital(hospital: Hospital): Hospital {
    this.data.hospitals.push(hospital);
    this.save();
    return hospital;
  }

  public updateHospital(id: string, updates: Partial<Hospital>): Hospital | undefined {
    const index = this.data.hospitals.findIndex(h => h.id === id);
    if (index === -1) return undefined;
    this.data.hospitals[index] = { ...this.data.hospitals[index], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.hospitals[index];
  }

  // ==========================================
  // DOCTORS & CALENDARS (Tenant isolated)
  // ==========================================

  public getDoctors(hospitalId?: string): Doctor[] {
    if (hospitalId) {
      return this.data.doctors.filter(d => d.hospitalId === hospitalId);
    }
    return this.data.doctors;
  }

  public getDoctorById(id: string): Doctor | undefined {
    return this.data.doctors.find(d => d.id === id);
  }

  public createDoctor(doctor: Doctor): Doctor {
    this.data.doctors.push(doctor);
    this.save();
    return doctor;
  }

  public updateDoctor(id: string, updates: Partial<Doctor>): Doctor | undefined {
    const index = this.data.doctors.findIndex(d => d.id === id);
    if (index === -1) return undefined;
    this.data.doctors[index] = { ...this.data.doctors[index], ...updates };
    this.save();
    return this.data.doctors[index];
  }

  public getDoctorCalendar(doctorId: string): DoctorCalendar | undefined {
    return this.data.calendars.find(c => c.doctorId === doctorId && c.isActive);
  }

  public saveDoctorCalendar(calendar: DoctorCalendar): void {
    const idx = this.data.calendars.findIndex(c => c.doctorId === calendar.doctorId);
    if (idx >= 0) {
      this.data.calendars[idx] = calendar;
    } else {
      this.data.calendars.push(calendar);
    }
    this.save();
  }

  public getBlockedSlots(doctorId: string): BlockedSlot[] {
    return this.data.blockedSlots.filter(b => b.doctorId === doctorId);
  }

  public addBlockedSlot(blocked: BlockedSlot): BlockedSlot {
    this.data.blockedSlots.push(blocked);
    this.save();
    return blocked;
  }

  public deleteBlockedSlot(id: string): boolean {
    const initial = this.data.blockedSlots.length;
    this.data.blockedSlots = this.data.blockedSlots.filter(b => b.id !== id);
    if (this.data.blockedSlots.length !== initial) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // SLOTS & REAL AVAILABILITY
  // ==========================================

  public getSlots(doctorId?: string, hospitalId?: string): TimeSlot[] {
    return this.data.slots.filter(s => {
      if (doctorId && s.doctorId !== doctorId) return false;
      if (hospitalId && s.hospitalId !== hospitalId) return false;
      return true;
    });
  }

  public getSlotById(id: string): TimeSlot | undefined {
    return this.data.slots.find(s => s.id === id);
  }

  public saveSlots(slots: TimeSlot[]): void {
    // Add new or update
    for (const s of slots) {
      const idx = this.data.slots.findIndex(existing => existing.id === s.id);
      if (idx >= 0) {
        this.data.slots[idx] = s;
      } else {
        this.data.slots.push(s);
      }
    }
    this.save();
  }

  public markSlotBooked(slotId: string, appointmentId: string): void {
    const slot = this.data.slots.find(s => s.id === slotId);
    if (slot) {
      slot.isAvailable = false;
      slot.appointmentId = appointmentId;
      slot.reservationLockedUntil = undefined;
      slot.reservedByPatientId = undefined;
      this.slotLocks.delete(slotId);
      this.save();
    }
  }

  public markSlotAvailable(slotId: string): void {
    const slot = this.data.slots.find(s => s.id === slotId);
    if (slot) {
      slot.isAvailable = true;
      slot.appointmentId = undefined;
      slot.reservationLockedUntil = undefined;
      slot.reservedByPatientId = undefined;
      this.slotLocks.delete(slotId);
      this.save();
    }
  }

  // ==========================================
  // PATIENTS & USER CONTEXT
  // ==========================================

  public getPatients(): Patient[] {
    return this.data.patients;
  }

  public getPatientById(id: string): Patient | undefined {
    return this.data.patients.find(p => p.id === id);
  }

  public findPatientByPhoneOrEmail(query: string): Patient | undefined {
    const clean = query.trim().toLowerCase();
    return this.data.patients.find(p =>
      p.email.toLowerCase() === clean ||
      p.phone.replace(/\D/g, '') === clean.replace(/\D/g, '')
    );
  }

  public savePatient(patient: Patient): Patient {
    const idx = this.data.patients.findIndex(p => p.id === patient.id);
    if (idx >= 0) {
      this.data.patients[idx] = patient;
    } else {
      this.data.patients.push(patient);
    }
    this.save();
    return patient;
  }

  public getUserContext(patientId: string): UserContext {
    let ctx = this.data.userContexts.find(c => c.patientId === patientId);
    if (!ctx) {
      ctx = {
        patientId,
        language: 'en',
        updatedAt: new Date().toISOString()
      };
      this.data.userContexts.push(ctx);
      this.save();
    }
    return ctx;
  }

  public updateUserContext(patientId: string, updates: Partial<UserContext>): UserContext {
    const ctx = this.getUserContext(patientId);
    Object.assign(ctx, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return ctx;
  }

  // ==========================================
  // APPOINTMENTS (Explicit state machine)
  // ==========================================

  public getAppointments(hospitalId?: string, doctorId?: string, patientId?: string): Appointment[] {
    return this.data.appointments.filter(a => {
      if (hospitalId && a.hospitalId !== hospitalId) return false;
      if (doctorId && a.doctorId !== doctorId) return false;
      if (patientId && a.patientId !== patientId) return false;
      return true;
    });
  }

  public getAppointmentById(id: string): Appointment | undefined {
    return this.data.appointments.find(a => a.id === id);
  }

  public findAppointmentByIdempotency(key: string): Appointment | undefined {
    return this.data.appointments.find(a => a.idempotencyKey === key);
  }

  public saveAppointment(appointment: Appointment): Appointment {
    const idx = this.data.appointments.findIndex(a => a.id === appointment.id);
    if (idx >= 0) {
      this.data.appointments[idx] = appointment;
    } else {
      this.data.appointments.push(appointment);
    }
    this.save();
    return appointment;
  }

  // ==========================================
  // QUESTIONNAIRES & RESPONSES
  // ==========================================

  public getQuestionnaires(hospitalId?: string): Questionnaire[] {
    return this.data.questionnaires.filter(q => {
      if (hospitalId && q.hospitalId !== hospitalId) return false;
      return true;
    });
  }

  public getQuestionnaireById(id: string): Questionnaire | undefined {
    return this.data.questionnaires.find(q => q.id === id);
  }

  public findMatchingQuestionnaire(hospitalId: string, specialty?: string): Questionnaire | undefined {
    // Exact doctor or specialty match, fallback to hospital general
    return this.data.questionnaires.find(q =>
      q.hospitalId === hospitalId &&
      q.isActive &&
      (!specialty || !q.specialty || q.specialty.toLowerCase() === specialty.toLowerCase())
    );
  }

  public saveQuestionnaire(questionnaire: Questionnaire): Questionnaire {
    const idx = this.data.questionnaires.findIndex(q => q.id === questionnaire.id);
    if (idx >= 0) {
      this.data.questionnaires[idx] = questionnaire;
    } else {
      this.data.questionnaires.push(questionnaire);
    }
    this.save();
    return questionnaire;
  }

  public getQuestionnaireResponses(appointmentId?: string, doctorId?: string): QuestionnaireResponse[] {
    return this.data.questionnaireResponses.filter(r => {
      if (appointmentId && r.appointmentId !== appointmentId) return false;
      if (doctorId && r.doctorId !== doctorId) return false;
      return true;
    });
  }

  public saveQuestionnaireResponse(response: QuestionnaireResponse): QuestionnaireResponse {
    this.data.questionnaireResponses.push(response);
    this.save();
    return response;
  }

  // ==========================================
  // EHR & INTEGRATION ARTIFACTS
  // ==========================================

  public getEhrConnection(hospitalId: string): HealthcareSystemConnection | undefined {
    return this.data.connections.find(c => c.hospitalId === hospitalId);
  }

  public saveEhrConnection(conn: HealthcareSystemConnection): void {
    const idx = this.data.connections.findIndex(c => c.hospitalId === conn.hospitalId);
    if (idx >= 0) {
      this.data.connections[idx] = conn;
    } else {
      this.data.connections.push(conn);
    }
    this.save();
  }

  public setHospitalFailureMode(hospitalId: string, mode: IntegrationMode): void {
    const conn = this.getEhrConnection(hospitalId);
    if (conn) {
      conn.failureSimulationMode = mode;
      this.save();
    }
    const hosp = this.getHospitalById(hospitalId);
    if (hosp) {
      hosp.integrationConfig.failureSimulationMode = mode;
      this.save();
    }
  }

  public getIdentifierMapping(internalId: string, entityType: string): ExternalIdentifierMapping | undefined {
    return this.data.identifierMappings.find(m => m.internalId === internalId && m.entityType === entityType);
  }

  public saveIdentifierMapping(mapping: ExternalIdentifierMapping): void {
    const idx = this.data.identifierMappings.findIndex(m =>
      m.internalId === mapping.internalId && m.entityType === mapping.entityType
    );
    if (idx >= 0) {
      this.data.identifierMappings[idx] = mapping;
    } else {
      this.data.identifierMappings.push(mapping);
    }
    this.save();
  }

  public logIntegrationOperation(op: IntegrationOperation): void {
    this.data.integrationOperations.push(op);
    this.save();
  }

  public getIntegrationOperations(correlationId?: string): IntegrationOperation[] {
    if (correlationId) {
      return this.data.integrationOperations.filter(o => o.correlationId === correlationId);
    }
    return this.data.integrationOperations;
  }

  public logVerification(verif: IntegrationVerification): void {
    this.data.verifications.push(verif);
    this.save();
  }

  public getVerifications(correlationId?: string): IntegrationVerification[] {
    if (correlationId) {
      return this.data.verifications.filter(v => v.correlationId === correlationId);
    }
    return this.data.verifications;
  }

  public addReconciliationRecord(rec: ReconciliationRecord): void {
    this.data.reconciliationRecords.push(rec);
    this.save();
  }

  public getReconciliationRecords(hospitalId?: string): ReconciliationRecord[] {
    return this.data.reconciliationRecords.filter(r => {
      if (hospitalId && r.hospitalId !== hospitalId) return false;
      return true;
    });
  }

  public resolveReconciliation(id: string, resolvedBy: string): boolean {
    const rec = this.data.reconciliationRecords.find(r => r.id === id);
    if (rec) {
      rec.isResolved = true;
      rec.resolvedBy = resolvedBy;
      rec.resolvedAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // CAPABILITY & AI AUDIT
  // ==========================================

  public logCapabilityExecution(exec: CapabilityExecution): void {
    this.data.capabilityExecutions.push(exec);
    this.save();
  }

  public getCapabilityExecutions(correlationId?: string): CapabilityExecution[] {
    if (correlationId) {
      return this.data.capabilityExecutions.filter(e => e.correlationId === correlationId);
    }
    return this.data.capabilityExecutions;
  }

  public logAuditEvent(event: AuditEvent): void {
    this.data.auditEvents.push(event);
    this.save();
  }

  public getAuditEvents(hospitalId?: string, correlationId?: string): AuditEvent[] {
    return this.data.auditEvents.filter(a => {
      if (hospitalId && a.hospitalId && a.hospitalId !== hospitalId) return false;
      if (correlationId && a.correlationId !== correlationId) return false;
      return true;
    });
  }

  public logAiEvaluation(evaluation: AIEvaluationRecord): void {
    this.data.aiEvaluations.push(evaluation);
    this.save();
  }

  public getAiEvaluations(): AIEvaluationRecord[] {
    return this.data.aiEvaluations;
  }

  // ==========================================
  // WORKFLOWS & NOTIFICATIONS
  // ==========================================

  public addWorkflowExecution(workflow: WorkflowExecution): void {
    this.data.workflows.push(workflow);
    this.save();
  }

  public getWorkflows(correlationId?: string): WorkflowExecution[] {
    if (correlationId) {
      return this.data.workflows.filter(w => w.correlationId === correlationId);
    }
    return this.data.workflows;
  }

  public updateWorkflow(id: string, updates: Partial<WorkflowExecution>): void {
    const idx = this.data.workflows.findIndex(w => w.id === id);
    if (idx >= 0) {
      this.data.workflows[idx] = { ...this.data.workflows[idx], ...updates };
      this.save();
    }
  }

  public addNotification(notification: Notification): void {
    this.data.notifications.push(notification);
    this.save();
  }

  public getNotifications(recipientType?: string, recipientId?: string): Notification[] {
    return this.data.notifications.filter(n => {
      if (recipientType && n.recipientType !== recipientType) return false;
      if (recipientId && n.recipientId !== recipientId) return false;
      return true;
    });
  }

  // ==========================================
  // CONVERSATIONS & AI CONTEXT
  // ==========================================

  public getConversation(id: string): AIConversation | undefined {
    return this.data.conversations.find(c => c.id === id);
  }

  public saveConversation(conv: AIConversation): void {
    const idx = this.data.conversations.findIndex(c => c.id === conv.id);
    if (idx >= 0) {
      this.data.conversations[idx] = conv;
    } else {
      this.data.conversations.push(conv);
    }
    this.save();
  }

  public getAIContext(conversationId: string): AIContext | undefined {
    return this.data.aiContexts.find(c => c.conversationId === conversationId);
  }

  public saveAIContext(ctx: AIContext): void {
    const idx = this.data.aiContexts.findIndex(c => c.conversationId === ctx.conversationId);
    if (idx >= 0) {
      this.data.aiContexts[idx] = ctx;
    } else {
      this.data.aiContexts.push(ctx);
    }
    this.save();
  }

  // End-to-end trace lookup across all layers
  public getTrace(correlationId: string): {
    correlationId: string;
    capabilities: CapabilityExecution[];
    ehrOperations: IntegrationOperation[];
    verifications: IntegrationVerification[];
    reconciliations: ReconciliationRecord[];
    workflows: WorkflowExecution[];
    audits: AuditEvent[];
  } {
    return {
      correlationId,
      capabilities: this.getCapabilityExecutions(correlationId),
      ehrOperations: this.getIntegrationOperations(correlationId),
      verifications: this.getVerifications(correlationId),
      reconciliations: this.data.reconciliationRecords.filter(r => r.correlationId === correlationId),
      workflows: this.getWorkflows(correlationId),
      audits: this.getAuditEvents(undefined, correlationId)
    };
  }

  // ==========================================
  // DEPARTMENTS (Multi-tenant isolated)
  // ==========================================

  public getDepartments(hospitalId?: string): Department[] {
    if (hospitalId) {
      return this.data.departments.filter(d => d.hospitalId === hospitalId);
    }
    return this.data.departments;
  }

  public getDepartmentById(id: string): Department | undefined {
    return this.data.departments.find(d => d.id === id);
  }

  public createDepartment(dept: Department): Department {
    this.data.departments.push(dept);
    this.save();
    return dept;
  }

  public updateDepartment(id: string, updates: Partial<Department>): Department | undefined {
    const idx = this.data.departments.findIndex(d => d.id === id);
    if (idx === -1) return undefined;
    this.data.departments[idx] = { ...this.data.departments[idx], ...updates };
    this.save();
    return this.data.departments[idx];
  }

  public deleteDepartment(id: string): boolean {
    const initial = this.data.departments.length;
    this.data.departments = this.data.departments.filter(d => d.id !== id);
    if (this.data.departments.length !== initial) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // SPECIALTIES
  // ==========================================

  public getSpecialties(): Specialty[] {
    return this.data.specialties;
  }

  public saveSpecialty(spec: Specialty): Specialty {
    const idx = this.data.specialties.findIndex(s => s.id === spec.id || s.name.toLowerCase() === spec.name.toLowerCase());
    if (idx >= 0) {
      this.data.specialties[idx] = spec;
    } else {
      this.data.specialties.push(spec);
    }
    this.save();
    return spec;
  }

  // ==========================================
  // DOCTOR MANAGEMENT
  // ==========================================

  public deleteDoctor(id: string): boolean {
    const initial = this.data.doctors.length;
    this.data.doctors = this.data.doctors.filter(d => d.id !== id);
    if (this.data.doctors.length !== initial) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // APPOINTMENTS EXTENSIONS
  // ==========================================

  public updateAppointmentStatus(id: string, status: any, reason?: string, changedBy: string = 'Hospital Admin'): Appointment | undefined {
    const appt = this.getAppointmentById(id);
    if (!appt) return undefined;
    appt.status = status;
    appt.updatedAt = new Date().toISOString();
    appt.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      changedBy,
      reason
    });
    if (status === 'Cancelled') {
      this.markSlotAvailable(appt.slotId);
    }
    this.save();
    return appt;
  }

  // ==========================================
  // QUESTIONNAIRES EXTENSIONS
  // ==========================================

  public updateQuestionnaire(id: string, updates: Partial<Questionnaire>): Questionnaire | undefined {
    const idx = this.data.questionnaires.findIndex(q => q.id === id);
    if (idx === -1) return undefined;
    this.data.questionnaires[idx] = { ...this.data.questionnaires[idx], ...updates };
    this.save();
    return this.data.questionnaires[idx];
  }

  public deleteQuestionnaire(id: string): boolean {
    const initial = this.data.questionnaires.length;
    this.data.questionnaires = this.data.questionnaires.filter(q => q.id !== id);
    if (this.data.questionnaires.length !== initial) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // HEALTH CONCERNS (Context continuity)
  // ==========================================

  public getHealthConcerns(patientId?: string): HealthConcern[] {
    if (patientId) {
      return this.data.healthConcerns.filter(c => c.patientId === patientId);
    }
    return this.data.healthConcerns;
  }

  public getHealthConcernById(id: string): HealthConcern | undefined {
    return this.data.healthConcerns.find(c => c.id === id);
  }

  public saveHealthConcern(concern: HealthConcern): HealthConcern {
    const idx = this.data.healthConcerns.findIndex(c => c.id === concern.id);
    if (idx >= 0) {
      this.data.healthConcerns[idx] = concern;
    } else {
      this.data.healthConcerns.push(concern);
    }
    this.save();
    return concern;
  }

  // ==========================================
  // HOSPITAL ADMINS (Platform management)
  // ==========================================

  public getHospitalAdmins(hospitalId?: string): HospitalAdmin[] {
    if (hospitalId) {
      return this.data.hospitalAdmins.filter(a => a.hospitalId === hospitalId);
    }
    return this.data.hospitalAdmins;
  }

  public createHospitalAdmin(admin: HospitalAdmin): HospitalAdmin {
    this.data.hospitalAdmins.push(admin);
    this.save();
    return admin;
  }

  public deleteHospitalAdmin(id: string): boolean {
    const initial = this.data.hospitalAdmins.length;
    this.data.hospitalAdmins = this.data.hospitalAdmins.filter(a => a.id !== id);
    if (this.data.hospitalAdmins.length !== initial) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // DYNAMIC SLOTS FRESHNESS
  // ==========================================

  public ensureFreshFutureSlots(): void {
    const now = new Date();
    const futureSlots = this.data.slots.filter(s => new Date(s.startTime).getTime() > now.getTime() && s.isAvailable);

    // If fewer than 25 future available slots exist, generate upcoming slots for active doctors
    if (futureSlots.length < 25 && this.data.doctors.length > 0) {
      const activeDocs = this.data.doctors.filter(d => d.status === 'Active');
      const newSlots: TimeSlot[] = [];

      activeDocs.forEach(doc => {
        for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + dayOffset);
          const dayOfWeek = targetDate.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekend

          const dateStr = targetDate.toISOString().split('T')[0];
          const hours = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

          hours.forEach(h => {
            const [hour, min] = h.split(':').map(Number);
            const start = new Date(targetDate);
            start.setHours(hour, min, 0, 0);
            const end = new Date(start);
            end.setMinutes(start.getMinutes() + (doc.appointmentDurationMinutes || 30));

            const slotId = `slot-${doc.id}-${dateStr}-${h.replace(':', '')}`;
            if (!this.data.slots.some(s => s.id === slotId)) {
              newSlots.push({
                id: slotId,
                doctorId: doc.id,
                hospitalId: doc.hospitalId,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                isAvailable: true
              });
            }
          });
        }
      });

      if (newSlots.length > 0) {
        this.data.slots.push(...newSlots);
        this.save();
      }
    }
  }
}

// Global database singleton
export const db = new Database();
