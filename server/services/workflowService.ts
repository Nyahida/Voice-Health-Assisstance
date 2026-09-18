import { db } from '../db/database.js';
import { 
  WorkflowEventType, 
  WorkflowExecution, 
  WorkflowStep, 
  Notification,
  NotificationChannel 
} from '../types/entities.js';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowService {
  /**
   * Dispatches an event into the asynchronous workflow automation engine (PRD Section 16 & 17).
   */
  public async triggerEvent(
    eventType: WorkflowEventType,
    entityType: 'Appointment' | 'Hospital' | 'Doctor' | 'Patient',
    entityId: string,
    correlationId: string,
    metadata?: Record<string, any>
  ): Promise<WorkflowExecution> {
    const workflowId = `wf-${uuidv4().substring(0, 8)}`;
    const steps: WorkflowStep[] = [];

    switch (eventType) {
      case 'APPOINTMENT_BOOKED':
      case 'APPOINTMENT_VERIFIED': {
        const appt = db.getAppointmentById(entityId);
        const doc = appt ? db.getDoctorById(appt.doctorId) : undefined;
        const patient = appt ? db.getPatientById(appt.patientId) : undefined;

        // Step 1: Immediate confirmation notification to patient
        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: 'Patient Confirmation SMS & Email',
          action: 'SEND_NOTIFICATION',
          parameters: {
            recipientType: 'Patient',
            recipientId: appt?.patientId,
            channel: patient?.preferredCommunication || 'SMS',
            title: 'Appointment Confirmed',
            message: `Your visit with ${doc?.name || 'Doctor'} on ${appt ? new Date(appt.startTime).toLocaleString() : ''} is verified and confirmed. (ID: ${appt?.id})`
          },
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        });

        // Step 2: Notify doctor of new booked appointment
        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: 'Doctor Calendar Alert',
          action: 'SEND_NOTIFICATION',
          parameters: {
            recipientType: 'Doctor',
            recipientId: appt?.doctorId,
            channel: 'In-App',
            title: 'New Patient Scheduled',
            message: `New booking: Patient ${patient?.name || 'Patient'} scheduled for ${appt ? new Date(appt.startTime).toLocaleTimeString() : ''}.`
          },
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        });

        // Step 3: Assign Pre-Visit Questionnaire
        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: 'Pre-Visit Intake Assignment',
          action: 'ASSIGN_QUESTIONNAIRE',
          parameters: {
            appointmentId: entityId,
            hospitalId: appt?.hospitalId,
            specialty: doc?.specialty
          },
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        });

        // Step 4: Scheduled 24-Hour Reminder (delayed step simulation)
        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: '24-Hour Pre-Appointment Reminder',
          action: 'SEND_NOTIFICATION',
          delayMinutes: 1440,
          parameters: {
            recipientType: 'Patient',
            recipientId: appt?.patientId,
            channel: 'SMS',
            title: 'Upcoming Visit Reminder',
            message: `Reminder: You have an upcoming consultation tomorrow with ${doc?.name}.`
          },
          status: 'PENDING'
        });
        break;
      }

      case 'QUESTIONNAIRE_COMPLETED': {
        const appt = db.getAppointmentById(entityId);
        const responses = db.getQuestionnaireResponses(entityId);
        const hasRedFlags = responses.some(r => r.hasRedFlags);

        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: 'Doctor Pre-Visit Chart Sync',
          action: 'SEND_NOTIFICATION',
          parameters: {
            recipientType: 'Doctor',
            recipientId: appt?.doctorId,
            channel: 'In-App',
            title: hasRedFlags ? '⚠️ URGENT: Pre-Visit Intake Flagged' : 'Pre-Visit Intake Completed',
            message: hasRedFlags
              ? `Patient submitted intake with clinical RED FLAGS requiring doctor attention.`
              : `Patient pre-visit questionnaire completed and attached to chart.`
          },
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        });

        if (hasRedFlags) {
          steps.push({
            stepId: `step-${uuidv4().substring(0, 6)}`,
            name: 'Clinical Escalation to Nursing Desk',
            action: 'ESCALATE_HUMAN',
            parameters: {
              appointmentId: entityId,
              priority: 'HIGH'
            },
            status: 'EXECUTED',
            executedAt: new Date().toISOString()
          });
        }
        break;
      }

      case 'RECONCILIATION_REQUIRED': {
        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: 'Hospital Operations Alert',
          action: 'SEND_NOTIFICATION',
          parameters: {
            recipientType: 'HospitalAdmin',
            recipientId: 'admin',
            channel: 'In-App',
            title: '🚨 Reconciliation Required: EHR Booking Issue',
            message: `A booking encountered an unrecoverable EHR timeout. Human reconciliation required.`
          },
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        });
        break;
      }

      case 'APPOINTMENT_CANCELLED': {
        const appt = db.getAppointmentById(entityId);
        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: 'Cancellation Notification Dispatch',
          action: 'SEND_NOTIFICATION',
          parameters: {
            recipientType: 'Patient',
            recipientId: appt?.patientId,
            channel: 'SMS',
            title: 'Appointment Cancelled',
            message: `Your appointment has been cancelled and calendar slot released.`
          },
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        });
        break;
      }

      default:
        steps.push({
          stepId: `step-${uuidv4().substring(0, 6)}`,
          name: `Log ${eventType}`,
          action: 'TRIGGER_SYNC',
          parameters: { eventType },
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        });
    }

    const workflow: WorkflowExecution = {
      id: workflowId,
      workflowName: `${eventType} Automation Pipeline`,
      triggerEvent: eventType,
      entityType,
      entityId,
      correlationId,
      status: steps.some(s => s.status === 'PENDING') ? 'Running' : 'Completed',
      steps,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: steps.every(s => s.status === 'EXECUTED') ? new Date().toISOString() : undefined
    };

    db.addWorkflowExecution(workflow);

    // Dispatch the immediate notifications defined in executed steps
    for (const step of steps) {
      if (step.status === 'EXECUTED' && step.action === 'SEND_NOTIFICATION') {
        const notif: Notification = {
          id: `notif-${uuidv4().substring(0, 8)}`,
          recipientType: step.parameters.recipientType,
          recipientId: step.parameters.recipientId || 'unknown',
          channel: step.parameters.channel,
          title: step.parameters.title,
          message: step.parameters.message,
          metadata: { correlationId, workflowId },
          sentAt: new Date().toISOString(),
          delivered: true
        };
        db.addNotification(notif);
      }
    }

    return workflow;
  }
}

export const workflowService = new WorkflowService();
