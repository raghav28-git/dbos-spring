import { useEffect, useState } from 'react'
import { ReactFlow, Background, MarkerType, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  ArrowUpRight,
  Zap,
  RotateCw,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function App() {
  const [state, setState] = useState<any>(null)
  const [selectedWfId, setSelectedWfId] = useState<string | null>(null)
  const [replayData, setReplayData] = useState<any>(null)

  // Scroll-reactive fluid background variables
  useEffect(() => {
    let rafId: number
    const onScroll = () => {
      rafId = requestAnimationFrame(() => {
        const scrollY = window.scrollY
        const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
        const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1)
        document.documentElement.style.setProperty('--scroll-y', `${scrollY}px`)
        document.documentElement.style.setProperty('--scroll-progress', progress.toFixed(4))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  const fetchState = () =>
    fetch(`${API_BASE}/api/state`)
      .then(r => r.json())
      .then(data => {
        setState(data)
        if (!selectedWfId && data.workflows?.length > 0) {
          setSelectedWfId(data.workflows[0].workflow_id)
        }
      })

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 1500)
    return () => clearInterval(interval)
  }, [selectedWfId])

  const apiCall = async (endpoint: string, newWfId?: string) => {
    if (newWfId) setSelectedWfId(newWfId)
    await fetch(`${API_BASE}/api/${endpoint}`)
    fetchState()
    setReplayData(null)
  }

  const runReplay = async (workflowId: string) => {
    setSelectedWfId(workflowId)
    const res = await fetch(`${API_BASE}/api/replay?workflowId=${workflowId}`).then(r => r.json())
    setReplayData(res)
  }

  if (!state) {
    return (
      <>
        <div className="ambient-backdrop">
          <div className="orb orb-primary" />
          <div className="orb orb-secondary" />
        </div>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: 14,
            letterSpacing: '0.02em',
          }}
        >
          Connecting to DBOS Engine...
        </div>
      </>
    )
  }

  const isTampered = state.integrity?.valid === false
  const activeWf = state.workflows.find((w: any) => w.workflow_id === selectedWfId) || state.workflows[0]
  const activeWfId = activeWf?.workflow_id
  const completedStepIds = new Set(
    state.steps.filter((s: any) => s.workflow_id === activeWfId).map((s: any) => s.step_id)
  )

  const getStepStyle = (stepNum: number) => {
    const isDone = completedStepIds.has(stepNum)
    const isCrashedHere = activeWf?.status === 'PENDING' && !isDone && completedStepIds.has(stepNum - 1)
    return {
      background: isDone
        ? 'rgba(16, 185, 129, 0.1)'
        : isCrashedHere
        ? 'rgba(244, 63, 94, 0.14)'
        : 'rgba(15, 18, 28, 0.8)',
      color: isDone ? '#ecfdf5' : isCrashedHere ? '#ffe4e6' : '#94a3b8',
      border: `1px solid ${
        isDone ? 'rgba(16, 185, 129, 0.45)' : isCrashedHere ? 'rgba(244, 63, 94, 0.55)' : 'rgba(255, 255, 255, 0.08)'
      }`,
      boxShadow: isDone
        ? '0 12px 30px -10px rgba(16, 185, 129, 0.25)'
        : isCrashedHere
        ? '0 12px 30px -10px rgba(244, 63, 94, 0.35)'
        : 'none',
      borderRadius: '14px',
      padding: '14px 16px',
      fontSize: '12.5px',
      fontWeight: 500,
      width: 230,
      textAlign: 'center' as const,
      backdropFilter: 'blur(12px)',
    }
  }

  const nodes: Node[] = [
    {
      id: '1',
      position: { x: 60, y: 65 },
      data: { label: `01 · Deduct Sender ${completedStepIds.has(1) ? '✓' : ''}` },
      style: getStepStyle(1),
    },
    {
      id: '2',
      position: { x: 395, y: 65 },
      data: {
        label: completedStepIds.has(2)
          ? '02 · Fraud Verification ✓'
          : activeWf?.status === 'PENDING'
          ? 'Interrupted · Recovering'
          : '02 · Fraud Verification',
      },
      style: getStepStyle(2),
    },
    {
      id: '3',
      position: { x: 730, y: 65 },
      data: { label: `03 · Credit Receiver ${completedStepIds.has(3) ? '✓' : ''}` },
      style: getStepStyle(3),
    },
  ]

  const edgeColor = activeWf?.status === 'PENDING' ? '#f43f5e' : '#6366f1'

  const edges: Edge[] = [
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      animated: activeWf?.status === 'PENDING',
      style: { stroke: completedStepIds.has(2) ? '#10b981' : edgeColor, strokeWidth: 1.75 },
      markerEnd: { type: MarkerType.ArrowClosed, color: completedStepIds.has(2) ? '#10b981' : edgeColor },
    },
    {
      id: 'e2-3',
      source: '2',
      target: '3',
      animated: activeWf?.status === 'PENDING',
      style: { stroke: completedStepIds.has(3) ? '#10b981' : 'rgba(255,255,255,0.15)', strokeWidth: 1.75 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: completedStepIds.has(3) ? '#10b981' : 'rgba(255,255,255,0.25)',
      },
    },
  ]

  return (
    <>
      {/* Scroll-Reactive Fluid Background */}
      <div className="ambient-backdrop">
        <div className="orb orb-primary" />
        <div className="orb orb-secondary" />
        <div className="orb orb-tertiary" />
        <div className="ambient-grid" />
      </div>

      <main className="studio-shell">
        {/* Minimal Floating Navigation */}
        <nav className="glass-nav">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={15} />
            </div>
            <span className="brand-title">DBOS Studio</span>
          </div>

          <div className="nav-actions">
            <div className={`status-chip ${isTampered ? 'tampered' : 'verified'}`}>
              {isTampered ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
              <span>{isTampered ? 'Tamper Detected' : 'Chain Verified'}</span>
            </div>
            <button className="btn-ghost" onClick={() => apiCall('tamper')}>
              Simulate Tamper
            </button>
            <button className="btn-subtle" onClick={() => apiCall('reset')}>
              <RotateCw size={13} /> Reset
            </button>
          </div>
        </nav>

        {/* Stage 1: Capital & Workflow Dispatch */}
        <section className="section-block">
          <div className="section-header">
            <div>
              <div className="eyebrow">01 · State & Execution</div>
              <h1 className="section-title">Transactional Workflow Engine</h1>
            </div>
          </div>

          <div className="hero-grid">
            <div className="glass-card">
              <div className="eyebrow">Live Account Balances</div>
              <div className="balances-row">
                {state.accounts.map((acc: any) => (
                  <div key={acc.username} className="balance-tile">
                    <div className="balance-label">
                      <span>{acc.username}</span>
                      <ArrowUpRight size={14} color="#64748b" />
                    </div>
                    <div className="balance-value">${acc.balance.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="eyebrow">Atomic Dispatch</div>
                <p style={{ margin: '8px 0 20px', fontSize: 13.5, color: '#94a3b8', lineHeight: 1.55 }}>
                  Execute an ACID-checkpointed transfer or trigger a mid-flight fault to observe automatic background recovery.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const id = `tx-${Date.now()}`
                    apiCall(`transfer?workflowId=${id}&amount=100&crash=false`, id)
                  }}
                >
                  <Zap size={15} /> Transfer $100
                </button>

                <button
                  className="btn-chaos"
                  onClick={() => {
                    const id = `tx-${Date.now()}`
                    apiCall(`transfer?workflowId=${id}&amount=100&crash=true`, id)
                  }}
                >
                  Simulate Mid-Flight Crash
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Stage 2: Interactive Workflow Topology */}
        <section className="section-block">
          <div className="section-header">
            <div>
              <div className="eyebrow">02 · Live Topology</div>
              <h2 className="section-title">Step Checkpoint Graph</h2>
            </div>
            {activeWf && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: '#94a3b8' }}>
                  {activeWfId}
                </span>
                <span className={`pill ${activeWf.status === 'COMPLETED' ? 'pill-success' : 'pill-pending'}`}>
                  {activeWf.status}
                </span>
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: 14 }}>
            <div className="dag-frame">
              <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
                <Background color="rgba(255,255,255,0.07)" gap={24} size={1} />
              </ReactFlow>
            </div>
          </div>
        </section>

        {/* Stage 3: Execution History & Cryptographic Provenance */}
        <section className="section-block">
          <div className="section-header">
            <div>
              <div className="eyebrow">03 · Audit & Time-Travel</div>
              <h2 className="section-title">Execution Ledger & Provenance</h2>
            </div>
          </div>

          <div className="ledger-grid">
            {/* Left Column: Workflow Runs */}
            <div className="glass-card">
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                Workflow History ({state.workflows.length})
              </div>

              <div className="list-stack">
                {state.workflows.slice(0, 8).map((wf: any) => (
                  <div
                    key={wf.workflow_id}
                    className={`wf-row ${wf.workflow_id === activeWfId ? 'active' : ''}`}
                    onClick={() => setSelectedWfId(wf.workflow_id)}
                  >
                    <div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: '#f8fafc' }}>
                        {wf.workflow_id}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {wf.status === 'COMPLETED' ? 'All 3 checkpoints committed' : 'Awaiting auto-recovery worker'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`pill ${wf.status === 'COMPLETED' ? 'pill-success' : 'pill-pending'}`}>
                        {wf.status}
                      </span>
                      <button
                        className="btn-subtle"
                        onClick={e => {
                          e.stopPropagation()
                          runReplay(wf.workflow_id)
                        }}
                      >
                        <RotateCcw size={12} /> Replay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Provenance Stream or Time-Travel Sandbox */}
            <div className="glass-card">
              {replayData ? (
                <div className="replay-surface">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="eyebrow" style={{ color: '#818cf8' }}>
                        R3 Time-Travel Sandbox
                      </div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>
                        {replayData.workflowId}
                      </div>
                    </div>

                    <span className="pill pill-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={12} />
                      {replayData.deterministicMatch ? 'Deterministic Match' : 'Diverged'}
                    </span>
                  </div>

                  <div className="replay-compare">
                    <div className="snapshot-box">
                      <div className="eyebrow">State Before</div>
                      <pre className="mono">{JSON.stringify(replayData.historicalStateBefore, null, 2)}</pre>
                    </div>
                    <div className="snapshot-box">
                      <div className="eyebrow">Replayed Output</div>
                      <pre className="mono">{JSON.stringify(replayData.sandboxReplayedStateAfter, null, 2)}</pre>
                    </div>
                  </div>

                  <button className="btn-subtle" style={{ width: '100%' }} onClick={() => setReplayData(null)}>
                    Return to Provenance Stream
                  </button>
                </div>
              ) : (
                <>
                  <div className="eyebrow" style={{ marginBottom: 16 }}>
                    SHA-256 Row Mutations ({state.provenance.length})
                  </div>

                  <div className="list-stack">
                    {state.provenance.slice(0, 6).map((prov: any) => (
                      <div key={prov.event_id} className="audit-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#f8fafc' }}>
                            {prov.row_key.toUpperCase()}{' '}
                            <span style={{ color: '#64748b', fontWeight: 400 }}>· Step {prov.step_id}</span>
                          </span>
                          <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>
                            {prov.workflow_id}
                          </span>
                        </div>

                        <div className="state-transition mono">
                          <span className="state-pill">{prov.before_json}</span>
                          <ArrowRight size={13} color="#64748b" />
                          <span className="state-pill after">{prov.after_json}</span>
                        </div>

                        <div className="mono" style={{ fontSize: 11, color: '#475569' }}>
                          {prov.curr_hash.substring(0, 42)}…
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}