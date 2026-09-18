import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Doctor, Appointment, QuestionnaireResponse, TimeSlot, Hospital } from '../types/index.js';
import { Calendar, Clock, AlertTriangle, ShieldAlert, CheckCircle2, User, Lock, Plus, Trash2, Building2 } from 'lucide-react';

interface DoctorDashboardProps {
  onOpenTrace: (correlationId: string) => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ onOpenTrace }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('doc-1');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [questionnaireResponses, setQuestionnaireResponses] = useState<QuestionnaireResponse[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'schedule' | 'intake' | 'availability'>('schedule');

  // New Blocked Slot form state
  const [blockReason, setBlockReason] = useState('Operating Room Surgery Block');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    if (selectedDoctorId) {
      loadDoctorData(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  const loadDoctors = async () => {
    try {
      const [docs, hosps] = await Promise.all([
        api.getDoctors(),
        api.getHospitals()
      ]);
      const uniqueDocs = Array.from(new Map(docs.map(d => [d.name, d])).values());
      setDoctors(uniqueDocs);
      setHospitals(hosps);
      if (uniqueDocs.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(uniqueDocs[0].id);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  };

  const loadDoctorData = async (docId: string) => {
    try {
      const [appts, responses, calData] = await Promise.all([
        api.getAppointments(undefined, docId),
        api.getQuestionnaireResponses(undefined, docId),
        api.getDoctorCalendar(docId)
      ]);
      setAppointments(appts);
      setQuestionnaireResponses(responses);
      setBlockedSlots(calData.blockedSlots || []);
    } catch (err) {
      console.error('Failed to load doctor data:', err);
    }
  };

  const handleAddBlockedSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockStart || !blockEnd) {
      alert('Please select start and end times');
      return;
    }

    try {
      await api.addBlockedSlot(selectedDoctorId, new Date(blockStart).toISOString(), new Date(blockEnd).toISOString(), blockReason);
      alert('Blocked period saved! The AI scheduling engine will strictly honor this block.');
      setBlockStart('');
      setBlockEnd('');
      loadDoctorData(selectedDoctorId);
    } catch (err) {
      alert('Failed to add blocked time');
    }
  };

  const handleDeleteBlockedSlot = async (id: string) => {
    try {
      await api.deleteBlockedSlot(id);
      loadDoctorData(selectedDoctorId);
    } catch (err) {
      alert('Failed to remove block');
    }
  };

  const currentDoc = doctors.find(d => d.id === selectedDoctorId);

  return (
    <div className="container">
      {/* Header & Doctor Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Doctor Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Clinical Schedule, Pre-Visit Intake Charts & Availability Management
          </p>
        </div>

        {/* Doctor Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Physician:</span>
          <select 
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              color: 'white',
              border: '1px solid var(--border-color)',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600
            }}
          >
            {doctors.map(d => {
              const hospName = hospitals.find(h => h.id === d.hospitalId)?.name || 'Unknown Hospital';
              return (
                <option key={d.id} value={d.id}>{d.name} - {hospName} ({d.specialty})</option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Doctor Summary Banner */}
      {currentDoc && (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img 
              src={currentDoc.photoUrl} 
              alt={currentDoc.name} 
              style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #06b6d4' }} 
            />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{currentDoc.name}</h3>
              <p style={{ color: '#38bdf8', fontSize: '0.85rem', marginBottom: '0.2rem' }}>{currentDoc.specialty} • {currentDoc.department}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Building2 size={12} /> {hospitals.find(h => h.id === currentDoc.hospitalId)?.name || 'Unknown Hospital'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
              <span className="badge badge-success">{currentDoc.status}</span>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>External Provider ID</div>
              <code style={{ color: '#34d399', fontSize: '0.85rem' }}>{currentDoc.externalProviderId}</code>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`btn ${activeTab === 'schedule' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Calendar size={16} /> Appointments Schedule ({appointments.length})
        </button>
        <button 
          onClick={() => setActiveTab('intake')}
          className={`btn ${activeTab === 'intake' ? 'btn-primary' : 'btn-outline'}`}
        >
          <AlertTriangle size={16} /> Pre-Visit Intake Charts ({questionnaireResponses.length})
        </button>
        <button 
          onClick={() => setActiveTab('availability')}
          className={`btn ${activeTab === 'availability' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Lock size={16} /> Doctor Blocked Time ({blockedSlots.length})
        </button>
      </div>

      {/* TAB 1: SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Today's & Upcoming Consultations</h3>
          {appointments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No appointments booked for this physician yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem' }}>Time</th>
                    <th style={{ padding: '0.75rem' }}>Patient</th>
                    <th style={{ padding: '0.75rem' }}>Reason / Symptoms</th>
                    <th style={{ padding: '0.75rem' }}>Type</th>
                    <th style={{ padding: '0.75rem' }}>EHR Reference</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(appt => (
                    <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                        {new Date(appt.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <strong>Patient #{appt.patientId.replace('pat-', '')}</strong>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                        {appt.reasonForVisit}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-info">{appt.consultationType}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <code style={{ color: '#34d399' }}>{appt.externalAppointmentId || 'Pending'}</code>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${appt.status === 'Confirmed' ? 'badge-success' : appt.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                          {appt.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button 
                          onClick={() => onOpenTrace(appt.correlationId)}
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          Trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRE-VISIT INTAKE */}
      {activeTab === 'intake' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questionnaireResponses.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No pre-visit questionnaire responses completed yet.
            </div>
          ) : (
            questionnaireResponses.map(resp => (
              <div 
                key={resp.id}
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  borderLeft: resp.hasRedFlags ? '4px solid #ef4444' : '4px solid #10b981'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Pre-Visit Intake: Patient {resp.patientId}</h4>
                      {resp.hasRedFlags ? (
                        <span className="badge badge-danger">🚨 CLINICAL RED FLAGS DETECTED</span>
                      ) : (
                        <span className="badge badge-success">✓ Cleared for Routine Consult</span>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      Appointment Reference: <code>{resp.appointmentId}</code> • Submitted at {new Date(resp.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {resp.redFlagNotes && resp.redFlagNotes.length > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                    <strong>Clinical Safety Alert:</strong>
                    {resp.redFlagNotes.map((note, idx) => (
                      <div key={idx}>• {note}</div>
                    ))}
                  </div>
                )}

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Patient Responses:</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                    {Object.entries(resp.answers).map(([key, val]) => (
                      <div key={key}>
                        <span style={{ color: 'var(--text-muted)' }}>{key}:</span> <strong>{String(val)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: AVAILABILITY & BLOCKED TIME */}
      {activeTab === 'availability' && (
        <div className="grid-cols-2">
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Add Blocked Period (Surgery / Leave)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              The central scheduling service will automatically remove these hours from real availability calculations.
            </p>

            <form onSubmit={handleAddBlockedSlot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Reason for Block</label>
                <input 
                  type="text" 
                  value={blockReason} 
                  onChange={e => setBlockReason(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Block Start Time</label>
                <input 
                  type="datetime-local" 
                  value={blockStart} 
                  onChange={e => setBlockStart(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Block End Time</label>
                <input 
                  type="datetime-local" 
                  value={blockEnd} 
                  onChange={e => setBlockEnd(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <Plus size={16} /> Block Out Schedule
              </button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Active Blocked Periods</h3>
            {blockedSlots.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No blocked time periods recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {blockedSlots.map(b => (
                  <div key={b.id} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', padding: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fca5a5', fontSize: '0.9rem' }}>{b.reason}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {new Date(b.startTime).toLocaleString()} — {new Date(b.endTime).toLocaleString()}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteBlockedSlot(b.id)}
                      className="btn btn-danger"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
