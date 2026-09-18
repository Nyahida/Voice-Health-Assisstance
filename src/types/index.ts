export type UserRole = 'Patient' | 'Doctor' | 'HospitalAdmin' | 'PlatformAdmin';

export type IntegrationMode = 
  | 'NORMAL' 
  | 'OPTION_A_TIMEOUT_RETRY' 
  | 'OPTION_B_UNKNOWN_OUTCOME' 
  | 'OPTION_C_UNRECOVERABLE';

export interface Hospital {
  id: string;
  name: string;
  slug: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Suspended';
  address: string;
  contactEmail: string;
  contactPhone: string;
  operatingHours?: {
    days: number[];
    openTime: string;
    closeTime: string;
  };
  description?: string;
  services?: string[];
  departments: string[];
  specialties: string[];
  supportedHealthcareSystems?: string[];
  integrationConfig: {
    systemName: string;
    endpointUrl: string;
    failureSimulationMode: IntegrationMode;
    enabled: boolean;
  };
  rejectionReason?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  description: string;
  headDoctorId?: string;
  specialty?: string;
  doctorsCount?: number;
}

export interface Specialty {
  id: string;
  name: string;
  description: string;
  associatedKeywords: string[];
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

export interface Doctor {
  id: string;
  hospitalId: string;
  name: string;
  photoUrl: string;
  specialty: string;
  department: string;
  qualifications: string[];
  experienceYears: number;
  consultationFee?: number;
  languages: string[];
  consultationTypes: ('in-person' | 'video' | 'telephone')[];
  appointmentDurationMinutes: number;
  externalProviderId: string;
  status: 'Invited' | 'Active' | 'Inactive' | 'Suspended';
  bio: string;
  createdAt?: string;
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

export interface TimeSlot {
  id: string;
  doctorId: string;
  hospitalId: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reservationLockedUntil?: number;
  appointmentId?: string;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  doctorId: string;
  patientId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  status: string;
  consultationType: string;
  reasonForVisit: string;
  externalAppointmentId?: string;
  correlationId: string;
  verificationStatus: string;
  notes?: string;
  createdAt: string;
}

export interface Questionnaire {
  id: string;
  hospitalId: string;
  specialty?: string;
  title: string;
  description: string;
  questions: Array<{
    id: string;
    question: string;
    type: string;
    required: boolean;
    options?: string[];
    isRedFlagIndicator?: boolean;
  }>;
  isActive: boolean;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  answers: Record<string, any>;
  hasRedFlags: boolean;
  redFlagNotes?: string[];
  collectedVia: string;
  submittedAt: string;
}

export interface ReconciliationRecord {
  id: string;
  correlationId: string;
  hospitalId: string;
  appointmentId?: string;
  patientId: string;
  reason: string;
  failureType: string;
  recommendedAction: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface TraceData {
  correlationId: string;
  capabilities: any[];
  ehrOperations: any[];
  verifications: any[];
  reconciliations: any[];
  workflows: any[];
  audits: any[];
}

export interface PlatformMetrics {
  totalAppointments: number;
  confirmedAppointments: number;
  reconciliationsRequired: number;
  averageAiLatencyMs: number;
  activeHospitals: number;
  activeDoctors: number;
  totalWorkflows: number;
  auditEventsCount: number;
}
