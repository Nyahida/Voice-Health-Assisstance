import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Doctor, TimeSlot, Appointment, Questionnaire } from '../types/index.js';
import { VoiceWaveform } from '../components/voice/VoiceWaveform.js';
import { 
  Mic, 
  MicOff, 
  Send, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Hospital, 
  RotateCcw,
  Sparkles,
  Search
} from 'lucide-react';

interface PatientDashboardProps {
  onOpenTrace: (correlationId: string) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ onOpenTrace }) => {
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; correlationId?: string }>>([
    {
      role: 'assistant',
      text: "Hello! I am your AI Patient Access Assistant. How can I help you today? You can say: 'I need to see a doctor for a skin rash this week' or 'Check Cardiology appointments'."
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState(`conv-${Date.now()}`);
  const [patientId] = useState('pat-1'); // John Doe

  // Dynamic Data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<Questionnaire | null>(null);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, any>>({});
  const [submittingQ, setSubmittingQ] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    loadData(false);
  }, []);

  const loadData = async (fetchAppointments = false) => {
    try {
      const [docs, quests] = await Promise.all([
        api.getDoctors(),
        api.getQuestionnaires('hosp-1')
      ]);
      setDoctors(docs);
      
      if (fetchAppointments) {
        const appts = await api.getAppointments(undefined, undefined, patientId);
        setAppointments(appts);
      }

      if (quests && quests.length > 0) {
        setActiveQuestionnaire(quests[0]);
      }
    } catch (err) {
      console.error('Failed to load patient data:', err);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onstart = () => setVoiceStatus('speaking');
      utterance.onend = () => setVoiceStatus('idle');
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleVoice = () => {
    // If speaking, barge-in!
    if (voiceStatus === 'speaking') {
      window.speechSynthesis.cancel();
      setVoiceStatus('idle');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech Recognition API is not supported in this browser. Please type your message.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setVoiceStatus('listening');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      handleSendTurn(transcript);
    };

    recognition.onerror = () => {
      setVoiceStatus('idle');
    };

    recognition.onend = () => {
      if (voiceStatus === 'listening') {
        setVoiceStatus('idle');
      }
    };

    recognition.start();
  };

  const handleSendTurn = async (messageText?: string) => {
    const textToSend = messageText || inputText;
    if (!textToSend.trim()) return;

    setInputText('');
    setChatMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setVoiceStatus('thinking');

    try {
      const res = await api.sendAiTurn(textToSend, conversationId, patientId);
      setVoiceStatus('idle');

      setChatMessages(prev => [
        ...prev, 
        { role: 'assistant', text: res.reply, correlationId: res.correlationId }
      ]);

      speakText(res.audioSpeakText || res.reply);
      loadData(true); // Refresh bookings & slots
    } catch (err) {
      console.error('Turn failed:', err);
      setVoiceStatus('idle');
      setChatMessages(prev => [
        ...prev, 
        { role: 'assistant', text: 'I encountered an error connecting to the server. Please try again.' }
      ]);
    }
  };

  const handleDirectBook = async (slot: TimeSlot, doc: Doctor) => {
    try {
      setBookingLoading(true);
      const res = await api.createAppointment(slot.id, patientId, `Direct consultation with ${doc.name}`);
      if (res.success) {
        alert(`Appointment confirmed! EHR External Reference: ${res.externalAppointmentId}`);
        loadData(true);
      } else {
        alert(`Booking failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Booking error: ${err.message}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.cancelAppointment(apptId, 'Patient requested cancellation');
      loadData(true);
    } catch (err) {
      alert('Failed to cancel appointment');
    }
  };

  const handleSubmitQuestionnaire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestionnaire || appointments.length === 0) return;

    try {
      setSubmittingQ(true);
      const targetAppt = appointments[0];
      const res = await api.submitQuestionnaireResponse(
        activeQuestionnaire.id,
        targetAppt.id,
        questionnaireAnswers
      );

      if (res.hasRedFlags) {
        alert('⚠️ Notice: You reported symptoms that require clinical attention. Our medical staff has been notified.');
      } else {
        alert('✅ Pre-visit questionnaire submitted successfully to your doctor!');
      }
    } catch (err) {
      alert('Error submitting questionnaire');
    } finally {
      setSubmittingQ(false);
    }
  };

  return (
    <div className="container">
      {/* Top Banner */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome, John</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Multi-Hospital Patient Intake, Natural Voice Scheduling & Pre-Visit Care
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span className="badge badge-success">● AI Voice Engine Online</span>
          <span className="badge badge-info">● Multi-Tenant Connected</span>
        </div>
      </div>

      <div className="grid-cols-3">
        
        {/* Left 2 Cols: Interactive Voice & Conversational Intake */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Real-time Voice Intake Card */}
          <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="brand-icon" style={{ width: '32px', height: '32px' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Autonomous Patient Intake Voice Agent</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sub-2s latency • Turn-taking • Barge-in interruption</p>
                </div>
              </div>
              <button 
                onClick={handleToggleVoice}
                className="btn btn-primary"
                style={{ 
                  borderRadius: '9999px',
                  background: voiceStatus === 'listening' ? '#ef4444' : voiceStatus === 'speaking' ? '#f59e0b' : undefined
                }}
              >
                {voiceStatus === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
                {voiceStatus === 'listening' ? 'Stop Listening' : voiceStatus === 'speaking' ? 'Interrupt / Barge-In' : 'Start Voice Conversation'}
              </button>
            </div>

            {/* Visualizer */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <VoiceWaveform status={voiceStatus} />
            </div>

            {/* Quick Utterance Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => handleSendTurn("I need to see a doctor for my skin rash sometime this week.")}
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
              >
                💬 "I need to see a doctor for my skin rash sometime this week."
              </button>
              <button 
                onClick={() => handleSendTurn("Actually, make that 10:00 AM")}
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
              >
                💬 "Actually, make that 10:00 AM"
              </button>
              <button 
                onClick={() => handleSendTurn("What medication should I take for my shoulder?")}
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              >
                🛡️ Test Safety: "What medication should I take?"
              </button>
              <button 
                onClick={() => handleSendTurn("Cancel my appointment please")}
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
              >
                ❌ "Cancel my appointment please"
              </button>
            </div>

            {/* Conversation Log */}
            <div style={{
              maxHeight: '280px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              paddingRight: '0.5rem',
              marginBottom: '1rem'
            }}>
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: msg.role === 'user' 
                      ? 'linear-gradient(135deg, #10b981, #059669)' 
                      : 'rgba(255,255,255,0.05)',
                    padding: '0.85rem 1.15rem',
                    borderRadius: '16px',
                    border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                    fontSize: '0.9rem',
                    lineHeight: 1.45
                  }}
                >
                  <div>{msg.text}</div>
                  {msg.correlationId && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => onOpenTrace(msg.correlationId!)}
                        style={{
                          background: 'rgba(6, 182, 212, 0.15)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          color: '#38bdf8',
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        🔍 View Audit Trace ({msg.correlationId.substring(0, 10)})
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Text Input Row */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendTurn(); }}
              style={{ display: 'flex', gap: '0.5rem' }}
            >
              <input
                type="text"
                placeholder="Ask about doctors, symptoms, or appointment slots..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button type="submit" className="btn btn-primary">
                <Send size={16} /> Send
              </button>
            </form>
          </div>

          {/* Doctor Discovery & Availability Cards */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hospital size={18} color="#10b981" /> Discovered Healthcare Specialists
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {doctors.map(doc => (
                <div 
                  key={doc.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <img 
                      src={doc.photoUrl} 
                      alt={doc.name} 
                      style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981' }} 
                    />
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>{doc.name}</h4>
                      <p style={{ color: '#34d399', fontSize: '0.85rem' }}>{doc.specialty}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{doc.department}</p>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{doc.bio}</p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ⏱️ {doc.appointmentDurationMinutes} mins
                    </span>
                    <button 
                      onClick={() => handleSendTurn(`Check availability for ${doc.name}`)}
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      Check Slots
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Col: My Appointments & Pre-Visit Questionnaire */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Active Appointments Card */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} color="#06b6d4" /> My Appointments
            </h3>

            {appointments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No booked appointments yet. Use the voice assistant on the left to schedule.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {appointments.map(appt => {
                  const doc = doctors.find(d => d.id === appt.doctorId);
                  return (
                    <div 
                      key={appt.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <strong>{doc?.name || 'Specialist'}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{doc?.specialty}</div>
                        </div>
                        <span className={`badge ${appt.status === 'Confirmed' ? 'badge-success' : appt.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                          {appt.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                        <Clock size={14} /> {new Date(appt.startTime).toLocaleString()}
                      </div>

                      {appt.externalAppointmentId && (
                        <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '0.5rem' }}>
                          ✓ EHR Verified: <code>{appt.externalAppointmentId}</code>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button 
                          onClick={() => onOpenTrace(appt.correlationId)}
                          className="btn btn-outline"
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.3rem' }}
                        >
                          Audit Trace
                        </button>
                        {appt.status === 'Confirmed' && (
                          <button 
                            onClick={() => handleCancelAppointment(appt.id)}
                            className="btn btn-danger"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pre-Visit Questionnaire Filler (PRD Section 15) */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="#8b5cf6" /> Pre-Visit Intake Questionnaire
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Fill this out or answer via voice agent to prepare your clinical chart for your doctor.
            </p>

            {activeQuestionnaire ? (
              <form onSubmit={handleSubmitQuestionnaire} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#c084fc' }}>
                  {activeQuestionnaire.title}
                </div>

                {activeQuestionnaire.questions.slice(0, 3).map((q) => (
                  <div key={q.id} style={{ fontSize: '0.85rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      {q.question} {q.isRedFlagIndicator && <span style={{ color: '#f87171' }}>*🚨</span>}
                    </label>
                    {q.type === 'yes_no' ? (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <input 
                            type="radio" 
                            name={q.id} 
                            value="no" 
                            onChange={() => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: 'no' }))} 
                          /> No
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: q.isRedFlagIndicator ? '#fca5a5' : 'inherit' }}>
                          <input 
                            type="radio" 
                            name={q.id} 
                            value="yes" 
                            onChange={() => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: 'yes' }))} 
                          /> Yes
                        </label>
                      </div>
                    ) : q.options ? (
                      <select 
                        style={{
                          width: '100%',
                          background: 'rgba(15,23,42,0.8)',
                          border: '1px solid var(--border-color)',
                          color: 'white',
                          padding: '0.4rem',
                          borderRadius: '6px'
                        }}
                        onChange={(e) => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      >
                        <option value="">Select option...</option>
                        {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        placeholder="Your answer..."
                        style={{
                          width: '100%',
                          background: 'rgba(15,23,42,0.8)',
                          border: '1px solid var(--border-color)',
                          color: 'white',
                          padding: '0.4rem',
                          borderRadius: '6px'
                        }}
                        onChange={(e) => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ marginTop: '0.5rem', width: '100%' }}
                  disabled={submittingQ}
                >
                  {submittingQ ? 'Submitting...' : 'Submit Pre-Visit Intake'}
                </button>
              </form>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No active questionnaire assigned.</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
