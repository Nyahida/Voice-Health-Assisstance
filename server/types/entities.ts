/**
 * Autonomous Multi-Hospital Patient Intake, Scheduling & Pre-Visit Voice Agent
 * Explicit Entity Definitions & State Enums (PRD Sections 4, 5, 6, 7, 14, 22, 23)
 */

// ==========================================
// 1. LIFECYCLE & STATE ENUMS
// ==========================================

export type HospitalStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Suspended';

export type DoctorStatus =
  | 'Invited'
  | 'Active'
  | 'Inactive'
  | 'Suspended';

export type AppointmentStatus =
  | 'Requested'
  | 'Pending'
  | 'Confirmed'
  | 'Rescheduled'
  | 'Cancelled'
  | 'Completed'
  | 'No-show'
  | 'Failed'
  | 'Synchronization Pending'
  | 'Reconciliation Required';

export type ConsultationType = 'in-person' | 'video' | 'telephone';

export type UserRole = 'PlatformAdmin' | 'HospitalAdmin' | 'Doctor' | 'Patient';

export type IntegrationMode =
  | 'NORMAL'
  | 'OPTION_A_TIMEOUT_RETRY'
  | 'OPTION_B_UNKNOWN_OUTCOME'
  | 'OPTION_C_UNRECOVERABLE';

export type VerificationStatus = 'Pending' | 'Verified' | 'Discrepancy' | 'Failed';

export type WorkflowStatus = 'Scheduled' | 'Running' | 'Completed' | 'Failed' | 'Retried';

export type NotificationChannel = 'SMS' | 'Email' | 'In-App' | 'Voice-Call';

// ==========================================
// 2. CORE DOMAIN ENTITIES
// ==========================================

export interface PlatformConfig {
  id: string;
  name: string;
  version: string;
  globalMaxRetries: number;
  verificationTimeoutMs: number;
  defaultEhrMode: IntegrationMode;
  aiGuardrailsActive: boolean;
  activeVoiceLanguage: string;
  createdAt: string;
  updatedAt: string;
}

export interface Hospital {
  id: string;
  name: string;
  slug: string;
  status: HospitalStatus;
  address: string;
  contactEmail: string;
  contactPhone: string;
  operatingHours: {
    days: number[]; // 0=Sun, 1=Mon... 6=Sat
    openTime: string; // "08:00"
    closeTime: string; // "18:00"
  };
  departments: string[];
  specialties: string[];
  supportedHealthcareSystems: string[];
  integrationConfig: {
    systemName: string;
    endpointUrl: string;
    apiVersion: string;
    authType: 'Bearer' | 'ApiKey' | 'OAuth2';
    failureSimulationMode: IntegrationMode;
    enabled: boolean;
  };
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HospitalAdmin {
  id: string;
  hospitalId: string;
  userId: string;
  name: string;
  email: string;
  role: 'HospitalAdmin';
  createdAt: string;
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  description: string;
  headDoctorId?: string;
  specialty: string;
}

export interface Specialty {
  id: string;
  name: string;
  description: string;
  associatedKeywords: string[];
}

export interface Doctor {
  id: string;
  hospitalId: string;
  name: string;
  photoUrl: string;
  specialty: string;
  department: string;
  qualifications: string[];
  experienceYears: number;
  consultationFee: number;
  languages: string[];
  consultationTypes: ConsultationType[];
  appointmentDurationMinutes: number;
  externalProviderId: string;
  status: DoctorStatus;
  bio: string;
  createdAt: string;
}

export interface HealthConcern {
  id: string;
  patientId: string;
  conversationId?: string;
  rawText: string;
  identifiedIssue: string;
  recommendedSpecialties: Array<{
    specialty: string;
    confidence: number;
    reasoning: string;
    isEmergency?: boolean;
  }>;
  primarySpecialty: string;
  hasRedFlags: boolean;
  redFlagDetails?: string[];
  questionnaireId?: string;
  questionnaireResponseId?: string;
  recommendedDoctorIds?: string[];
  selectedDoctorId?: string;
  appointmentId?: string;
  status: 'IDENTIFIED' | 'QUESTIONNAIRE_PENDING' | 'QUESTIONNAIRE_COMPLETED' | 'DOCTOR_RECOMMENDED' | 'BOOKED';
  createdAt: string;
  updatedAt: string;
}

export interface WorkingHoursRule {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  breakStartTime?: string; // "13:00"
  breakEndTime?: string; // "14:00"
}

export interface DoctorCalendar {
  id: string;
  doctorId: string;
  hospitalId: string;
  workingHours: WorkingHoursRule[];
  slotDurationMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
}

export interface BlockedSlot {
  id: string;
  doctorId: string;
  hospitalId: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  reason: string;
  createdAt: string;
}

export interface TimeSlot {
  id: string;
  doctorId: string;
  hospitalId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  isAvailable: boolean;
  reservationLockedUntil?: number; // timestamp ms for atomic lock
  reservedByPatientId?: string;
  appointmentId?: string;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  preferredCommunication: NotificationChannel;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'any';
  externalPatientId?: string;
  createdAt: string;
}

export interface UserContext {
  patientId: string;
  preferredDoctorId?: string;
  preferredHospitalId?: string;
  preferredSpecialty?: string;
  language: string;
  recentSearchQuery?: string;
  lastActiveSessionId?: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  doctorId: string;
  patientId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  reasonForVisit: string;
  externalAppointmentId?: string;
  correlationId: string;
  idempotencyKey: string;
  verificationStatus: VerificationStatus;
  notes?: string;
  statusHistory: Array<{
    status: AppointmentStatus;
    timestamp: string;
    changedBy: string;
    reason?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. PRE-VISIT QUESTIONNAIRES
// ==========================================

export type QuestionType =
  | 'yes_no'
  | 'choice'
  | 'multiple_choice'
  | 'numeric'
  | 'date'
  | 'short_text'
  | 'long_text';

export interface QuestionItem {
  id: string;
  question: string;
  type: QuestionType;
  required: boolean;
  options?: string[]; // for choice / multiple_choice
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
  };
  isRedFlagIndicator?: boolean; // triggers human safety review if yes/positive
}

export interface Questionnaire {
  id: string;
  hospitalId: string;
  specialty?: string;
  doctorId?: string;
  appointmentType?: ConsultationType;
  title: string;
  description: string;
  questions: QuestionItem[];
  isActive: boolean;
  createdAt: string;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  appointmentId: string;
  patientId: string;
  hospitalId: string;
  doctorId: string;
  answers: Record<string, any>; // questionId -> answer
  hasRedFlags: boolean;
  redFlagNotes?: string[];
  collectedVia: 'ai_conversation' | 'web_form';
  submittedAt: string;
}

// ==========================================
// 4. AI AGENT, CONTEXT & CAPABILITIES
// ==========================================

export interface AIConversation {
  id: string;
  patientId: string;
  channel: 'web_voice' | 'telephone' | 'chat';
  startedAt: string;
  endedAt?: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    toolCalls?: Array<{
      capability: string;
      parameters: any;
      result: any;
      success: boolean;
    }>;
  }>;
}

export interface AIContext {
  conversationId: string;
  patientId: string;
  currentIntent?: string;
  selectedHospitalId?: string;
  selectedDoctorId?: string;
  selectedSlot?: TimeSlot;
  currentAppointmentId?: string;
  assignedQuestionnaireId?: string;
  pendingClarification?: string;
  lastPatientUtterance?: string;
  updatedAt: string;
}

export interface CapabilityDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  requiresAuth: boolean;
  allowedRoles: UserRole[];
}

export interface CapabilityExecution {
  id: string;
  capabilityName: string;
  correlationId: string;
  callerId: string;
  role: UserRole;
  parameters: any;
  result?: any;
  error?: string;
  success: boolean;
  latencyMs: number;
  timestamp: string;
}

// ==========================================
// 5. EHR INTEGRATION & VERIFICATION
// ==========================================

export interface HealthcareSystemConnection {
  id: string;
  hospitalId: string;
  systemName: string; // e.g., "Epic Mock", "Cerner Mock", "FHIR Mock"
  status: 'Online' | 'Degraded' | 'Offline';
  failureSimulationMode: IntegrationMode;
  lastPing: string;
}

export interface ExternalIdentifierMapping {
  id: string;
  hospitalId: string;
  entityType: 'Patient' | 'Doctor' | 'Appointment' | 'Facility';
  internalId: string;
  externalId: string;
  externalSystemName: string;
  createdAt: string;
}

export interface IntegrationOperation {
  id: string;
  correlationId: string;
  hospitalId: string;
  operationType: 'CREATE_APPOINTMENT' | 'UPDATE_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'VERIFY_APPOINTMENT' | 'PATIENT_LOOKUP';
  status: 'STARTED' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'UNKNOWN_OUTCOME';
  attemptCount: number;
  requestPayload: any;
  responsePayload?: any;
  errorDetails?: string;
  timestamp: string;
}

export interface IntegrationVerification {
  id: string;
  correlationId: string;
  appointmentId: string;
  externalAppointmentId: string;
  status: VerificationStatus;
  externalRecordFound: boolean;
  matchesInternalSlot: boolean;
  discrepancies?: string[];
  verifiedAt: string;
}

export interface ReconciliationRecord {
  id: string;
  correlationId: string;
  hospitalId: string;
  appointmentId?: string;
  externalAppointmentId?: string;
  patientId: string;
  reason: string;
  failureType: 'TIMEOUT' | 'UNKNOWN_OUTCOME' | 'SLOT_CONFLICT' | 'UNRECOVERABLE_EHR_ERROR';
  recommendedAction: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

// ==========================================
// 6. WORKFLOWS & NOTIFICATIONS
// ==========================================

export type WorkflowEventType =
  | 'HOSPITAL_APPROVED'
  | 'DOCTOR_CREATED'
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_VERIFIED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'QUESTIONNAIRE_ASSIGNED'
  | 'QUESTIONNAIRE_COMPLETED'
  | 'EHR_OPERATION_FAILED'
  | 'RECONCILIATION_REQUIRED'
  | 'HUMAN_ESCALATION';

export interface WorkflowStep {
  stepId: string;
  name: string;
  action: 'SEND_NOTIFICATION' | 'ASSIGN_QUESTIONNAIRE' | 'TRIGGER_SYNC' | 'ESCALATE_HUMAN';
  delayMinutes?: number;
  parameters: Record<string, any>;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  executedAt?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowName: string;
  triggerEvent: WorkflowEventType;
  entityType: 'Appointment' | 'Hospital' | 'Doctor' | 'Patient';
  entityId: string;
  correlationId: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  retryCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface Notification {
  id: string;
  recipientType: 'Patient' | 'Doctor' | 'HospitalAdmin' | 'PlatformAdmin';
  recipientId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  sentAt: string;
  delivered: boolean;
}

// ==========================================
// 7. OBSERVABILITY, AUDIT & AI EVALUATION
// ==========================================

export interface AuditEvent {
  id: string;
  correlationId?: string;
  hospitalId?: string;
  actorRole: UserRole | 'SYSTEM';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  details: Record<string, any>; // Privacy-aware (no raw clinical or sensitive PHI)
  timestamp: string;
}

export interface OperationalMetrics {
  totalAppointments: number;
  confirmedAppointments: number;
  failedAppointments: number;
  reconciliationsRequired: number;
  averageAiLatencyMs: number;
  ehrVerificationSuccessRate: number;
  activeHospitals: number;
  activeDoctors: number;
}

export interface AIEvaluationRecord {
  id: string;
  conversationId: string;
  patientUtterance: string;
  detectedIntent: string;
  selectedCapabilities: string[];
  safetyCheckPassed: boolean;
  clarificationRequired: boolean;
  latencyMs: number;
  evaluationScore: number; // 0 to 100
  feedback?: string;
  timestamp: string;
}
