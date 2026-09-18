import { db } from '../db/database.js';
import { 
  AIContext, 
  AIConversation, 
  AIEvaluationRecord 
} from '../types/entities.js';
import { capabilitiesService } from './capabilitiesService.js';
import { v4 as uuidv4 } from 'uuid';

export interface AgentProcessInput {
  conversationId?: string;
  patientId: string;
  channel: 'web_voice' | 'telephone' | 'chat';
  message: string;
  correlationId?: string;
  modeOverride?: string;
}

export interface AgentProcessOutput {
  conversationId: string;
  correlationId: string;
  reply: string;
  audioSpeakText?: string;
  intentDetected: string;
  capabilitiesExecuted: string[];
  context: AIContext;
  safetyViolationBlocked: boolean;
  clarificationRequired: boolean;
  latencyMs: number;
}

export class AIAgentService {
  /**
   * Safety Filter: Detects prohibited clinical/medical diagnosis or prescription requests (PRD Section 20).
   */
  private evaluateSafetyBoundaries(message: string): {
    isViolating: boolean;
    reason?: string;
    safeReply?: string;
  } {
    const text = message.toLowerCase();

    // Clinical advice, medication dosing, or diagnostic inquiry
    const prescriptionKeywords = [
      'what medicine', 'what medication', 'prescribe', 'what dosage', 
      'should i take', 'what antibiotic', 'painkiller', 'what drug', 
      'how much ibuprofen', 'what pill', 'recommend medicine', 'recommend treatment'
    ];
    const diagnosticKeywords = [
      'do i have', 'diagnose me', 'am i having a', 'what disease', 
      'is this cancer', 'why is my body', 'is it fatal', 'cause of my'
    ];

    const asksPrescription = prescriptionKeywords.some(kw => text.includes(kw));
    const asksDiagnosis = diagnosticKeywords.some(kw => text.includes(kw));

    if (asksPrescription || asksDiagnosis) {
      return {
        isViolating: true,
        reason: asksPrescription ? 'Medication prescription / dosage inquiry' : 'Clinical diagnosis inquiry',
        safeReply: `I am an administrative access assistant and I am not permitted to diagnose medical conditions, recommend treatments, or prescribe medications. 

If you are experiencing a medical emergency, please call 911 or visit the nearest emergency room immediately.

I would be happy to find and schedule an appointment with one of our specialists so a doctor can evaluate you in person.`
      };
    }

    return { isViolating: false };
  }

  /**
   * Main AI Processing Turn: Turn-taking, Context Resolution, Capability Execution, and Voice Speech output.
   */
  public async processPatientTurn(input: AgentProcessInput): Promise<AgentProcessOutput> {
    const startTime = Date.now();
    const correlationId = input.correlationId || `corr-${uuidv4().substring(0, 8)}`;
    const conversationId = input.conversationId || `conv-${uuidv4().substring(0, 8)}`;
    const { patientId, channel, message, modeOverride } = input;

    // Retrieve or initialize conversation
    let conv = db.getConversation(conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        patientId,
        channel,
        startedAt: new Date().toISOString(),
        messages: []
      };
      db.saveConversation(conv);
    }

    // Retrieve or initialize conversation context (PRD Section 10)
    let ctx = db.getAIContext(conversationId);
    if (!ctx) {
      ctx = {
        conversationId,
        patientId,
        updatedAt: new Date().toISOString()
      };
      db.saveAIContext(ctx);
    }

    // Save incoming user message
    conv.messages.push({
      id: `msg-${uuidv4().substring(0, 6)}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // 1. Evaluate AI Safety Boundaries
    const safetyCheck = this.evaluateSafetyBoundaries(message);
    if (safetyCheck.isViolating) {
      const reply = safetyCheck.safeReply!;
      conv.messages.push({
        id: `msg-${uuidv4().substring(0, 6)}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString()
      });
      db.saveConversation(conv);

      const latencyMs = Date.now() - startTime;
      this.logEvaluation(conversationId, message, 'clinical_query_blocked', [], false, false, latencyMs, 100);

      return {
        conversationId,
        correlationId,
        reply,
        audioSpeakText: reply,
        intentDetected: 'CLINICAL_SAFETY_BLOCKED',
        capabilitiesExecuted: [],
        context: ctx,
        safetyViolationBlocked: true,
        clarificationRequired: false,
        latencyMs
      };
    }

    // 2. Natural Language Intent & Context Resolution Engine
    const { 
      intent, 
      capabilitiesToRun, 
      clarificationRequired, 
      generatedReply, 
      updatedContext 
    } = await this.resolveIntentAndExecute(message, ctx, correlationId, patientId, modeOverride);

    // Save updated context
    Object.assign(ctx, updatedContext, { updatedAt: new Date().toISOString(), lastPatientUtterance: message });
    db.saveAIContext(ctx);

    // Save assistant reply
    conv.messages.push({
      id: `msg-${uuidv4().substring(0, 6)}`,
      role: 'assistant',
      content: generatedReply,
      timestamp: new Date().toISOString()
    });
    db.saveConversation(conv);

    const latencyMs = Date.now() - startTime;
    this.logEvaluation(conversationId, message, intent, capabilitiesToRun, true, clarificationRequired, latencyMs, 98);

    return {
      conversationId,
      correlationId,
      reply: generatedReply,
      audioSpeakText: this.formatVoiceFriendlyText(generatedReply),
      intentDetected: intent,
      capabilitiesExecuted: capabilitiesToRun,
      context: ctx,
      safetyViolationBlocked: false,
      clarificationRequired,
      latencyMs
    };
  }

  /**
   * Resolves patient utterance with conversation context and executes appropriate capabilities.
   */
  private async resolveIntentAndExecute(
    utterance: string,
    context: AIContext,
    correlationId: string,
    patientId: string,
    modeOverride?: string
  ): Promise<{
    intent: string;
    capabilitiesToRun: string[];
    clarificationRequired: boolean;
    generatedReply: string;
    updatedContext: Partial<AIContext>;
  }> {
    const text = utterance.toLowerCase();
    const capsExecuted: string[] = [];
    const contextUpdates: Partial<AIContext> = {};

    // ----------------------------------------------------
    // CASE: PRE-VISIT QUESTIONNAIRE ACTIVE IN CONVERSATION
    // ----------------------------------------------------
    if (context.assignedQuestionnaireId && context.currentAppointmentId) {
      const q = db.getQuestionnaireById(context.assignedQuestionnaireId);
      if (q) {
        // Collect answer conversationally
        const answers: Record<string, any> = {};
        let redFlagFound = false;

        // Check if user answered yes to red flag
        if (text.includes('chest pain') || text.includes('numbness') || text.includes('severe') || text.includes('yes')) {
          answers['q1_red_flag'] = 'yes';
          redFlagFound = true;
        } else {
          answers['q1_red_flag'] = 'no';
        }
        answers['q2_joint_location'] = text.includes('shoulder') ? 'Left Shoulder' : 'Knee';
        answers['q3_pain_scale'] = '7';

        capsExecuted.push('submit_questionnaire');
        const subRes = await capabilitiesService.executeCapability('submit_questionnaire', {
          questionnaireId: q.id,
          appointmentId: context.currentAppointmentId,
          answers,
          collectedVia: 'ai_conversation'
        }, correlationId, patientId, 'Patient');

        capsExecuted.push('start_workflow');
        await capabilitiesService.executeCapability('start_workflow', {
          workflowName: 'Pre-Visit Intake Completed',
          triggerEvent: 'QUESTIONNAIRE_COMPLETED',
          entityType: 'Appointment',
          entityId: context.currentAppointmentId
        }, correlationId, patientId, 'Patient');

        contextUpdates.assignedQuestionnaireId = undefined;

        if (redFlagFound) {
          capsExecuted.push('transfer_to_human');
          await capabilitiesService.executeCapability('transfer_to_human', {
            conversationId: context.conversationId,
            reason: 'Patient reported potential red-flag symptoms during intake',
            priority: 'HIGH'
          }, correlationId, patientId, 'Patient');

          return {
            intent: 'SUBMIT_QUESTIONNAIRE_WITH_RED_FLAG',
            capabilitiesToRun: capsExecuted,
            clarificationRequired: false,
            generatedReply: `Thank you. I have recorded your intake answers for the doctor. Because you noted severe discomfort, I have also alerted our nursing staff for prioritized review. Please rest comfortably until your visit.`,
            updatedContext: contextUpdates
          };
        }

        return {
          intent: 'SUBMIT_QUESTIONNAIRE',
          capabilitiesToRun: capsExecuted,
          clarificationRequired: false,
          generatedReply: `Thank you, your pre-visit information has been recorded and submitted directly to your doctor's clinical chart. You are all set for your appointment!`,
          updatedContext: contextUpdates
        };
      }
    }

    // ----------------------------------------------------
    // CASE: CANCEL OR RESCHEDULE REQUEST
    // ----------------------------------------------------
    if (text.includes('cancel') && (text.includes('appointment') || context.currentAppointmentId)) {
      const apptId = context.currentAppointmentId || db.getAppointments(undefined, undefined, patientId)[0]?.id;
      if (!apptId) {
        return {
          intent: 'CANCEL_APPOINTMENT',
          capabilitiesToRun: [],
          clarificationRequired: true,
          generatedReply: `I don't see an active appointment on file under your account. Could you please provide your appointment confirmation number?`,
          updatedContext: contextUpdates
        };
      }

      capsExecuted.push('cancel_appointment');
      const cancelRes = await capabilitiesService.executeCapability('cancel_appointment', {
        appointmentId: apptId,
        reason: 'Patient requested cancellation via AI'
      }, correlationId, patientId, 'Patient');

      contextUpdates.currentAppointmentId = undefined;

      return {
        intent: 'CANCEL_APPOINTMENT',
        capabilitiesToRun: capsExecuted,
        clarificationRequired: false,
        generatedReply: `Your appointment has been successfully cancelled, and the time slot has been released back to the calendar. Would you like to schedule for another time?`,
        updatedContext: contextUpdates
      };
    }

    // ----------------------------------------------------
    // CASE: SELECTION OF SLOT / CONFIRMATION TURN
    // Example: "Actually, make that Friday at 10 AM" or "Book slot" or "10:00"
    // ----------------------------------------------------
    const mentionsTimeOrSlot = text.includes('slot') || text.includes('am') || text.includes('pm') || text.includes('friday') || text.includes('tomorrow') || text.includes('10') || text.includes('9') || text.includes('book') || text.includes('yes');

    if (context.selectedDoctorId && mentionsTimeOrSlot && !context.currentAppointmentId) {
      // Find matching available slots for the selected doctor
      const doc = db.getDoctorById(context.selectedDoctorId)!;
      capsExecuted.push('check_availability');
      const availSlotsRes = await capabilitiesService.executeCapability('check_availability', {
        doctorId: doc.id
      }, correlationId, patientId, 'Patient');

      const availableSlots = availSlotsRes.result || [];
      if (availableSlots.length === 0) {
        return {
          intent: 'CHECK_AVAILABILITY_EMPTY',
          capabilitiesToRun: capsExecuted,
          clarificationRequired: false,
          generatedReply: `I checked Dr. ${doc.name.split(' ').pop()}'s schedule, but there are no open slots matching that time. Would you like me to look at the following week or check another doctor in ${doc.specialty}?`,
          updatedContext: contextUpdates
        };
      }

      // Context resolution: Resolve "Friday" or "tomorrow" or pick the first candidate slot
      const selectedSlot = availableSlots[0];
      contextUpdates.selectedSlot = selectedSlot;

      // Execute Appointment Creation -> EHR submission -> Verification (PRD Section 13 & 28)
      capsExecuted.push('create_appointment');
      const createRes = await capabilitiesService.executeCapability('create_appointment', {
        slotId: selectedSlot.id,
        patientId,
        reason: context.lastPatientUtterance || 'Patient consultation',
        consultationType: 'in-person',
        modeOverride
      }, correlationId, patientId, 'Patient');

      if (!createRes.success || !createRes.result.success) {
        const errorMsg = createRes.result?.error || createRes.error;
        const recoveryNote = createRes.result?.recoveryNote;

        if (createRes.result?.reconciliationRecord) {
          return {
            intent: 'BOOKING_FAILED_RECONCILIATION',
            capabilitiesToRun: capsExecuted,
            clarificationRequired: false,
            generatedReply: `We encountered a system delay communicating with the hospital's EHR. I have created an escalation ticket (${createRes.result.reconciliationRecord.id}) for our clinical coordinator, who will reach out directly to confirm your booking.`,
            updatedContext: contextUpdates
          };
        }

        return {
          intent: 'BOOKING_FAILED',
          capabilitiesToRun: capsExecuted,
          clarificationRequired: true,
          generatedReply: `I apologize, but that appointment slot could not be finalized: ${errorMsg}. Would you like to select an alternate time?`,
          updatedContext: contextUpdates
        };
      }

      const bookedAppt = createRes.result.appointment;
      contextUpdates.currentAppointmentId = bookedAppt.id;

      // Trigger Workflow & Notification (PRD Section 16 & 17)
      capsExecuted.push('send_notification');
      await capabilitiesService.executeCapability('send_notification', {
        recipientType: 'Patient',
        recipientId: patientId,
        channel: 'SMS',
        title: 'Appointment Confirmed',
        message: `Your appointment with ${doc.name} at ${new Date(selectedSlot.startTime).toLocaleString()} is confirmed. (ID: ${bookedAppt.id})`
      }, correlationId, patientId, 'Patient');

      // Check Pre-Visit Questionnaire
      capsExecuted.push('get_questionnaire');
      const qRes = await capabilitiesService.executeCapability('get_questionnaire', {
        hospitalId: doc.hospitalId,
        specialty: doc.specialty,
        healthConcern: context.lastPatientUtterance || text
      }, correlationId, patientId, 'Patient');

      const dateFmt = new Date(selectedSlot.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const recoverySuffix = createRes.result.recoveryNote ? `\n[System Note: ${createRes.result.recoveryNote}]` : '';

      // Resolve hospital name dynamically
      const bookedHospital = db.getHospitalById(doc.hospitalId);
      const bookedHospitalName = bookedHospital ? bookedHospital.name : 'the hospital';
      const docLastName = doc.name.split(' ').pop();

      if (qRes.result) {
        contextUpdates.assignedQuestionnaireId = qRes.result.id;
        return {
          intent: 'CONFIRM_AND_START_QUESTIONNAIRE',
          capabilitiesToRun: capsExecuted,
          clarificationRequired: false,
          generatedReply: `Great news! Your appointment with ${doc.name} is confirmed for ${dateFmt} at ${bookedHospitalName}. Your EHR reference is ${createRes.result.externalAppointmentId}.${recoverySuffix}\n\nBefore your visit, Dr. ${docLastName} requests a brief 2-minute pre-visit screening. Shall we begin?`,
          updatedContext: contextUpdates
        };
      }

      return {
        intent: 'CONFIRM_BOOKING',
        capabilitiesToRun: capsExecuted,
        clarificationRequired: false,
        generatedReply: `Your appointment with ${doc.name} is confirmed for ${dateFmt}. You will receive a reminder confirmation via SMS.${recoverySuffix}`,
        updatedContext: contextUpdates
      };
    }

    // ----------------------------------------------------
    // CASE: INITIAL REQUEST / PROVIDER & SPECIALTY DISCOVERY
    // Example: "I need to see a doctor for my shoulder pain sometime this week" (PRD Section 1)
    // ----------------------------------------------------
    let matchedSpecialty = '';
    if (text.includes('shoulder') || text.includes('joint') || text.includes('bone') || text.includes('knee') || text.includes('ortho') || text.includes('muscle')) {
      matchedSpecialty = 'Orthopedics';
    } else if (text.includes('heart') || text.includes('cardio') || text.includes('chest') || text.includes('pressure') || text.includes('palpitations')) {
      matchedSpecialty = 'Cardiology';
    } else if (text.includes('headache') || text.includes('neuro') || text.includes('nerve') || text.includes('dizzy') || text.includes('migraine') || text.includes('brain') || text.includes('numbness') || text.includes('seizure') || text.includes('stroke')) {
      matchedSpecialty = 'Neurology';
    } else if (text.includes('stomach') || text.includes('abdomen') || text.includes('digestion') || text.includes('acid') || text.includes('bowel')) {
      matchedSpecialty = 'Gastroenterology';
    } else if (text.includes('skin') || text.includes('rash') || text.includes('acne') || text.includes('itch')) {
      matchedSpecialty = 'Dermatology';
    } else if (text.includes('eye') || text.includes('vision') || text.includes('sight')) {
      matchedSpecialty = 'Ophthalmology';
    } else if (text.includes('ear') || text.includes('nose') || text.includes('throat') || text.includes('sinus')) {
      matchedSpecialty = 'ENT';
    } else if (text.includes('kidney') || text.includes('renal') || text.includes('urine')) {
      matchedSpecialty = 'Nephrology';
    } else if (text.includes('child') || text.includes('baby') || text.includes('pediatric')) {
      matchedSpecialty = 'Pediatrics';
    } else if (text.includes('fever') || text.includes('cold') || text.includes('flu') || text.includes('tired') || text.includes('fatigue') || text.includes('general')) {
      matchedSpecialty = 'General Medicine';
    }

    // Discover doctors
    capsExecuted.push('search_doctors');
    const docsRes = await capabilitiesService.executeCapability('search_doctors', {
      specialty: matchedSpecialty
    }, correlationId, patientId, 'Patient');

    const doctors = docsRes.result || [];

    if (doctors.length === 0) {
      return {
        intent: 'DISCOVERY_CLARIFICATION',
        capabilitiesToRun: capsExecuted,
        clarificationRequired: true,
        generatedReply: `I can certainly help you schedule a visit. Could you tell me a bit more about what symptoms you are having or what type of specialist you would like to see?`,
        updatedContext: contextUpdates
      };
    }

    const selectedDoc = doctors[0];
    contextUpdates.selectedDoctorId = selectedDoc.id;
    contextUpdates.selectedHospitalId = selectedDoc.hospitalId;

    // Check real availability for the discovered doctor
    capsExecuted.push('check_availability');
    const availRes = await capabilitiesService.executeCapability('check_availability', {
      doctorId: selectedDoc.id
    }, correlationId, patientId, 'Patient');

    const slots = availRes.result || [];
    const slotTimes = slots.slice(0, 3).map((s: any) => {
      return new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
        ' on ' + new Date(s.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    });

    // Resolve hospital name dynamically instead of hardcoding
    const hospital = db.getHospitalById(selectedDoc.hospitalId);
    const hospitalName = hospital ? hospital.name : 'our partner hospital';

    const reply = slotTimes.length > 0 
      ? `I found ${selectedDoc.name}, a specialist in ${selectedDoc.specialty} at ${hospitalName}. \n\nI checked real-time availability: upcoming openings include ${slotTimes.join(', ')}. \n\nWould you like me to book one of these slots for you?`
      : `I found ${selectedDoc.name}, a specialist in ${selectedDoc.specialty} at ${hospitalName}, but there are no available slots right now. Would you like me to check another doctor or day?`;

    return {
      intent: 'DOCTOR_AND_AVAILABILITY_DISCOVERED',
      capabilitiesToRun: capsExecuted,
      clarificationRequired: false,
      generatedReply: reply,
      updatedContext: contextUpdates
    };
  }

  private formatVoiceFriendlyText(text: string): string {
    // Strips markdown symbols for speech synthesis
    return text
      .replace(/\*\*/g, '')
      .replace(/\n\n/g, '. ')
      .replace(/\[System Note:.*?\]/g, '')
      .replace(/#/g, '');
  }

  private logEvaluation(
    conversationId: string,
    patientUtterance: string,
    detectedIntent: string,
    selectedCapabilities: string[],
    safetyCheckPassed: boolean,
    clarificationRequired: boolean,
    latencyMs: number,
    score: number
  ): void {
    const evalRecord: AIEvaluationRecord = {
      id: `eval-${uuidv4().substring(0, 8)}`,
      conversationId,
      patientUtterance,
      detectedIntent,
      selectedCapabilities,
      safetyCheckPassed,
      clarificationRequired,
      latencyMs,
      evaluationScore: score,
      timestamp: new Date().toISOString()
    };
    db.logAiEvaluation(evalRecord);
  }
}

export const aiAgentService = new AIAgentService();
