import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import {
  Hospital, Doctor, Questionnaire, Appointment,
  IntegrationMode, Department, ReconciliationRecord
} from '../types/index.js';

interface HospitalAdminDashboardProps {
  onOpenTrace: (correlationId: string) => void;
}

type SidebarSection =
  | 'dashboard' | 'profile' | 'departments' | 'doctors'
  | 'calendars' | 'appointments' | 'questionnaires'
  | 'ehr' | 'audit' | 'notifications' | 'analytics'
  | 'reconciliation' | 'settings';

const NAV_ITEMS: { id: SidebarSection; label: string; icon: string; section?: string }[] = [
  { id: 'dashboard',      label: 'Dashboard',               icon: '🏠' },
  { id: 'profile',        label: 'Hospital Profile',        icon: '🏥' },
  { id: 'departments',    label: 'Departments',             icon: '🏢' },
  { id: 'doctors',        label: 'Doctors',                 icon: '🩺' },
  { id: 'calendars',      label: 'Calendars & Availability', icon: '📅' },
  { id: 'appointments',   label: 'Appointments',            icon: '🗓️' },
  { id: 'questionnaires', label: 'Questionnaires',          icon: '📋' },
  { id: 'ehr',            label: 'Healthcare System / Mock EHR', icon: '🔗' },
];

export const HospitalAdminDashboard: React.FC<HospitalAdminDashboardProps> = ({ onOpenTrace }) => {
  const [activeSection, setActiveSection] = useState<SidebarSection>('dashboard');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('hosp-1');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [currentMode, setCurrentMode] = useState<IntegrationMode>('NORMAL');
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [doctorForm, setDoctorForm] = useState({ name: '', specialty: '', department: '', experienceYears: 10, consultationFee: 150, externalProviderId: '', bio: '' });
  const [deptForm, setDeptForm] = useState({ name: '', description: '', specialty: '' });

  const loadData = useCallback(async () => {
    try { const d = await api.getHospitals(); setHospitals(d); } catch (e) {}
  }, []);

  const loadTenantData = useCallback(async (hospId: string) => {
    try {
      const [docs, quests, appts, deps, recs, logs] = await Promise.all([
        api.getDoctors(hospId), api.getQuestionnaires(hospId),
        api.getAppointments(hospId), api.getDepartments(hospId),
        api.getReconciliations(hospId), api.getAuditLogs(hospId)
      ]);
      setDoctors(docs); setQuestionnaires(quests); setAppointments(appts);
      setDepartments(deps); setReconciliations(recs); setAuditLogs(logs);
    } catch (e) {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (selectedHospitalId) loadTenantData(selectedHospitalId); }, [selectedHospitalId, loadTenantData]);

  const currentHosp = hospitals.find(h => h.id === selectedHospitalId);
  const confirmedAppts = appointments.filter(a => a.status === 'Confirmed');
  const openRecs = reconciliations.filter(r => !r.isResolved);

  const handleSetMode = async (mode: IntegrationMode) => {
    await api.setHospitalFailureMode(selectedHospitalId, mode);
    setCurrentMode(mode);
    alert('Integration mode updated to ' + mode);
  };

  const handleCancelAppt = async (id: string) => {
    await api.cancelAppointment(id, 'Cancelled by Hospital Admin');
    loadTenantData(selectedHospitalId);
  };

  const handleResolveRec = async (id: string) => {
    await api.resolveReconciliation(id, 'Hospital Admin');
    loadTenantData(selectedHospitalId);
  };

  const openDoctorModal = (doc?: Doctor) => {
    setEditingDoctor(doc || null);
    if (doc) setDoctorForm({ name: doc.name, specialty: doc.specialty, department: doc.department, experienceYears: doc.experienceYears, consultationFee: doc.consultationFee || 150, externalProviderId: doc.externalProviderId, bio: doc.bio });
    else setDoctorForm({ name: '', specialty: '', department: '', experienceYears: 10, consultationFee: 150, externalProviderId: '', bio: '' });
    setShowDoctorModal(true);
  };

  const openDeptModal = (dept?: Department) => {
    setEditingDept(dept || null);
    if (dept) setDeptForm({ name: dept.name, description: dept.description, specialty: dept.specialty || '' });
    else setDeptForm({ name: '', description: '', specialty: '' });
    setShowDeptModal(true);
  };

  const handleSaveDoctor = async () => {
    try {
      if (editingDoctor) await api.updateDoctor(editingDoctor.id, doctorForm);
      else await api.createDoctor({ ...doctorForm, hospitalId: selectedHospitalId, status: 'Active', languages: ['English'], consultationTypes: ['in-person'], appointmentDurationMinutes: 30, qualifications: [], photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80' });
      setShowDoctorModal(false); loadTenantData(selectedHospitalId);
    } catch (e) { alert('Failed to save doctor'); }
  };

  const handleSaveDept = async () => {
    try {
      if (editingDept) await api.updateDepartment(editingDept.id, deptForm);
      else await api.createDepartment({ ...deptForm, hospitalId: selectedHospitalId });
      setShowDeptModal(false); loadTenantData(selectedHospitalId);
    } catch (e) { alert('Failed to save department'); }
  };

  const handleDeleteDoctor = async (id: string) => {
    if (!confirm('Remove this doctor?')) return;
    await api.deleteDoctor(id); loadTenantData(selectedHospitalId);
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    await api.deleteDepartment(id); loadTenantData(selectedHospitalId);
  };

  const statBox = (label: string, value: any, color: string) => (
    <div key={label} className="stat-card">
      <div className="stat-card-value" style={{ color }}>{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="info-row" key={label}><span className="info-label">{label}</span><span className="info-value">{value}</span></div>
  );

  const apptBadge = (status: string) => {
    const cls = status === 'Confirmed' ? 'badge-success' : status === 'Cancelled' ? 'badge-danger' : 'badge-warning';
    return <span className={`badge ${cls}`}>{status}</span>;
  };

  const sections: Record<SidebarSection, () => React.ReactNode> = {
    dashboard: () => (
      <div>
        <div className="section-header"><h2 className="section-title">🏠 Dashboard</h2><button className="btn btn-outline btn-sm" onClick={() => loadTenantData(selectedHospitalId)}>🔄</button></div>
        <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
          {statBox('Active Doctors', doctors.length, '#34d399')}
          {statBox('Total Appointments', appointments.length, '#38bdf8')}
          {statBox('Questionnaires', questionnaires.length, '#c084fc')}
          {statBox('Open Escalations', openRecs.length, openRecs.length > 0 ? '#f87171' : '#34d399')}
        </div>
        {currentHosp && (
          <div className="grid-cols-2" style={{ marginBottom: '2rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>🏥 {currentHosp.name}</h3>
              {infoRow('Status', <span className={`badge ${currentHosp.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{currentHosp.status}</span>)}
              {infoRow('Address', currentHosp.address)}
              {infoRow('Contact', currentHosp.contactEmail)}
              <div style={{ marginTop: '0.75rem' }}>
                <div className="form-label" style={{ marginBottom: '0.35rem' }}>Specialties</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>{currentHosp.specialties.map((s, i) => <span key={i} className="badge badge-info">{s}</span>)}</div>
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>📊 Recent Activity</h3>
              {appointments.slice(-5).reverse().map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span>🗓️</span>
                  <div style={{ flex: 1, fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600 }}>Appt {a.id.slice(-6)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(a.startTime).toLocaleString()}</div>
                  </div>
                  {apptBadge(a.status)}
                </div>
              ))}
              {appointments.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No appointments yet.</p>}
            </div>
          </div>
        )}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => { setActiveSection('doctors'); openDoctorModal(); }}>➕ Add Doctor</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setActiveSection('departments'); openDeptModal(); }}>➕ Add Department</button>
            <button className="btn btn-outline btn-sm" onClick={() => setActiveSection('appointments')}>📅 View Appointments</button>
            <button className="btn btn-outline btn-sm" onClick={() => setActiveSection('ehr')}>🔌 EHR Settings</button>
            <button className="btn btn-outline btn-sm" onClick={() => setActiveSection('audit')}>📜 Audit Logs</button>
          </div>
        </div>
      </div>
    ),

    profile: () => (
      <div>
        <div className="section-header"><h2 className="section-title">🏥 Hospital Profile</h2></div>
        {currentHosp ? (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem' }}>🏥</div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: '0.25rem' }}>{currentHosp.name}</h2>
                <span className={`badge ${currentHosp.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{currentHosp.status}</span>
              </div>
            </div>
            <div className="grid-cols-2">
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: '#38bdf8' }}>Contact Information</h4>
                {infoRow('Address', currentHosp.address)}
                {infoRow('Email', currentHosp.contactEmail)}
                {infoRow('Phone', currentHosp.contactPhone)}
                {currentHosp.operatingHours && infoRow('Hours', currentHosp.operatingHours.openTime + ' – ' + currentHosp.operatingHours.closeTime)}
              </div>
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: '#c084fc' }}>Clinical Capabilities</h4>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div className="form-label">Specialties</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>{currentHosp.specialties.map((s, i) => <span key={i} className="badge badge-info">{s}</span>)}</div>
                </div>
                <div>
                  <div className="form-label">EHR System</div>
                  <code style={{ color: '#38bdf8', display: 'block', marginTop: '0.35rem', fontSize: '0.82rem' }}>{currentHosp.integrationConfig.systemName}</code>
                </div>
              </div>
            </div>
          </div>
        ) : <div className="empty-state"><div className="empty-state-icon">🏥</div><p>Loading…</p></div>}
      </div>
    ),

    departments: () => (
      <div>
        <div className="section-header"><h2 className="section-title">🏢 Departments</h2><button className="btn btn-primary btn-sm" onClick={() => openDeptModal()}>➕ Add Department</button></div>
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Specialty</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {departments.map(dept => (
                <tr key={dept.id}>
                  <td style={{ fontWeight: 600 }}>{dept.name}</td>
                  <td><span className="badge badge-info">{dept.specialty || '—'}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: 300 }}>{dept.description}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openDeptModal(dept)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDept(dept.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {departments.length === 0 && <div className="empty-state"><div className="empty-state-icon">🏢</div><p>No departments configured.</p></div>}
        </div>
      </div>
    ),

    doctors: () => (
      <div>
        <div className="section-header"><h2 className="section-title">🩺 Doctors</h2><button className="btn btn-primary btn-sm" onClick={() => openDoctorModal()}>➕ Add Doctor</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1rem' }}>
          {doctors.map(doc => (
            <div key={doc.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1rem' }}>
              <img src={doc.photoUrl} alt={doc.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.95rem' }}>{doc.name}</h4>
                  <span className={`badge ${doc.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>{doc.status}</span>
                </div>
                <p style={{ color: '#38bdf8', fontSize: '0.8rem', margin: '0.25rem 0' }}>{doc.specialty} · {doc.department}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.6rem' }}>{doc.experienceYears}yr exp · ${doc.consultationFee}</p>
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openDoctorModal(doc)}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoctor(doc.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
          {doctors.length === 0 && <div className="empty-state"><div className="empty-state-icon">👨‍⚕️</div><p>No doctors registered.</p></div>}
        </div>
      </div>
    ),

    calendars: () => (
      <div>
        <div className="section-header"><h2 className="section-title">📅 Calendars & Availability</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {doctors.map(doc => {
            const docAppts = appointments.filter(a => a.doctorId === doc.id && a.status === 'Confirmed');
            return (
              <div key={doc.id} className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <img src={doc.photoUrl} alt={doc.name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{doc.name}</div><div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{doc.specialty}</div></div>
                  <span className="badge badge-info">{doc.appointmentDurationMinutes}min slots</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {docAppts.length > 0 ? docAppts.map(a => (
                    <span key={a.id} style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                      Booked: {new Date(a.startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )) : (
                    <span style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                      Available for booking
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Types: {doc.consultationTypes.join(' · ')}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),

    appointments: () => (
      <div>
        <div className="section-header">
          <h2 className="section-title">🗓️ Appointments</h2>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Total: <strong style={{ color: 'white' }}>{appointments.length}</strong> · Confirmed: <strong style={{ color: '#34d399' }}>{confirmedAppts.length}</strong></div>
        </div>
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Doctor</th><th>Patient</th><th>Date & Time</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {appointments.slice().reverse().map(appt => {
                const doc = doctors.find(d => d.id === appt.doctorId);
                return (
                  <tr key={appt.id}>
                    <td><code style={{ color: '#38bdf8', fontSize: '0.75rem' }}>{appt.id.slice(-8)}</code></td>
                    <td style={{ fontWeight: 600 }}>{doc?.name || appt.doctorId}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{appt.patientId}</td>
                    <td style={{ fontSize: '0.82rem' }}>{new Date(appt.startTime).toLocaleString()}</td>
                    <td><span className="tag">{appt.consultationType}</span></td>
                    <td>{apptBadge(appt.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => onOpenTrace(appt.correlationId)}>👁️</button>
                        {appt.status !== 'Cancelled' && <button className="btn btn-danger btn-sm" onClick={() => handleCancelAppt(appt.id)}>Cancel</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {appointments.length === 0 && <div className="empty-state"><div className="empty-state-icon">📅</div><p>No appointments.</p></div>}
        </div>
      </div>
    ),



    questionnaires: () => (
      <div>
        <div className="section-header"><h2 className="section-title">📋 Questionnaires</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questionnaires.map(q => (
            <div key={q.id} className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div><h4 style={{ fontWeight: 700 }}>{q.title}</h4><p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>{q.description}</p></div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <span className={`badge ${q.isActive ? 'badge-success' : 'badge-warning'}`}>{q.isActive ? 'Active' : 'Inactive'}</span>
                  {q.specialty && <span className="badge badge-info">{q.specialty}</span>}
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{q.questions.length} questions</div>
              {q.questions.map((item, idx) => (
                <div key={item.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '1.2rem' }}>{idx + 1}.</span>
                  <span>{item.question}</span>
                  {item.isRedFlagIndicator && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>🚨 Red Flag</span>}
                </div>
              ))}
            </div>
          ))}
          {questionnaires.length === 0 && <div className="empty-state"><div className="empty-state-icon">📝</div><p>No questionnaires.</p></div>}
        </div>
      </div>
    ),

    ehr: () => (
      <div>
        <div className="section-header"><h2 className="section-title">🔗 Healthcare System / Mock EHR</h2></div>
        {currentHosp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Connected EHR System</h3>
              {infoRow('System Name', <strong>{currentHosp.integrationConfig.systemName}</strong>)}
              {infoRow('Endpoint', <code style={{ color: '#38bdf8', fontSize: '0.78rem', wordBreak: 'break-all' }}>{currentHosp.integrationConfig.endpointUrl}</code>)}
              {infoRow('Status', <span className="badge badge-success">Online · Verified</span>)}
            </div>
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(245,158,11,0.3)' }}>
              <h3 style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.5rem' }}>⚡ Fault Injection (PRD §28)</h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Simulate EHR failure scenarios to validate auto-recovery pipelines.</p>
              <div className="form-group">
                <label className="form-label">Active Integration Mode</label>
                <select className="form-select" value={currentMode} onChange={e => handleSetMode(e.target.value as IntegrationMode)}>
                  <option value="NORMAL">Normal — Direct EHR Verification</option>
                  <option value="OPTION_A_TIMEOUT_RETRY">Option A — EHR Timeout & Auto-Retry</option>
                  <option value="OPTION_B_UNKNOWN_OUTCOME">Option B — Unknown Outcome & Deduplicated Sync</option>
                  <option value="OPTION_C_UNRECOVERABLE">Option C — Retries Exhausted & Human Escalation</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    ),

    audit: () => (
      <div>
        <div className="section-header"><h2 className="section-title">📜 Audit Logs</h2><button className="btn btn-outline btn-sm" onClick={() => loadTenantData(selectedHospitalId)}>🔄</button></div>
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
            <tbody>
              {auditLogs.slice().reverse().slice(0, 50).map((log: any) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td><span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{log.actorRole}</span></td>
                  <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{log.action}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{log.entityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditLogs.length === 0 && <div className="empty-state"><div className="empty-state-icon">📜</div><p>No audit events yet.</p></div>}
        </div>
      </div>
    ),

    notifications: () => (
      <div>
        <div className="section-header"><h2 className="section-title">🔔 Notifications</h2></div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {[
            { type: 'info', msg: `${doctors.length} active doctors registered in this hospital.` },
            ...(openRecs.length > 0 ? [{ type: 'warning', msg: `${openRecs.length} open reconciliation records require review.` }] : []),
            { type: 'success', msg: 'EHR Integration is online and verified.' },
            { type: 'info', msg: `${confirmedAppts.length} appointments confirmed.` },
          ].map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem', borderRadius: '8px', background: n.type === 'warning' ? 'rgba(245,158,11,0.06)' : n.type === 'success' ? 'rgba(16,185,129,0.06)' : 'rgba(6,182,212,0.06)', border: `1px solid ${n.type === 'warning' ? 'rgba(245,158,11,0.2)' : n.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(6,182,212,0.2)'}`, marginBottom: '0.5rem', alignItems: 'center' }}>
              <span>{n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : 'ℹ️'}</span>
              <p style={{ fontSize: '0.85rem' }}>{n.msg}</p>
            </div>
          ))}
        </div>
      </div>
    ),

    analytics: () => {
      const bySpec: Record<string, number> = {};
      doctors.forEach(d => { bySpec[d.specialty] = (bySpec[d.specialty] || 0) + 1; });
      return (
        <div>
          <div className="section-header"><h2 className="section-title">📊 System Analytics</h2></div>
          <div className="grid-cols-3" style={{ marginBottom: '1.5rem' }}>
            {statBox('Total Appointments', appointments.length, '#34d399')}
            {statBox('Confirmed Rate', `${appointments.length > 0 ? Math.round((confirmedAppts.length / appointments.length) * 100) : 0}%`, '#38bdf8')}
            {statBox('Avg Fee', doctors.length > 0 ? `$${Math.round(doctors.reduce((a, d) => a + (d.consultationFee || 0), 0) / doctors.length)}` : '$0', '#c084fc')}
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Doctor Distribution by Specialty</h3>
            {Object.entries(bySpec).map(([spec, count]) => (
              <div key={spec} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.83rem' }}>
                  <span>{spec}</span><span style={{ color: 'var(--text-muted)' }}>{count} doctor{count > 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / Math.max(doctors.length, 1)) * 100}%`, background: 'linear-gradient(90deg,#10b981,#06b6d4)', borderRadius: 4 }} />
                </div>
              </div>
            ))}
            {Object.keys(bySpec).length === 0 && <p style={{ color: 'var(--text-muted)' }}>No doctors registered yet.</p>}
          </div>
        </div>
      );
    },

    reconciliation: () => (
      <div>
        <div className="section-header">
          <h2 className="section-title">⚠️ Reconciliation Records</h2>
          <span className={`badge ${openRecs.length > 0 ? 'badge-danger' : 'badge-success'}`}>{openRecs.length > 0 ? `${openRecs.length} open` : 'All resolved'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reconciliations.map(r => (
            <div key={r.id} className="glass-panel" style={{ padding: '1.25rem', border: `1px solid ${r.isResolved ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.25)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span className={`badge ${r.isResolved ? 'badge-success' : 'badge-danger'}`}>{r.failureType}</span>
                    <strong>Ticket #{r.id.slice(-8)}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <p style={{ color: r.isResolved ? 'var(--text-secondary)' : '#fca5a5', fontSize: '0.85rem', marginBottom: '0.2rem' }}>{r.reason}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Rec: {r.recommendedAction}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => onOpenTrace(r.correlationId)}>👁️ Trace</button>
                  {!r.isResolved
                    ? <button className="btn btn-primary btn-sm" onClick={() => handleResolveRec(r.id)}>✓ Resolve</button>
                    : <span className="badge badge-success">✓ {r.resolvedBy}</span>}
                </div>
              </div>
            </div>
          ))}
          {reconciliations.length === 0 && <div className="empty-state"><div className="empty-state-icon">✅</div><p>No records. System fully synchronized.</p></div>}
        </div>
      </div>
    ),

    settings: () => (
      <div>
        <div className="section-header"><h2 className="section-title">⚙️ Settings</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Hospital Tenant</h3>
            <div className="form-group">
              <label className="form-label">Switch Hospital Tenant</label>
              <select className="form-select" value={selectedHospitalId} onChange={e => setSelectedHospitalId(e.target.value)}>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} ({h.status})</option>)}
              </select>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Each hospital operates as a fully isolated tenant with its own data partition.</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>🔒 Tenant Isolation (PRD §8 & §21)</h3>
            <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <strong style={{ color: '#34d399' }}>🛡️ Tenant Boundary Enforced</strong>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                All queries scoped to <code style={{ color: '#38bdf8' }}>hospitalId = {selectedHospitalId}</code>. No cross-tenant access possible.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>🛡️ Tenant Isolated</div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem' }}>Hospital Admin</div>
          <select style={{ width: '100%', background: 'rgba(15,23,42,0.8)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.35rem 0.6rem', fontSize: '0.78rem' }} value={selectedHospitalId} onChange={e => setSelectedHospitalId(e.target.value)}>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        {NAV_ITEMS.map(item => (
          <React.Fragment key={item.id}>
            {item.section && <div className="admin-sidebar-section-label">{item.section}</div>}
            <button className={`admin-sidebar-item ${activeSection === item.id ? 'active' : ''}`} onClick={() => setActiveSection(item.id)}>
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'reconciliation' && openRecs.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', borderRadius: '9999px', fontSize: '0.65rem', padding: '0.1rem 0.45rem', fontWeight: 700 }}>{openRecs.length}</span>
              )}
            </button>
          </React.Fragment>
        ))}
      </aside>
      <main className="admin-content">{sections[activeSection]()}</main>

      {showDoctorModal && (
        <div className="modal-overlay" onClick={() => setShowDoctorModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700 }}>{editingDoctor ? '✏️ Edit Doctor' : '➕ Add Doctor'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowDoctorModal(false)}>✕</button>
            </div>
            <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={doctorForm.name} onChange={e => setDoctorForm(f => ({...f, name: e.target.value}))} placeholder="Dr. First Last" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Specialty *</label><input className="form-input" value={doctorForm.specialty} onChange={e => setDoctorForm(f => ({...f, specialty: e.target.value}))} placeholder="e.g. Cardiology" /></div>
              <div className="form-group"><label className="form-label">Department *</label><select className="form-select" value={doctorForm.department} onChange={e => setDoctorForm(f => ({...f, department: e.target.value}))}><option value="">Select</option>{departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Experience (yrs)</label><input className="form-input" type="number" value={doctorForm.experienceYears} onChange={e => setDoctorForm(f => ({...f, experienceYears: Number(e.target.value)}))} /></div>
              <div className="form-group"><label className="form-label">Fee ($)</label><input className="form-input" type="number" value={doctorForm.consultationFee} onChange={e => setDoctorForm(f => ({...f, consultationFee: Number(e.target.value)}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">External Provider ID</label><input className="form-input" value={doctorForm.externalProviderId} onChange={e => setDoctorForm(f => ({...f, externalProviderId: e.target.value}))} placeholder="EHR-PRV-XXXX-000" /></div>
            <div className="form-group"><label className="form-label">Bio</label><textarea className="form-textarea" rows={3} value={doctorForm.bio} onChange={e => setDoctorForm(f => ({...f, bio: e.target.value}))} /></div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowDoctorModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveDoctor}>{editingDoctor ? 'Save Changes' : 'Add Doctor'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeptModal && (
        <div className="modal-overlay" onClick={() => setShowDeptModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700 }}>{editingDept ? '✏️ Edit Department' : '➕ Add Department'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowDeptModal(false)}>✕</button>
            </div>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={deptForm.name} onChange={e => setDeptForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Cardiology Wing" /></div>
            <div className="form-group"><label className="form-label">Specialty</label><input className="form-input" value={deptForm.specialty} onChange={e => setDeptForm(f => ({...f, specialty: e.target.value}))} placeholder="e.g. Cardiology" /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" rows={3} value={deptForm.description} onChange={e => setDeptForm(f => ({...f, description: e.target.value}))} /></div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowDeptModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveDept}>{editingDept ? 'Save Changes' : 'Add Department'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
