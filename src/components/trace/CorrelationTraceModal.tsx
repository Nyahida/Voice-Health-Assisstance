import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { TraceData } from '../../types/index.js';
import { X, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Activity, Database, Server } from 'lucide-react';

interface CorrelationTraceModalProps {
  correlationId: string;
  onClose: () => void;
}

export const CorrelationTraceModal: React.FC<CorrelationTraceModalProps> = ({ correlationId, onClose }) => {
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getTrace(correlationId);
        setTrace(data);
      } catch (err) {
        console.error('Failed to load trace:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [correlationId]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '2rem',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Activity className="text-emerald-400" size={24} color="#10b981" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>End-to-End Correlation Trace</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Trace ID: <code style={{ color: '#38bdf8' }}>{correlationId}</code>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '0.4rem', borderRadius: '50%' }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Inspecting multi-hospital audit trail...
          </div>
        ) : !trace ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No trace events recorded for this correlation ID.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Step 1: Capabilities Executed */}
            <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Server size={18} color="#3b82f6" />
                <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>1. Controlled Capability Invocations</h4>
                <span className="badge badge-info">{trace.capabilities.length} Executions</span>
              </div>
              {trace.capabilities.map((c, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#60a5fa' }}>{c.capabilityName}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>{c.latencyMs}ms</span>
                  </div>
                  <pre style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', overflowX: 'auto' }}>
                    {JSON.stringify(c.parameters, null, 2)}
                  </pre>
                </div>
              ))}
            </div>

            {/* Step 2: EHR Operations */}
            <div style={{ borderLeft: '3px solid #8b5cf6', paddingLeft: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Database size={18} color="#8b5cf6" />
                <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>2. Healthcare System / EHR Operation</h4>
                <span className="badge badge-info">{trace.ehrOperations.length} Operations</span>
              </div>
              {trace.ehrOperations.map((op, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><strong>{op.operationType}</strong> (Attempt {op.attemptCount})</span>
                    <span className={`badge ${op.status === 'SUCCESS' ? 'badge-success' : 'badge-warning'}`}>
                      {op.status}
                    </span>
                  </div>
                  {op.responsePayload && (
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      External EHR ID: <code style={{ color: '#34d399' }}>{op.responsePayload.externalAppointmentId}</code>
                    </div>
                  )}
                  {op.errorDetails && (
                    <div style={{ marginTop: '0.5rem', color: '#f87171', fontSize: '0.8rem' }}>
                      {op.errorDetails}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Step 3: Verification & Reconciliation */}
            <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ShieldCheck size={18} color="#10b981" />
                <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>3. External Verification & State Sync</h4>
              </div>
              {trace.verifications.length > 0 ? (
                trace.verifications.map((v, i) => (
                  <div key={i} style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 600 }}>
                      <CheckCircle2 size={16} /> Status: {v.status} (Verified in External EHR at {new Date(v.verifiedAt).toLocaleTimeString()})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Internal Appointment matched external provider and time slot exactly.
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No verification record found.</div>
              )}
            </div>

            {/* Reconciliations (if any) */}
            {trace.reconciliations.length > 0 && (
              <div style={{ borderLeft: '3px solid #ef4444', paddingLeft: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={18} color="#ef4444" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f87171' }}>Reconciliation Ticket (Option C)</h4>
                </div>
                {trace.reconciliations.map((r, i) => (
                  <div key={i} style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.85rem' }}>
                    <div><strong>Reason:</strong> {r.reason}</div>
                    <div style={{ marginTop: '0.25rem', color: '#fca5a5' }}><strong>Action:</strong> {r.recommendedAction}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4: Workflows & Notifications */}
            <div style={{ borderLeft: '3px solid #06b6d4', paddingLeft: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>4. Automated Workflows & Notifications</h4>
              {trace.workflows.map((wf, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600, color: '#38bdf8' }}>{wf.workflowName} ({wf.status})</div>
                  <div style={{ marginTop: '0.35rem' }}>
                    {wf.steps.map((s: any, idx: number) => (
                      <div key={idx} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <ArrowRight size={12} /> {s.name} — <span style={{ color: s.status === 'EXECUTED' ? '#34d399' : '#f59e0b' }}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
