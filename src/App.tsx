import React, { useState, useEffect } from 'react';
import { UserRole } from './types/index.js';
import { PatientDashboard } from './views/PatientDashboard.js';
import { DoctorDashboard } from './views/DoctorDashboard.js';
import { HospitalAdminDashboard } from './views/HospitalAdminDashboard.js';
import { PlatformAdminDashboard } from './views/PlatformAdminDashboard.js';
import { TelephoneSimulatorModal } from './components/telephone/TelephoneSimulatorModal.js';
import { CorrelationTraceModal } from './components/trace/CorrelationTraceModal.js';
import { 
  Activity, 
  Phone, 
  User, 
  Stethoscope, 
  Building2, 
  ShieldCheck, 
  Radio
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeRole, setActiveRole] = useState<UserRole>('Patient');
  const [showTelephoneModal, setShowTelephoneModal] = useState<boolean>(false);
  const [inspectCorrelationId, setInspectCorrelationId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Establish real-time WebSocket connection to backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => setWsConnected(true);
      socket.onclose = () => setWsConnected(false);
      socket.onerror = () => setWsConnected(false);
    } catch (e) {
      console.warn('WebSocket connection not initialized yet');
    }

    return () => {
      if (socket) socket.close();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header & Global Role Switcher */}
      <header className="app-header">
        <div className="brand-logo">
          <div className="brand-icon">
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              OmniHealth AI
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Multi-Hospital Intake & AI Operations Platform
            </div>
          </div>
        </div>

        {/* 4 Role Switcher Tabs (PRD Section 4 & 18) */}
        <nav className="role-nav">
          <button 
            className={`role-tab ${activeRole === 'Patient' ? 'active' : ''}`}
            onClick={() => setActiveRole('Patient')}
          >
            <User size={15} /> Patient Portal
          </button>
          <button 
            className={`role-tab ${activeRole === 'Doctor' ? 'active' : ''}`}
            onClick={() => setActiveRole('Doctor')}
          >
            <Stethoscope size={15} /> Doctor Portal
          </button>
          <button 
            className={`role-tab ${activeRole === 'HospitalAdmin' ? 'active' : ''}`}
            onClick={() => setActiveRole('HospitalAdmin')}
          >
            <Building2 size={15} /> Hospital Admin
          </button>
          <button 
            className={`role-tab ${activeRole === 'PlatformAdmin' ? 'active' : ''}`}
            onClick={() => setActiveRole('PlatformAdmin')}
          >
            <ShieldCheck size={15} /> Platform Admin
          </button>
        </nav>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={() => setShowTelephoneModal(true)}
            className="btn btn-outline"
            style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#38bdf8', fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
          >
            <Phone size={15} /> Inbound Phone Simulator
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: wsConnected ? '#34d399' : '#f59e0b' }}>
            <Radio size={14} className={wsConnected ? 'animate-pulse' : ''} />
            <span>{wsConnected ? 'Streaming WS Online' : 'Connecting WS'}</span>
          </div>
        </div>
      </header>

      {/* Active View Container */}
      <main style={{ flex: 1 }}>
        {activeRole === 'Patient' && (
          <PatientDashboard onOpenTrace={(corrId) => setInspectCorrelationId(corrId)} />
        )}
        {activeRole === 'Doctor' && (
          <DoctorDashboard onOpenTrace={(corrId) => setInspectCorrelationId(corrId)} />
        )}
        {activeRole === 'HospitalAdmin' && (
          <HospitalAdminDashboard onOpenTrace={(corrId) => setInspectCorrelationId(corrId)} />
        )}
        {activeRole === 'PlatformAdmin' && (
          <PlatformAdminDashboard onOpenTrace={(corrId) => setInspectCorrelationId(corrId)} />
        )}
      </main>

      {/* Inbound Telephone Call Simulator Modal (PRD Section 11) */}
      {showTelephoneModal && (
        <TelephoneSimulatorModal onClose={() => setShowTelephoneModal(false)} />
      )}

      {/* End-to-End Correlation Trace Inspector Modal (PRD Section 19) */}
      {inspectCorrelationId && (
        <CorrelationTraceModal 
          correlationId={inspectCorrelationId} 
          onClose={() => setInspectCorrelationId(null)} 
        />
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.25rem 2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        OmniHealth AI • Autonomous Multi-Hospital Patient Intake, Scheduling & Pre-Visit Voice Agent • Version 2.0
      </footer>

    </div>
  );
};
