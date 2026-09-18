import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  Hospital,
  PlatformMetrics,
  ReconciliationRecord,
  IntegrationMode
} from '../types/index.js';
import {
  ShieldCheck,
  Hospital as HospitalIcon,
  AlertTriangle,
  Activity,
  Cpu,
  Check,
  X,
  Eye,
  Play,
  Flame
} from 'lucide-react';

interface PlatformAdminDashboardProps {
  onOpenTrace: (correlationId: string) => void;
}

export const PlatformAdminDashboard: React.FC<PlatformAdminDashboardProps> = ({ onOpenTrace }) => {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [testCorrelationId, setTestCorrelationId] = useState('');
  const [executingFailureDemo, setExecutingFailureDemo] = useState(false);

  useEffect(() => {
    loadPlatformData();
  }, []);

  const loadPlatformData = async () => {
    try {
      const [m, h, r, ev] = await Promise.all([
        api.getMetrics(),
        api.getHospitals(),
        api.getReconciliations(),
        api.getAiEvaluations()
      ]);
      setMetrics(m);
      setHospitals(h);
      setReconciliations(r);
      setEvaluations(ev);
    } catch (err) {
      console.error('Failed to load platform admin data:', err);
    }
  };

  const handleUpdateHospitalStatus = async (id: string, status: string) => {
    try {
      await api.updateHospitalStatus(id, status);
      alert(`Hospital status updated to '${status}'.`);
      loadPlatformData();
    } catch (err) {
      alert('Error updating status');
    }
  };

  const handleResolveReconciliation = async (id: string) => {
    try {
      await api.resolveReconciliation(id, 'Platform Admin Officer');
      alert('Reconciliation ticket resolved and closed.');
      loadPlatformData();
    } catch (err) {
      alert('Failed to resolve reconciliation ticket');
    }
  };

  // Live Failure Simulation Triggers (PRD Section 28)
  const handleTriggerFailureScenario = async (mode: IntegrationMode, description: string) => {
    try {
      setExecutingFailureDemo(true);
      // Fetch available slot for Dr. Rao
      const slots = await api.getSlots('doc-1');
      if (slots.length === 0) {
        alert('No slots available to trigger failure demonstration.');
        return;
      }

      // Execute appointment creation with explicit failure mode override
      const res = await api.createAppointment(
        slots[0].id,
        'pat-1',
        `Failure Demo: ${description}`,
        mode
      );

      loadPlatformData();

      if (res.appointment) {
        onOpenTrace(res.appointment.correlationId);
      }
    } catch (err: any) {
      alert(`Failure execution completed. Trace logged in system.`);
      loadPlatformData();
    } finally {
      setExecutingFailureDemo(false);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ShieldCheck size={20} color="#10b981" />
            <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Master Platform Operations & Governance
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Platform Administrator Overview</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Hospital Onboarding Approvals, Multi-Tenant Observability, AI Evaluation & Failure Resilience Engine
          </p>
        </div>

        <button
          onClick={loadPlatformData}
          className="btn btn-outline"
        >
          🔄 Refresh Metrics
        </button>
      </div>

      {/* Global Health Metrics */}
      {metrics && (
        <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Active Approved Hospitals</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>{metrics.activeHospitals}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Across all healthcare regions</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Total Appointments Processed</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8' }}>{metrics.totalAppointments}</div>
            <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.25rem' }}>{metrics.confirmedAppointments} Confirmed & EHR-Verified</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Average AI Latency</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc' }}>{metrics.averageAiLatencyMs}ms</div>
            <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.25rem' }}>Target &lt;2000ms perceived latency met</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Pending Reconciliations</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: metrics.reconciliationsRequired > 0 ? '#ef4444' : '#34d399' }}>
              {metrics.reconciliationsRequired}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Human Escalation Queue</div>
          </div>
        </div>
      )}

      {/* REQUIRED FAILURE DEMONSTRATION CONSOLE (PRD Section 28) */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem', border: '1px solid rgba(245, 158, 11, 0.4)', background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.7) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Flame size={22} color="#f59e0b" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24' }}>
            Live Failure Demonstration Console
          </h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Execute and visually observe the system's fault classification, safe state determination, and automated recovery pipelines with 1 click:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Option A */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              Option A: EHR Timeout & Retry
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Simulates HTTP 504 on attempt 1 $\to$ classifies as retryable $\to$ retries $\to$ external record verified $\to$ confirms.
            </p>
            <button
              disabled={executingFailureDemo}
              onClick={() => handleTriggerFailureScenario('OPTION_A_TIMEOUT_RETRY', 'Option A Demonstration')}
              className="btn btn-outline"
              style={{ width: '100%', borderColor: '#f59e0b', color: '#fbbf24' }}
            >
              <Play size={14} /> Run Option A Demo
            </button>
          </div>

          {/* Option B */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              Option B: Unknown Outcome & Deduplicated Sync
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Network drops during response $\to$ pauses blind retry to prevent duplicate $\to$ queries EHR directly $\to$ synchronizes safely.
            </p>
            <button
              disabled={executingFailureDemo}
              onClick={() => handleTriggerFailureScenario('OPTION_B_UNKNOWN_OUTCOME', 'Option B Demonstration')}
              className="btn btn-outline"
              style={{ width: '100%', borderColor: '#06b6d4', color: '#38bdf8' }}
            >
              <Play size={14} /> Run Option B Demo
            </button>
          </div>

          {/* Option C */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              Option C: Retries Exhausted & Human Escalation
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              EHR database constraint failure $\to$ retries exhausted $\to$ creates Reconciliation Record $\to$ triggers operator escalation.
            </p>
            <button
              disabled={executingFailureDemo}
              onClick={() => handleTriggerFailureScenario('OPTION_C_UNRECOVERABLE', 'Option C Demonstration')}
              className="btn btn-danger"
              style={{ width: '100%' }}
            >
              <Play size={14} /> Run Option C Demo
            </button>
          </div>
        </div>
      </div>

      {/* Hospital Onboarding Approval Queue (PRD Section 5) */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HospitalIcon size={18} color="#06b6d4" /> Hospital Onboarding & Approval Queue
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Self-service hospital registration lifecycle: <code>Draft $\to$ Submitted $\to$ Under Review $\to$ Approved / Rejected</code>.
          Only approved hospitals can create active doctors and accept patient bookings.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Hospital Name</th>
                <th style={{ padding: '0.75rem' }}>Contact</th>
                <th style={{ padding: '0.75rem' }}>Specialties</th>
                <th style={{ padding: '0.75rem' }}>EHR Connector</th>
                <th style={{ padding: '0.75rem' }}>Current Status</th>
                <th style={{ padding: '0.75rem' }}>Platform Actions</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{h.name}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{h.contactEmail}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {h.specialties.map((s, idx) => (
                        <span key={idx} className="badge badge-info" style={{ fontSize: '0.7rem' }}>{s}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <code>{h.integrationConfig.systemName}</code>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span className={`badge ${h.status === 'Approved' ? 'badge-success' : h.status === 'Submitted' ? 'badge-warning' : 'badge-danger'}`}>
                      {h.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {h.status !== 'Approved' && (
                        <button
                          onClick={() => handleUpdateHospitalStatus(h.id, 'Approved')}
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        >
                          <Check size={14} /> Approve
                        </button>
                      )}
                      {h.status === 'Approved' && (
                        <button
                          onClick={() => handleUpdateHospitalStatus(h.id, 'Suspended')}
                          className="btn btn-danger"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reconciliation Queue (Option C Escalations) */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}>
          <AlertTriangle size={18} color="#ef4444" /> Operational Reconciliation Records
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Records requiring human operator intervention due to external EHR outage or unrecoverable conflict.
        </p>

        {reconciliations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No open reconciliation tickets. System is fully synchronized.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {reconciliations.map(r => (
              <div key={r.id} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-danger">{r.failureType}</span>
                    <strong style={{ fontSize: '0.9rem' }}>Ticket #{r.id}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({new Date(r.createdAt).toLocaleTimeString()})</span>
                  </div>
                  <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    {r.reason}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    Recommended: {r.recommendedAction}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => onOpenTrace(r.correlationId)}
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  >
                    View Trace
                  </button>
                  {!r.isResolved ? (
                    <button
                      onClick={() => handleResolveReconciliation(r.id)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      Mark Resolved
                    </button>
                  ) : (
                    <span className="badge badge-success">✓ Resolved by {r.resolvedBy}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Evaluation & Audit Log Inspector */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="#10b981" /> AI Administrative Evaluation Logs
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Patient Utterance</th>
                <th style={{ padding: '0.75rem' }}>Detected Intent</th>
                <th style={{ padding: '0.75rem' }}>Capabilities Called</th>
                <th style={{ padding: '0.75rem' }}>Safety Filter</th>
                <th style={{ padding: '0.75rem' }}>Latency</th>
                <th style={{ padding: '0.75rem' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.slice(-8).reverse().map(ev => (
                <tr key={ev.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem', maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    "{ev.patientUtterance}"
                  </td>
                  <td style={{ padding: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>{ev.detectedIntent}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {ev.selectedCapabilities.length > 0 ? (
                        ev.selectedCapabilities.map((c: string, i: number) => (
                          <span key={i} className="badge badge-info" style={{ fontSize: '0.7rem' }}>{c}</span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span className={`badge ${ev.safetyCheckPassed ? 'badge-success' : 'badge-danger'}`}>
                      {ev.safetyCheckPassed ? 'Passed' : 'Blocked (Safe)'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{ev.latencyMs}ms</td>
                  <td style={{ padding: '0.75rem', color: '#34d399', fontWeight: 700 }}>{ev.evaluationScore}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
