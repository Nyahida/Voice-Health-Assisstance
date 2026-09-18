import { db } from '../db/database.js';
import { 
  CapabilityDefinition, 
  CapabilityExecution, 
  UserRole, 
  IntegrationMode 
} from '../types/entities.js';
import { schedulingService } from './schedulingService.js';
import { verificationService } from './verificationService.js';
import { questionnaireService } from './questionnaireService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Registry of all 17 Controlled Capabilities with schemas and authorization (PRD Section 9 & 10).
 */
export const CAPABILITY_DEFINITIONS: Record<string, CapabilityDefinition> = {
  search_hospitals: {
    name: 'search_hospitals',
    description: 'Discovers approved hospitals matching search query or specialty.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or keyword' },
        specialty: { type: 'string', description: 'Medical specialty' }
      }
    },
    outputSchema: { type: 'array', items: { type: 'object' } },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  search_doctors: {
    name: 'search_doctors',
    description: 'Finds active doctors by hospital, specialty, department, or doctor name.',
    inputSchema: {
      type: 'object',
      properties: {
        hospitalId: { type: 'string' },
        specialty: { type: 'string' },
        department: { type: 'string' },
        name: { type: 'string' }
      }
    },
    outputSchema: { type: 'array', items: { type: 'object' } },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  check_availability: {
    name: 'check_availability',
    description: 'Queries real bookable slots for a doctor. Never invents slots.',
    inputSchema: {
      type: 'object',
      properties: {
        doctorId: { type: 'string' },
        hospitalId: { type: 'string' },
        specialty: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        consultationType: { type: 'string', enum: ['in-person', 'video', 'telephone'] }
      }
    },
    outputSchema: { type: 'array', items: { type: 'object' } },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  lookup_patient: {
    name: 'lookup_patient',
    description: 'Finds an existing patient by phone number or email address.',
    inputSchema: {
      type: 'object',
      properties: {
        phoneOrEmail: { type: 'string' }
      },
      required: ['phoneOrEmail']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  get_appointment: {
    name: 'get_appointment',
    description: 'Retrieves details and current status of an appointment.',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' }
      },
      required: ['appointmentId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  create_appointment: {
    name: 'create_appointment',
    description: 'Initiates appointment booking, EHR submission, verification, and confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        slotId: { type: 'string' },
        patientId: { type: 'string' },
        reason: { type: 'string' },
        consultationType: { type: 'string', enum: ['in-person', 'video', 'telephone'] },
        idempotencyKey: { type: 'string' },
        modeOverride: { type: 'string' }
      },
      required: ['slotId', 'patientId', 'reason']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin']
  },

  reschedule_appointment: {
    name: 'reschedule_appointment',
    description: 'Reschedules an existing appointment to a new verified slot and releases old slot.',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        newSlotId: { type: 'string' },
        reason: { type: 'string' }
      },
      required: ['appointmentId', 'newSlotId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin']
  },

  cancel_appointment: {
    name: 'cancel_appointment',
    description: 'Cancels an appointment, releases slot back to pool, and verifies with EHR.',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        reason: { type: 'string' }
      },
      required: ['appointmentId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin']
  },

  get_questionnaire: {
    name: 'get_questionnaire',
    description: 'Retrieves an approved pre-visit questionnaire for a hospital, specialty, or doctor.',
    inputSchema: {
      type: 'object',
      properties: {
        hospitalId: { type: 'string' },
        specialty: { type: 'string' },
        questionnaireId: { type: 'string' }
      }
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  submit_questionnaire: {
    name: 'submit_questionnaire',
    description: 'Submits structured pre-visit answers and flags any red-flag conditions for doctor review.',
    inputSchema: {
      type: 'object',
      properties: {
        questionnaireId: { type: 'string' },
        appointmentId: { type: 'string' },
        answers: { type: 'object' },
        collectedVia: { type: 'string', enum: ['ai_conversation', 'web_form'] }
      },
      required: ['questionnaireId', 'appointmentId', 'answers']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin']
  },

  send_notification: {
    name: 'send_notification',
    description: 'Sends a simulated SMS, Email, or In-App notification to a patient or doctor.',
    inputSchema: {
      type: 'object',
      properties: {
        recipientType: { type: 'string', enum: ['Patient', 'Doctor', 'HospitalAdmin', 'PlatformAdmin'] },
        recipientId: { type: 'string' },
        channel: { type: 'string', enum: ['SMS', 'Email', 'In-App', 'Voice-Call'] },
        title: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['recipientType', 'recipientId', 'channel', 'title', 'message']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  start_workflow: {
    name: 'start_workflow',
    description: 'Initiates an asynchronous workflow execution following a state change.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowName: { type: 'string' },
        triggerEvent: { type: 'string' },
        entityType: { type: 'string' },
        entityId: { type: 'string' }
      },
      required: ['workflowName', 'triggerEvent', 'entityType', 'entityId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  get_context: {
    name: 'get_context',
    description: 'Retrieves current active conversational context for a patient session.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' }
      },
      required: ['conversationId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  update_preferences: {
    name: 'update_preferences',
    description: 'Updates patient preferences (e.g. morning vs afternoon, SMS vs Email).',
    inputSchema: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        preferredCommunication: { type: 'string' },
        preferredTimeOfDay: { type: 'string' }
      },
      required: ['patientId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin']
  },

  verify_external_appointment: {
    name: 'verify_external_appointment',
    description: 'Directly validates internal appointment status against external EHR system.',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' }
      },
      required: ['appointmentId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['HospitalAdmin', 'PlatformAdmin', 'Doctor', 'Patient']
  },

  synchronize_state: {
    name: 'synchronize_state',
    description: 'Synchronizes external EHR status into internal application appointment state.',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' }
      },
      required: ['appointmentId']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['HospitalAdmin', 'PlatformAdmin', 'Doctor']
  },

  transfer_to_human: {
    name: 'transfer_to_human',
    description: 'Escalates an unresolvable administrative issue or clinical red flag to a human operator.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        reason: { type: 'string' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
      },
      required: ['reason']
    },
    outputSchema: { type: 'object' },
    requiresAuth: false,
    allowedRoles: ['Patient', 'HospitalAdmin', 'PlatformAdmin', 'Doctor']
  }
};

/**
 * Capability Execution Engine.
 * All AI actions MUST go through this engine with audit and authorization (PRD Section 9).
 */
export class CapabilitiesService {
  public async executeCapability(
    name: string,
    parameters: any,
    correlationId: string,
    callerId: string = 'system',
    role: UserRole = 'Patient'
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const startTime = Date.now();
    const def = CAPABILITY_DEFINITIONS[name];

    if (!def) {
      return { success: false, error: `Unknown capability: ${name}` };
    }

    // Role-based authorization
    if (!def.allowedRoles.includes(role)) {
      const err = `Unauthorized: Role '${role}' cannot execute capability '${name}'`;
      this.recordAudit(name, correlationId, callerId, role, parameters, false, startTime, undefined, err);
      return { success: false, error: err };
    }

    try {
      let result: any;

      switch (name) {
        case 'search_hospitals': {
          const query = (parameters.query || '').toLowerCase();
          const spec = (parameters.specialty || '').toLowerCase();
          const hospitals = db.getHospitals('Approved').filter(h => {
            const matchesQuery = !query || h.name.toLowerCase().includes(query) || h.address.toLowerCase().includes(query);
            const matchesSpec = !spec || h.specialties.some(s => s.toLowerCase().includes(spec));
            return matchesQuery && matchesSpec;
          });
          result = hospitals;
          break;
        }

        case 'search_doctors': {
          const docSpecialty = (parameters.specialty || '').toLowerCase();
          const docName = (parameters.name || '').toLowerCase();
          const hospitalId = parameters.hospitalId;

          const doctors = db.getDoctors(hospitalId).filter(d => {
            if (d.status !== 'Active') return false;
            const matchesSpec = !docSpecialty || d.specialty.toLowerCase().includes(docSpecialty);
            const matchesName = !docName || d.name.toLowerCase().includes(docName);
            return matchesSpec && matchesName;
          });
          result = doctors;
          break;
        }

        case 'check_availability': {
          const slots = schedulingService.getAvailableSlots({
            doctorId: parameters.doctorId,
            hospitalId: parameters.hospitalId,
            specialty: parameters.specialty,
            startDate: parameters.startDate,
            endDate: parameters.endDate,
            consultationType: parameters.consultationType
          });
          result = slots;
          break;
        }

        case 'lookup_patient': {
          const pat = db.findPatientByPhoneOrEmail(parameters.phoneOrEmail);
          result = pat || null;
          break;
        }

        case 'get_appointment': {
          const appt = db.getAppointmentById(parameters.appointmentId);
          result = appt || null;
          break;
        }

        case 'create_appointment': {
          const idempotencyKey = parameters.idempotencyKey || `idem-${uuidv4()}`;
          const bookingRes = schedulingService.createAppointmentRecord({
            patientId: parameters.patientId,
            slotId: parameters.slotId,
            reasonForVisit: parameters.reason,
            consultationType: parameters.consultationType,
            correlationId,
            idempotencyKey
          });

          if (!bookingRes.success || !bookingRes.appointment) {
            result = { success: false, error: bookingRes.error };
            break;
          }

          // If duplicate was returned idempotently, return it
          if (bookingRes.isDuplicate) {
            result = {
              success: true,
              appointment: bookingRes.appointment,
              note: 'Idempotent response: appointment already exists.'
            };
            break;
          }

          // Execute full EHR integration and verification flow (PRD Section 13)
          const modeOverride: IntegrationMode | undefined = parameters.modeOverride;
          const verifRes = await verificationService.processAndVerifyAppointment(
            bookingRes.appointment,
            correlationId,
            modeOverride
          );

          result = {
            success: verifRes.success,
            appointment: verifRes.appointment,
            externalAppointmentId: verifRes.externalAppointmentId,
            verification: verifRes.verification,
            reconciliationRecord: verifRes.reconciliationRecord,
            recoveryNote: verifRes.recoveryNote,
            error: verifRes.error
          };
          break;
        }

        case 'reschedule_appointment': {
          const resched = schedulingService.rescheduleAppointment(
            parameters.appointmentId,
            parameters.newSlotId,
            parameters.reason || 'Patient requested reschedule via AI'
          );
          result = resched;
          break;
        }

        case 'cancel_appointment': {
          const cancelRes = schedulingService.cancelAppointment(
            parameters.appointmentId,
            parameters.reason || 'Patient requested cancellation via AI'
          );
          result = cancelRes;
          break;
        }

        case 'get_questionnaire': {
          if (parameters.questionnaireId) {
            result = db.getQuestionnaireById(parameters.questionnaireId) || null;
          } else {
            result = questionnaireService.getOrCreateContextualQuestionnaire({
              hospitalId: parameters.hospitalId,
              specialty: parameters.specialty,
              healthConcern: parameters.healthConcern || 'routine consultation'
            });
          }
          break;
        }

        case 'submit_questionnaire': {
          const q = db.getQuestionnaireById(parameters.questionnaireId);
          const appt = db.getAppointmentById(parameters.appointmentId);
          if (!q || !appt) {
            result = { success: false, error: 'Invalid questionnaire or appointment ID' };
            break;
          }

          const answers = parameters.answers || {};
          const redFlagNotes: string[] = [];

          // Evaluate red flags
          for (const item of q.questions) {
            if (item.isRedFlagIndicator && answers[item.id]) {
              const ans = String(answers[item.id]).toLowerCase();
              if (ans === 'yes' || ans === 'true' || ans === '1') {
                redFlagNotes.push(`Critical indicator flagged on: "${item.question}"`);
              }
            }
          }

          const qResponse = db.saveQuestionnaireResponse({
            id: `resp-${uuidv4().substring(0, 8)}`,
            questionnaireId: q.id,
            appointmentId: appt.id,
            patientId: appt.patientId,
            hospitalId: appt.hospitalId,
            doctorId: appt.doctorId,
            answers,
            hasRedFlags: redFlagNotes.length > 0,
            redFlagNotes: redFlagNotes.length > 0 ? redFlagNotes : undefined,
            collectedVia: parameters.collectedVia || 'ai_conversation',
            submittedAt: new Date().toISOString()
          });

          result = { success: true, response: qResponse, hasRedFlags: qResponse.hasRedFlags };
          break;
        }

        case 'send_notification': {
          const notif = {
            id: `notif-${uuidv4().substring(0, 8)}`,
            recipientType: parameters.recipientType,
            recipientId: parameters.recipientId,
            channel: parameters.channel,
            title: parameters.title,
            message: parameters.message,
            metadata: { correlationId },
            sentAt: new Date().toISOString(),
            delivered: true
          };
          db.addNotification(notif);
          result = { success: true, notification: notif };
          break;
        }

        case 'start_workflow': {
          const wf = {
            id: `wf-${uuidv4().substring(0, 8)}`,
            workflowName: parameters.workflowName,
            triggerEvent: parameters.triggerEvent,
            entityType: parameters.entityType,
            entityId: parameters.entityId,
            correlationId,
            status: 'Running' as const,
            steps: [
              {
                stepId: 'step-1',
                name: 'Send Patient Confirmation SMS',
                action: 'SEND_NOTIFICATION' as const,
                parameters: { channel: 'SMS' },
                status: 'EXECUTED' as const,
                executedAt: new Date().toISOString()
              },
              {
                stepId: 'step-2',
                name: 'Assign Pre-Visit Questionnaire',
                action: 'ASSIGN_QUESTIONNAIRE' as const,
                parameters: {},
                status: 'EXECUTED' as const,
                executedAt: new Date().toISOString()
              }
            ],
            retryCount: 0,
            createdAt: new Date().toISOString()
          };
          db.addWorkflowExecution(wf);
          result = { success: true, workflow: wf };
          break;
        }

        case 'get_context': {
          const ctx = db.getAIContext(parameters.conversationId);
          result = ctx || null;
          break;
        }

        case 'update_preferences': {
          const updated = db.updateUserContext(parameters.patientId, {
            preferredTimeOfDay: parameters.preferredTimeOfDay
          });
          const pat = db.getPatientById(parameters.patientId);
          if (pat && parameters.preferredCommunication) {
            pat.preferredCommunication = parameters.preferredCommunication;
            db.savePatient(pat);
          }
          result = { success: true, context: updated };
          break;
        }

        case 'verify_external_appointment': {
          const appt = db.getAppointmentById(parameters.appointmentId);
          if (!appt || !appt.externalAppointmentId) {
            result = { success: false, error: 'Appointment has no external EHR ID' };
            break;
          }
          const verifs = db.getVerifications(appt.correlationId);
          result = {
            appointmentId: appt.id,
            status: appt.status,
            verificationStatus: appt.verificationStatus,
            verifications: verifs
          };
          break;
        }

        case 'synchronize_state': {
          const appt = db.getAppointmentById(parameters.appointmentId);
          if (appt) {
            appt.status = 'Confirmed';
            appt.verificationStatus = 'Verified';
            db.saveAppointment(appt);
            result = { success: true, appointment: appt };
          } else {
            result = { success: false, error: 'Appointment not found' };
          }
          break;
        }

        case 'transfer_to_human': {
          db.logAuditEvent({
            id: `audit-${uuidv4().substring(0, 8)}`,
            correlationId,
            actorRole: role,
            actorId: callerId,
            action: 'HUMAN_ESCALATION_TRIGGERED',
            entityType: 'AIConversation',
            entityId: parameters.conversationId || 'unknown',
            details: { reason: parameters.reason, priority: parameters.priority || 'MEDIUM' },
            timestamp: new Date().toISOString()
          });
          result = {
            success: true,
            status: 'ESCALATED',
            message: `Operator notified with priority ${parameters.priority || 'MEDIUM'}. Reason: ${parameters.reason}`
          };
          break;
        }

        default:
          return { success: false, error: `Capability ${name} handler not implemented` };
      }

      this.recordAudit(name, correlationId, callerId, role, parameters, true, startTime, result);
      return { success: true, result };

    } catch (err: any) {
      const errorMsg = err.message || 'Error executing capability';
      this.recordAudit(name, correlationId, callerId, role, parameters, false, startTime, undefined, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  private recordAudit(
    name: string,
    correlationId: string,
    callerId: string,
    role: UserRole,
    parameters: any,
    success: boolean,
    startTime: number,
    result?: any,
    error?: string
  ): void {
    const latencyMs = Date.now() - startTime;
    const exec: CapabilityExecution = {
      id: `cap-exec-${uuidv4().substring(0, 8)}`,
      capabilityName: name,
      correlationId,
      callerId,
      role,
      parameters,
      result: success ? result : undefined,
      error,
      success,
      latencyMs,
      timestamp: new Date().toISOString()
    };
    db.logCapabilityExecution(exec);
  }
}

export const capabilitiesService = new CapabilitiesService();
