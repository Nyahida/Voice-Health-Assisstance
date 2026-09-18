import { db } from '../db/database.js';
import { 
  Appointment, 
  Doctor, 
  Patient, 
  IntegrationOperation, 
  IntegrationMode 
} from '../types/entities.js';
import { v4 as uuidv4 } from 'uuid';

export interface ExternalAppointmentPayload {
  externalPatientId: string;
  externalProviderId: string;
  startDateTime: string;
  endDateTime: string;
  serviceType: string;
  reason: string;
  idempotencyToken: string;
}

export interface ExternalEhrResponse {
  success: boolean;
  externalAppointmentId?: string;
  status?: string;
  error?: string;
  errorType?: 'TIMEOUT' | 'NETWORK_ERROR' | 'SLOT_CONFLICT' | 'AUTH_ERROR' | 'UNKNOWN_OUTCOME';
  retryable?: boolean;
}

/**
 * Mock EHR Server simulating enterprise healthcare systems (Epic, Cerner, FHIR R4).
 * Includes realistic fault injection for demonstrating failure recovery (PRD Section 12, 13, 28).
 */
export class MockEhrServer {
  private ehrAppointments: Map<string, {
    externalId: string;
    patientId: string;
    providerId: string;
    start: string;
    end: string;
    status: 'Booked' | 'Cancelled' | 'Rescheduled';
    createdAt: string;
    idempotencyToken: string;
  }> = new Map();

  private failureCounters: Map<string, number> = new Map();

  public getAppointment(externalId: string) {
    return this.ehrAppointments.get(externalId);
  }

  public findByIdempotencyToken(token: string) {
    for (const appt of this.ehrAppointments.values()) {
      if (appt.idempotencyToken === token) {
        return appt;
      }
    }
    return undefined;
  }

  /**
   * Simulates external EHR appointment creation with fault injection.
   */
  public async createExternalAppointment(
    hospitalId: string, 
    payload: ExternalAppointmentPayload, 
    modeOverride?: IntegrationMode
  ): Promise<ExternalEhrResponse> {
    const conn = db.getEhrConnection(hospitalId);
    const mode = modeOverride || conn?.failureSimulationMode || 'NORMAL';
    const counterKey = `${hospitalId}_${payload.idempotencyToken}`;
    const attempts = (this.failureCounters.get(counterKey) || 0) + 1;
    this.failureCounters.set(counterKey, attempts);

    // Simulate minor network propagation delay
    await new Promise(res => setTimeout(res, 350));

    // Check if duplicate token already created
    const existing = this.findByIdempotencyToken(payload.idempotencyToken);
    if (existing) {
      return {
        success: true,
        externalAppointmentId: existing.externalId,
        status: existing.status
      };
    }

    // ========================================================
    // OPTION A: EHR Timeout on 1st attempt, recovers on retry
    // ========================================================
    if (mode === 'OPTION_A_TIMEOUT_RETRY') {
      if (attempts === 1) {
        return {
          success: false,
          error: 'HTTP 504 Gateway Timeout: Epic EHR connector did not respond within 3000ms',
          errorType: 'TIMEOUT',
          retryable: true
        };
      }
      // On retry attempt 2+, succeeds!
    }

    // ========================================================
    // OPTION B: Network timeout during response (Unknown outcome)
    // The external system DID create the appointment, but client timed out!
    // ========================================================
    if (mode === 'OPTION_B_UNKNOWN_OUTCOME') {
      if (attempts === 1) {
        // Record created in EHR silently
        const extId = `EHR-APPT-${uuidv4().substring(0, 8).toUpperCase()}`;
        this.ehrAppointments.set(extId, {
          externalId: extId,
          patientId: payload.externalPatientId,
          providerId: payload.externalProviderId,
          start: payload.startDateTime,
          end: payload.endDateTime,
          status: 'Booked',
          createdAt: new Date().toISOString(),
          idempotencyToken: payload.idempotencyToken
        });

        return {
          success: false,
          error: 'Connection reset by peer during response payload transmission',
          errorType: 'UNKNOWN_OUTCOME',
          retryable: false // Do NOT blindly retry to avoid duplicates!
        };
      }
    }

    // ========================================================
    // OPTION C: Unrecoverable EHR Failure
    // ========================================================
    if (mode === 'OPTION_C_UNRECOVERABLE') {
      return {
        success: false,
        error: 'HTTP 500 Internal Server Error: EHR upstream database constraint violation / lock table full',
        errorType: 'SLOT_CONFLICT',
        retryable: false
      };
    }

    // NORMAL HAPPY PATH
    const externalId = `EHR-APPT-${uuidv4().substring(0, 8).toUpperCase()}`;
    this.ehrAppointments.set(externalId, {
      externalId,
      patientId: payload.externalPatientId,
      providerId: payload.externalProviderId,
      start: payload.startDateTime,
      end: payload.endDateTime,
      status: 'Booked',
      createdAt: new Date().toISOString(),
      idempotencyToken: payload.idempotencyToken
    });

    return {
      success: true,
      externalAppointmentId: externalId,
      status: 'Booked'
    };
  }

  public async cancelExternalAppointment(externalId: string): Promise<boolean> {
    const existing = this.ehrAppointments.get(externalId);
    if (existing) {
      existing.status = 'Cancelled';
      return true;
    }
    return false;
  }
}

export const mockEhr = new MockEhrServer();

/**
 * Healthcare System Integration Connector Layer.
 * Provides vendor-agnostic abstraction and identifier translation (PRD Section 12).
 */
export class EhrConnectorService {
  /**
   * Resolves or generates external identifiers for patient and doctor.
   */
  public resolveExternalIdentifiers(hospitalId: string, patient: Patient, doctor: Doctor): {
    externalPatientId: string;
    externalProviderId: string;
  } {
    let patMap = db.getIdentifierMapping(patient.id, 'Patient');
    if (!patMap) {
      const extPatId = patient.externalPatientId || `EHR-PAT-${uuidv4().substring(0, 6).toUpperCase()}`;
      patMap = {
        id: `map-pat-${uuidv4().substring(0, 6)}`,
        hospitalId,
        entityType: 'Patient',
        internalId: patient.id,
        externalId: extPatId,
        externalSystemName: 'MockEhrConnector',
        createdAt: new Date().toISOString()
      };
      db.saveIdentifierMapping(patMap);
    }

    let docMap = db.getIdentifierMapping(doctor.id, 'Doctor');
    if (!docMap) {
      const extDocId = doctor.externalProviderId || `EHR-DOC-${uuidv4().substring(0, 6).toUpperCase()}`;
      docMap = {
        id: `map-doc-${uuidv4().substring(0, 6)}`,
        hospitalId,
        entityType: 'Doctor',
        internalId: doctor.id,
        externalId: extDocId,
        externalSystemName: 'MockEhrConnector',
        createdAt: new Date().toISOString()
      };
      db.saveIdentifierMapping(docMap);
    }

    return {
      externalPatientId: patMap.externalId,
      externalProviderId: docMap.externalId
    };
  }

  /**
   * Dispatches appointment creation through integration layer.
   */
  public async submitAppointmentToEhr(
    appointment: Appointment, 
    correlationId: string,
    modeOverride?: IntegrationMode
  ): Promise<{
    operation: IntegrationOperation;
    response: ExternalEhrResponse;
  }> {
    const doctor = db.getDoctorById(appointment.doctorId)!;
    const patient = db.getPatientById(appointment.patientId)!;
    const { externalPatientId, externalProviderId } = this.resolveExternalIdentifiers(appointment.hospitalId, patient, doctor);

    const payload: ExternalAppointmentPayload = {
      externalPatientId,
      externalProviderId,
      startDateTime: appointment.startTime,
      endDateTime: appointment.endTime,
      serviceType: appointment.consultationType,
      reason: appointment.reasonForVisit,
      idempotencyToken: appointment.idempotencyKey
    };

    const operationId = `op-${uuidv4().substring(0, 8)}`;
    const op: IntegrationOperation = {
      id: operationId,
      correlationId,
      hospitalId: appointment.hospitalId,
      operationType: 'CREATE_APPOINTMENT',
      status: 'STARTED',
      attemptCount: 1,
      requestPayload: payload,
      timestamp: new Date().toISOString()
    };

    db.logIntegrationOperation(op);

    const res = await mockEhr.createExternalAppointment(appointment.hospitalId, payload, modeOverride);

    if (res.success && res.externalAppointmentId) {
      op.status = 'SUCCESS';
      op.responsePayload = res;

      // Save appointment identifier mapping
      db.saveIdentifierMapping({
        id: `map-appt-${uuidv4().substring(0, 6)}`,
        hospitalId: appointment.hospitalId,
        entityType: 'Appointment',
        internalId: appointment.id,
        externalId: res.externalAppointmentId,
        externalSystemName: 'MockEhrConnector',
        createdAt: new Date().toISOString()
      });
    } else if (res.errorType === 'TIMEOUT') {
      op.status = 'TIMEOUT';
      op.errorDetails = res.error;
    } else if (res.errorType === 'UNKNOWN_OUTCOME') {
      op.status = 'UNKNOWN_OUTCOME';
      op.errorDetails = res.error;
    } else {
      op.status = 'FAILED';
      op.errorDetails = res.error;
    }

    db.save();
    return { operation: op, response: res };
  }
}

export const ehrConnector = new EhrConnectorService();
