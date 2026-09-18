import { 
  Hospital, 
  Doctor, 
  TimeSlot, 
  Appointment, 
  Questionnaire, 
  QuestionnaireResponse, 
  ReconciliationRecord, 
  TraceData, 
  PlatformMetrics, 
  IntegrationMode 
} from '../types/index.js';

const BASE = '/api';

export const api = {
  // Platform & Metrics
  getMetrics: async (): Promise<PlatformMetrics> => {
    const res = await fetch(`${BASE}/metrics`);
    return res.json();
  },

  getTrace: async (correlationId: string): Promise<TraceData> => {
    const res = await fetch(`${BASE}/traces/${correlationId}`);
    return res.json();
  },

  getAuditLogs: async (hospitalId?: string) => {
    const url = hospitalId ? `${BASE}/audit-logs?hospitalId=${hospitalId}` : `${BASE}/audit-logs`;
    const res = await fetch(url);
    return res.json();
  },

  getAiEvaluations: async () => {
    const res = await fetch(`${BASE}/ai/evaluations`);
    return res.json();
  },

  // Hospitals
  getHospitals: async (status?: string): Promise<Hospital[]> => {
    const url = status ? `${BASE}/hospitals?status=${status}` : `${BASE}/hospitals`;
    const res = await fetch(url);
    return res.json();
  },

  updateHospitalStatus: async (id: string, status: string, reason?: string): Promise<Hospital> => {
    const res = await fetch(`${BASE}/hospitals/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason })
    });
    return res.json();
  },

  setHospitalFailureMode: async (id: string, mode: IntegrationMode) => {
    const res = await fetch(`${BASE}/hospitals/${id}/failure-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    return res.json();
  },

  // Departments
  getDepartments: async (hospitalId?: string) => {
    const url = hospitalId ? `${BASE}/departments?hospitalId=${hospitalId}` : `${BASE}/departments`;
    const res = await fetch(url);
    return res.json();
  },

  createDepartment: async (data: any) => {
    const res = await fetch(`${BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  updateDepartment: async (id: string, data: any) => {
    const res = await fetch(`${BASE}/departments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteDepartment: async (id: string) => {
    const res = await fetch(`${BASE}/departments/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Doctors
  getDoctors: async (hospitalId?: string): Promise<Doctor[]> => {
    const url = hospitalId ? `${BASE}/doctors?hospitalId=${hospitalId}` : `${BASE}/doctors`;
    const res = await fetch(url);
    return res.json();
  },

  createDoctor: async (data: any) => {
    const res = await fetch(`${BASE}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  updateDoctor: async (id: string, data: any) => {
    const res = await fetch(`${BASE}/doctors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteDoctor: async (id: string) => {
    const res = await fetch(`${BASE}/doctors/${id}`, { method: 'DELETE' });
    return res.json();
  },

  getDoctorCalendar: async (doctorId: string) => {
    const res = await fetch(`${BASE}/doctors/${doctorId}/calendar`);
    return res.json();
  },

  addBlockedSlot: async (doctorId: string, startTime: string, endTime: string, reason: string) => {
    const res = await fetch(`${BASE}/doctors/${doctorId}/blocked-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime, endTime, reason })
    });
    return res.json();
  },

  deleteBlockedSlot: async (id: string) => {
    const res = await fetch(`${BASE}/doctors/blocked-slots/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Scheduling
  getSlots: async (doctorId?: string, hospitalId?: string): Promise<TimeSlot[]> => {
    const params = new URLSearchParams();
    if (doctorId) params.append('doctorId', doctorId);
    if (hospitalId) params.append('hospitalId', hospitalId);
    const res = await fetch(`${BASE}/scheduling/slots?${params.toString()}`);
    return res.json();
  },

  // Appointments
  getAppointments: async (hospitalId?: string, doctorId?: string, patientId?: string): Promise<Appointment[]> => {
    const params = new URLSearchParams();
    if (hospitalId) params.append('hospitalId', hospitalId);
    if (doctorId) params.append('doctorId', doctorId);
    if (patientId) params.append('patientId', patientId);
    const res = await fetch(`${BASE}/appointments?${params.toString()}`);
    return res.json();
  },

  createAppointment: async (slotId: string, patientId: string, reason: string, modeOverride?: string) => {
    const res = await fetch(`${BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, patientId, reason, modeOverride })
    });
    return res.json();
  },

  cancelAppointment: async (appointmentId: string, reason: string) => {
    const res = await fetch(`${BASE}/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return res.json();
  },

  updateAppointmentStatus: async (id: string, status: string, reason?: string) => {
    const res = await fetch(`${BASE}/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason })
    });
    return res.json();
  },

  // Reconciliations
  getReconciliations: async (hospitalId?: string): Promise<ReconciliationRecord[]> => {
    const url = hospitalId ? `${BASE}/reconciliation?hospitalId=${hospitalId}` : `${BASE}/reconciliation`;
    const res = await fetch(url);
    return res.json();
  },

  resolveReconciliation: async (id: string, resolvedBy: string) => {
    const res = await fetch(`${BASE}/reconciliation/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolvedBy })
    });
    return res.json();
  },

  // Questionnaires
  getQuestionnaires: async (hospitalId?: string): Promise<Questionnaire[]> => {
    const url = hospitalId ? `${BASE}/questionnaires?hospitalId=${hospitalId}` : `${BASE}/questionnaires`;
    const res = await fetch(url);
    return res.json();
  },

  getQuestionnaireResponses: async (appointmentId?: string, doctorId?: string): Promise<QuestionnaireResponse[]> => {
    const params = new URLSearchParams();
    if (appointmentId) params.append('appointmentId', appointmentId);
    if (doctorId) params.append('doctorId', doctorId);
    const res = await fetch(`${BASE}/questionnaire-responses?${params.toString()}`);
    return res.json();
  },

  submitQuestionnaireResponse: async (questionnaireId: string, appointmentId: string, answers: Record<string, any>) => {
    const res = await fetch(`${BASE}/questionnaire-responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionnaireId, appointmentId, answers, collectedVia: 'web_form' })
    });
    return res.json();
  },

  // Patients
  getPatients: async () => {
    const res = await fetch(`${BASE}/patients`);
    return res.json();
  },

  // AI Chat & Voice Turn
  sendAiTurn: async (message: string, conversationId?: string, patientId: string = 'pat-1', modeOverride?: string) => {
    const res = await fetch(`${BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId, patientId, channel: 'web_voice', modeOverride })
    });
    return res.json();
  }
};
