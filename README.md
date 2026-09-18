# OmniHealth AI: Autonomous Multi-Hospital Patient Intake, Scheduling & Pre-Visit Voice Agent

> **Multi-Tenant Healthcare Discovery, Scheduling, Patient Intake & AI Operations Platform**  
> *Version 2.0 — Concise Candidate Edition*

OmniHealth AI is a production-grade, multi-tenant healthcare access and operations platform that connects patients, physicians, hospital administrators, and enterprise EHR systems through an autonomous voice-enabled conversational AI.

Instead of navigating complex departmental phone trees or web forms, patients speak or type naturally:
> *"I need to see a doctor for my shoulder pain sometime this week."*

The AI understands administrative intent, clarifies missing information, discovers relevant hospitals and doctors, checks **real-time availability** (never inventing slots), executes bookings through **controlled capabilities**, verifies appointments against external EHR systems, synchronizes state, collects pre-visit questionnaires, and automates notifications.

---

## 🌟 Key Features

1. **Complete Connected Flow**:
   $$\text{Patient Voice} \to \text{AI Understanding} \to \text{Doctor Discovery} \to \text{Real Availability} \to \text{Authorized Booking} \to \text{EHR Integration} \to \text{External Verification} \to \text{State Sync} \to \text{Pre-Visit Intake} \to \text{Doctor Chart Review} \to \text{Platform Observability}$$
2. **Real Availability Engine (Zero Hallucinations)**:
   - Central source of truth respecting doctor working hours, break periods, blocked surgery times, and calendar leaves.
   - Atomic reservation locking to prevent concurrent double-booking (Patient A & B race conditions).
3. **External EHR Integration Layer & Verification**:
   - Vendor-agnostic integration connector (FHIR R4 / Epic / Cerner).
   - *External Verification Step*: Appointments are never reported confirmed to the patient until the external EHR record is verified.
4. **Resilient Failure Recovery (PRD Section 28)**:
   - **Option A (EHR Timeout & Retry)**: Classifies 504 Gateway Timeouts as transient, retries with backoff, verifies external record, and safely confirms.
   - **Option B (Unknown Outcome & Deduplication)**: When network drops during response, actively queries the EHR to check if the record was created, synchronizing state without creating duplicate appointments.
   - **Option C (Retries Exhausted & Escalation)**: Unrecoverable failures trigger an explicit `ReconciliationRecord` and immediate human operator escalation on the dashboard.
5. **Pre-Visit Questionnaires & Clinical Red Flags**:
   - Hospital/specialty-configured questionnaires with Yes/No, Multiple Choice, Pain Scales, and Dates.
   - Real-time clinical red-flag detection (e.g. chest pain, numbness) that alerts nursing desks.
6. **Strict Administrative AI Safety Boundaries**:
   - Enforces administrative boundaries: strictly refuses to give clinical diagnoses, prescribe medication, or alter drug dosages.
7. **Four Dedicated Role Dashboards**:
   - **Patient Portal**: Real-time web voice agent, microphone audio wave visualizer, appointment manager.
   - **Doctor Portal**: Daily schedule, pre-visit intake charts with red-flag alerts, blocked time manager.
   - **Hospital Admin Portal**: Tenant-isolated view of doctors, departments, questionnaires, and connector health.
   - **Platform Admin Portal**: Hospital onboarding approvals, global health metrics, Failure Injection Console, and Correlation ID Trace explorer.
8. **Inbound Telephone Call Simulator**:
   - Full simulated smartphone handset with caller-ID recognition (`+1-555-0199 John Doe`), DTMF audio tones, IVR greetings, and natural conversational voice booking.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Node.js, Express, TypeScript, WebSocket (`ws`), UUID.
- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS Design System with Glassmorphism, Lucide Icons.
- **Audio / Voice**: Web Speech API (`SpeechRecognition` & `SpeechSynthesis`), HTML5 Web Audio API (`AudioContext`, `AnalyserNode`).
- **AI Engine**: Hybrid architecture with Google Gemini API SDK (`@google/genai`) and a deterministic, robust Natural Language Intent & Context Engine.
- **Testing**: Vitest test runner with 100% pass rate across 14 comprehensive unit and integration test suites.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (v22+ recommended)
- **npm**: v9.0.0 or later

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <repo-url>
cd "health voice agent"
npm install
```

### 3. Environment Variables (Optional)
Create a `.env` file in the project root:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here # Optional: Platform includes built-in deterministic NLP engine
```

### 4. Running the Platform
Start both the backend server and frontend:
```bash
# Build the frontend and run the unified server:
npm run build
npx tsx server/index.ts
```
The application will be live at:
👉 **`http://localhost:3001`**

Alternatively, for active frontend development with Hot Module Reloading:
```bash
# Terminal 1:
npm run dev:server

# Terminal 2:
npm run dev:client
```

---

## 🧪 Running Automated Tests

Run the complete test suite:
```bash
npm test
```
This executes all 14 tests verifying:
- Availability calculation & blocked periods
- Concurrent reservation locks & double-booking prevention
- Idempotency guarantees
- Option A: EHR Timeout & Auto-Retry
- Option B: Unknown Outcome & Deduplicated Sync
- Option C: Retries Exhausted & Reconciliation Record
- AI Safety Filter (medication prescription & diagnosis blocking)
- Multi-turn conversational context resolution ("Actually make that 10:00 AM")
- Multi-tenant hospital isolation boundaries

---

## 👥 Demo Accounts & Perspectives

The platform provides a top **Role Switcher Navigation Bar** enabling 1-click access to all roles:

| Role | Perspective | Core Features to Explore |
| :--- | :--- | :--- |
| **Patient Portal** | John Doe (`pat-1`) | Web Voice Assistant, Microphone Visualizer, Slot Picker, Pre-Visit Intake, Telephone Simulator |
| **Doctor Portal** | Dr. Robert Rao (`doc-1`) | Daily Consultations, Pre-Visit Chart Review with Red-Flag Alerts, Blocked Time Manager |
| **Hospital Admin** | City Central Hospital (`hosp-1`) | Tenant-isolated doctor roster, department directory, pre-visit questionnaire configuration |
| **Platform Admin** | Platform Governance | Hospital onboarding approvals (Metro Community Clinic), Live Failure Simulator (Options A/B/C), Trace Explorer |

---

## 🔬 Live Failure Demonstration Instructions

1. Go to **Platform Admin** in the top navigation.
2. Scroll to the **Live Failure Demonstration Console (PRD Section 28)**.
3. Click any of the three scenario buttons:
   - **Run Option A Demo**: Watch the system recover from an EHR 504 Gateway Timeout and verify external record.
   - **Run Option B Demo**: Observe network drop handling where the system queries the EHR directly and synchronizes without creating duplicates.
   - **Run Option C Demo**: Trigger retries exhaustion, generating a persistent `ReconciliationRecord` and escalating to the operational queue.
4. Click **View Trace** on any record to inspect the complete Correlation ID timeline!
