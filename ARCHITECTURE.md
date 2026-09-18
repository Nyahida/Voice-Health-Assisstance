# OmniHealth AI: Architecture & System Design Documentation

This document describes the high-level architecture, domain model, booking sequence, EHR integration flow, failure recovery state machines, and security tenant model implemented in OmniHealth AI (PRD Sections 2, 8, 12, 13, 22, 23, 24).

---

## 1. High-Level Architecture

The platform enforces strict separation between client interfaces, AI coordination, controlled capabilities, scheduling core, integration layer, and external EHR systems:

```mermaid
flowchart TD
    subgraph ClientInterfaces ["1. Client Interfaces (PRD Section 11)"]
        WV[Real-Time Web Voice]
        TEL[Inbound Telephone Simulator]
        PORTALS[Role-Specific Dashboards]
    end

    subgraph AICoordination ["2. AI Coordination & Safety (PRD Section 9 & 20)"]
        SAFETY[AI Safety Filter\nNo Diagnoses / Prescriptions]
        CONTEXT[Context Manager\nMulti-turn Resolution]
        ORCH[AI Agent Orchestrator\nGemini SDK / Deterministic NLP]
    end

    subgraph CapabilitiesLayer ["3. Controlled Capabilities (PRD Section 9 & 10)"]
        CAPS["17 Controlled Capabilities\nValidation • Authorization • Audit"]
    end

    subgraph CoreServices ["4. Core Scheduling & Services (PRD Section 7 & 14)"]
        SCHED[Real Availability Engine\nWorking Hours • Blocked Times]
        LOCK[Atomic Reservation Lock\nDouble-Booking Prevention]
        WF[Workflow & Event Engine\nAsync Automations • Notifications]
    end

    subgraph IntegrationLayer ["5. EHR Integration & Verification (PRD Section 12 & 13)"]
        MAP[External Identifier Mappings\nPatient • Doctor • Appointment]
        CONN[Vendor-Agnostic EHR Connector]
        VERIF[External Verification Engine\nOption A, B, C Recovery]
    end

    subgraph ExternalSystems ["6. External Healthcare Systems (PRD Section 12)"]
        EHR[Mock EHR Server\nEpic / Cerner FHIR R4 Simulation]
    end

    WV --> SAFETY
    TEL --> SAFETY
    PORTALS --> SAFETY
    SAFETY --> CONTEXT
    CONTEXT --> ORCH
    ORCH --> CAPS
    CAPS --> SCHED
    CAPS --> LOCK
    CAPS --> WF
    SCHED --> CONN
    CONN --> MAP
    CONN --> EHR
    EHR --> VERIF
    VERIF --> CoreServices
```

---

## 2. Booking & Verification Sequence Flow

The core product principle dictates: **"Do not report success until the external result is verified against the external healthcare system."**

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Patient (Voice/Text)
    participant AI as AI Agent Service
    participant Cap as Capability Execution
    participant Sched as Central Scheduling Service
    participant EHR as EHR Integration Layer
    participant MockEHR as External Mock EHR
    participant Verif as Verification Service
    participant WF as Workflow Engine

    Patient->>AI: "I need to see Dr. Rao for shoulder pain this week."
    AI->>Cap: search_doctors(specialty: 'Orthopedics')
    Cap-->>AI: Returns Dr. Robert Rao
    AI->>Cap: check_availability(doctorId: 'doc-1')
    Cap-->>AI: Returns real candidate slots
    AI-->>Patient: "Found Dr. Rao with slots on Thursday 09:00 AM, 09:30 AM..."
    
    Patient->>AI: "Book Thursday at 09:00 AM"
    AI->>Cap: create_appointment(slotId, patientId, reason)
    Cap->>Sched: revalidateSlot() & acquireSlotLock()
    Sched-->>Cap: Lock Acquired (State: Requested)
    
    Cap->>EHR: submitAppointmentToEhr(appointment)
    EHR->>MockEHR: POST /ehr/appointments
    MockEHR-->>EHR: External ID (e.g. EHR-APPT-109)
    
    EHR->>Verif: processAndVerifyAppointment()
    Verif->>MockEHR: GET /ehr/appointments/EHR-APPT-109
    MockEHR-->>Verif: Verified Record (Time & Doctor Match)
    
    Verif->>Sched: synchronizeState(State: Confirmed)
    Verif->>WF: triggerEvent('APPOINTMENT_VERIFIED')
    WF-->>Patient: Send Confirmation SMS / In-App Notification
    WF-->>Patient: Assign Pre-Visit Questionnaire
    
    AI-->>Patient: "Your appointment is confirmed! EHR Reference: EHR-APPT-109."
```

---

## 3. Failure Recovery State Machine (PRD Section 28)

```mermaid
stateDiagram-v2
    [*] --> BookingInitiated: create_appointment
    BookingInitiated --> ExternalEhrRequest: Submit payload
    
    ExternalEhrRequest --> ImmediateSuccess: 200 OK
    ExternalEhrRequest --> TimeoutEncountered: 504 Gateway Timeout
    ExternalEhrRequest --> NetworkDropped: Response Connection Reset
    ExternalEhrRequest --> HardFailure: Constraint / Database Lock Error

    TimeoutEncountered --> FailureClassified: Check Retryable Flag
    FailureClassified --> RetryAttempt: Attempt < MaxRetries
    RetryAttempt --> ExternalEhrRequest: Backoff & Resubmit
    RetryAttempt --> RetriesExhausted: Attempt >= MaxRetries

    NetworkDropped --> QueryEhrDirectly: "Did EHR create it?"
    QueryEhrDirectly --> RecordFoundInEhr: Found by Idempotency Token
    RecordFoundInEhr --> StateSynchronized: Sync ID without duplicate booking

    HardFailure --> RetriesExhausted
    RetriesExhausted --> CreateReconciliationRecord: Release Slot Lock
    CreateReconciliationRecord --> EscalateToHumanOperator: Flag on Dashboard
    EscalateToHumanOperator --> [*]

    ImmediateSuccess --> ExternalRecordVerification: Query EHR by external ID
    StateSynchronized --> ExternalRecordVerification
    ExternalRecordVerification --> StateConfirmed: Record Matches Slot
    StateConfirmed --> WorkflowAutomation: Trigger notifications & intake
    WorkflowAutomation --> [*]
```

---

## 4. Multi-Tenant Security & Isolation Model

Tenant boundaries are strictly mandatory (PRD Section 8 & 21):
- **Hospital A** cannot view, query, or modify **Hospital B's** private configuration, doctors, calendars, appointments, pre-visit questionnaire responses, or AI conversation context.
- All query operations in the database layer enforce strict tenant scoping via `hospitalId`.
- External credentials, mock EHR API keys, and voice secrets are isolated per tenant connection.
- Operational logs are privacy-aware and strip raw sensitive clinical narratives and PHI, maintaining auditability through anonymized correlation IDs.
