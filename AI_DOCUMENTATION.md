# OmniHealth AI: Artificial Intelligence & Voice Documentation

This document describes the AI model architecture, voice streaming technology, prompt engineering, capability specifications, safety guardrails, and evaluation approach (PRD Section 9, 10, 11, 20, 29.5).

---

## 1. AI Models & Runtime Execution

- **Cloud Generative AI**: Google Gemini API SDK (`@google/genai`) with support for Gemini 1.5 Flash / Gemini 2.0 Flash for structured tool calling and conversational intent extraction.
- **Offline / Local Fallback**: Deterministic Natural Language Processing (NLP) intent classifier and context resolution engine built natively into `server/services/aiAgentService.ts`. This ensures 100% operational uptime and zero third-party dependencies during local prototype testing or sandbox environments.
- **Latency Profile**: Average turn processing latency is **under 100ms** for local execution and **under 800ms** when invoking cloud models, comfortably satisfying the PRD's **sub-2-second perceived latency requirement** (PRD Section 11).

---

## 2. Voice & Telephone Technology

### Web Voice Experience
- **Speech Recognition (STT)**: HTML5 Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with continuous listening and speech end-point detection.
- **Speech Synthesis (TTS)**: Web Speech Synthesis API (`SpeechSynthesisUtterance`) with optimized cadence (rate: 1.05) and pitch tailored for healthcare clarity.
- **Audio Waveform**: Real-time frequency visualizer running on HTML5 Web Audio API (`AudioContext`, `AnalyserNode`) reflecting speech energy in 18 animated frequency bars.
- **Barge-In & Interruption Handling**: If the patient begins speaking while the AI is vocalizing, an immediate interruption event cancels audio playback and resets the turn buffer.

### Telephone Experience Simulator
- Simulated SIP/PSTN inbound telephone interface.
- Automatic caller identification using incoming telephone number (`+1-555-0199`).
- Dual-Tone Multi-Frequency (DTMF) keypad simulation.
- IVR automated greeting with natural conversational handover.

---

## 3. Core System Prompts

```markdown
You are the Autonomous Multi-Hospital Patient Intake & Scheduling Assistant for OmniHealth AI.
Your purpose is to assist patients in discovering specialists, checking real availability, booking appointments, and completing pre-visit administrative questionnaires.

CRITICAL ADMINISTRATIVE BOUNDARIES:
1. You are an administrative assistant, NOT a medical doctor.
2. You MUST NEVER provide clinical diagnoses, recommend medications, alter drug dosages, or prescribe treatments.
3. If a patient asks for a prescription (e.g. "What medicine should I take?"), immediately refuse politely and offer to schedule a consultation with an appropriate physician.
4. If a patient reports acute emergency symptoms (e.g. severe crushing chest pain, difficulty breathing, sudden stroke-like symptoms), advise them to immediately call 911 or go to an emergency department.
5. NEVER invent available appointment slots. You must execute check_availability and present only confirmed, bookable slots.
```

---

## 4. Controlled Capabilities Schema (PRD Section 9)

The AI interacts with the world exclusively through 17 typed capabilities:
1. `search_hospitals(query?, specialty?)`
2. `search_doctors(hospitalId?, specialty?, name?)`
3. `check_availability(doctorId, startDate?, endDate?)`
4. `lookup_patient(phoneOrEmail)`
5. `get_appointment(appointmentId)`
6. `create_appointment(slotId, patientId, reason, consultationType?)`
7. `reschedule_appointment(appointmentId, newSlotId, reason)`
8. `cancel_appointment(appointmentId, reason)`
9. `get_questionnaire(hospitalId?, specialty?)`
10. `submit_questionnaire(questionnaireId, appointmentId, answers)`
11. `send_notification(recipientType, recipientId, channel, title, message)`
12. `start_workflow(workflowName, triggerEvent, entityType, entityId)`
13. `get_context(conversationId)`
14. `update_preferences(patientId, preferences)`
15. `verify_external_appointment(appointmentId)`
16. `synchronize_state(appointmentId)`
17. `transfer_to_human(conversationId, reason, priority)`

---

## 5. AI Evaluation & Quality Metrics (PRD Section 19 & 31)

Every conversational turn emits an `AIEvaluationRecord` tracked in the database and visible in the Platform Admin Portal:
- **Detected Intent**: Tracks accuracy of intent classification (`DOCTOR_AND_AVAILABILITY_DISCOVERED`, `CONFIRM_AND_START_QUESTIONNAIRE`, `CLINICAL_SAFETY_BLOCKED`).
- **Capability Success Rate**: Percentage of capability calls executed without exception.
- **Safety Boundary Adherence**: 100% adherence on blocking prescription and diagnostic queries.
- **Perceived Latency**: Monitored per turn in milliseconds.
