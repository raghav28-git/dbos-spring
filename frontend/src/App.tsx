import { useEffect, useState, type MouseEvent } from 'react'
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
  Copy,
  Check,
  Layers,
  Activity,
  Lock,
} from 'lucide-react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function App() {
  const [state, setState] = useState<any>(null)
  const [selectedWfId, setSelectedWfId] = useState<string | null>(null)
  const [replayData, setReplayData] = useState<any>(null)
  const [amount, setAmount] = useState<number>(100)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

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

  const handleCardMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 1800)
  }

  if (!state) {
    return (
      <>
        <div className="ambient-backdrop" data-mood="nominal">
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
          Synchronizing with DBOS Engine...
        </div>
      </>
    )
  }

  const isTampered = state.integrity?.valid === false
  const hasPending = state.workflows?.some((w: any) => w.status === 'PENDING')
  const ambientMood = isTampered ? 'tampered' : hasPending ? 'recovering' : 'nominal'

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
        ? 'rgba(16, 185, 129, 0.11)'
        : isCrashedHere
        ? 'rgba(245, 158, 11, 0.15)'
        : 'rgba(15, 18, 28, 0.82)',
      color: isDone ? '#ecfdf5' : isCrashedHere ? '#fef3c7' : '#94a3b8',
      border: `1px solid ${
        isDone
          ? 'rgba(16, 185, 129, 0.45)'
          : isCrashedHere
          ? 'rgba(245, 158, 11, 0.55)'
          : 'rgba(255, 255, 255, 0.08)'
      }`,
      boxShadow: isDone
        ? '0 14px 32px -10px rgba(16, 185, 129, 0.28)'
        : isCrashedHere
        ? '0 14px 32px -10px rgba(245, 158, 11, 0.35)'
        : 'none',
      borderRadius: '14px',
      padding: '14px 16px',
      fontSize: '12.5px',
      fontWeight: 500,
      width: 235,
      textAlign: 'center' as const,
      backdropFilter: 'blur(12px)',
    }
  }

  const nodes: Node[] = [
    {
      id: '1',
      position: { x: 55, y: 68 },
      data: { label: `01 · Deduct Sender ${completedStepIds.has(1) ? '✓' : ''}` },
      style: getStepStyle(1),
    },
    {
      id: '2',
      position: { x: 395, y: 68 },
      data: {
        label: completedStepIds.has(2)
          ? '02 · Fraud Verification ✓'
          : activeWf?.status === 'PENDING'
          ? 'Interrupted · Recovering (5s)'
          : '02 · Fraud Verification',
      },
      style: getStepStyle(2),
    },
    {
      id: '3',
      position: { x: 735, y: 68 },
      data: { label: `03 · Credit Receiver ${completedStepIds.has(3) ? '✓' : ''}` },
      style: getStepStyle(3),
    },
  ]

  const edgeColor = activeWf?.status === 'PENDING' ? '#f59e0b' : '#6366f1'

  const edges: Edge[] = [
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      animated: activeWf?.status === 'PENDING',
      style: { stroke: completedStepIds.has(2) ? '#10b981' : edgeColor, strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: completedStepIds.has(2) ? '#10b981' : edgeColor },
    },
    {
      id: 'e2-3',
      source: '2',
      target: '3',
      animated: activeWf?.status === 'PENDING',
      style: { stroke: completedStepIds.has(3) ? '#10b981' : 'rgba(255,255,255,0.16)', strokeWidth: 1.8 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: completedStepIds.has(3) ? '#10b981' : 'rgba(255,255,255,0.26)',
      },
    },
  ]

  return (
    <>
      {/* Scroll-Reactive & State-Adaptive Fluid Background */}
      <div className="ambient-backdrop" data-mood={ambientMood}>
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
            <span className="brand-tag mono">ACID · R3</span>
          </div>

          <div className="nav-actions">
            <div className={`status-chip ${isTampered ? 'tampered' : 'verified'}`}>
              {isTampered ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
              <span>
                {isTampered
                  ? `Tamper Alert · Event #${state.integrity?.tamperedEventId ?? ''}`
                  : 'SHA-256 Chain Verified'}
              </span>
            </div>
            <button className="btn-ghost" onClick={() => apiCall('tamper')}>
              Simulate Tamper
            </button>
            <button className="btn-subtle" onClick={() => apiCall('reset')}>
              <RotateCw size={13} /> Reset
            </button>
          </div>
        </nav>

        {/* Minimal Telemetry Strip */}
        <div className="metrics-strip">
          <div className="metric-pill">
            <span className="metric-label">
              <Activity size={14} color="#6366f1" /> Engine State
            </span>
            <span className="metric-val mono" style={{ color: hasPending ? '#fbbf24' : '#34d399' }}>
              {hasPending ? 'RECOVERING_LOCK' : 'NOMINAL_SYNC'}
            </span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">
              <Layers size={14} color="#38bdf8" /> Checkpointed Steps
            </span>
            <span className="metric-val mono">{state.steps.length} committed</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">
              <Lock size={14} color="#10b981" /> Verified Audit Blocks
            </span>
            <span className="metric-val mono">{state.provenance.length} hashes</span>
          </div>
        </div>

        {/* Stage 1: Capital & Workflow Dispatch */}
        <section className="section-block">
          <div className="section-header">
            <div>
              <div className="eyebrow">01 · State & Execution</div>
              <h1 className="section-title">Transactional Workflow Engine</h1>
            </div>
          </div>

          <div className="hero-grid">
            <div className="glass-card" onMouseMove={handleCardMouseMove}>
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

            <div
              className="glass-card"
              onMouseMove={handleCardMouseMove}
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <div className="eyebrow">Atomic Dispatch</div>
                <div className="amount-selector">
                  {[50, 100, 250].map(val => (
                    <button
                      key={val}
                      type="button"
                      className={`amount-chip mono ${amount === val ? 'active' : ''}`}
                      onClick={() => setAmount(val)}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const id = `tx-${Date.now()}`
                    apiCall(`transfer?workflowId=${id}&amount=${amount}&crash=false`, id)
                  }}
                >
                  <Zap size={15} /> Transfer ${amount}
                </button>

                <button
                  className="btn-chaos"
                  onClick={() => {
                    const id = `tx-${Date.now()}`
                    apiCall(`transfer?workflowId=${id}&amount=${amount}&crash=true`, id)
                  }}
                >
                  Simulate Mid-Flight Crash (${amount})
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

          <div className="glass-card" onMouseMove={handleCardMouseMove} style={{ padding: 14 }}>
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
            <div className="glass-card" onMouseMove={handleCardMouseMove}>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                Workflow History ({state.workflows.length})
              </div>

              <div className="list-stack">
                {state.workflows.slice(0, 8).map((wf: any, index: number) => (
                  <div
                    key={wf.workflow_id}
                    style={{ animationDelay: `${index * 45}ms` }}
                    className={`wf-row ${wf.workflow_id === activeWfId ? 'active' : ''} ${
                      wf.status === 'PENDING' ? 'recovering' : ''
                    }`}
                    onClick={() => setSelectedWfId(wf.workflow_id)}
                  >
                    <div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: '#f8fafc' }}>
                        {wf.workflow_id}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {wf.status === 'COMPLETED'
                          ? '3/3 steps checkpointed'
                          : 'Interrupted · Auto-resuming in 5s'}
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
            <div className="glass-card" onMouseMove={handleCardMouseMove}>
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
                    {state.provenance.slice(0, 6).map((prov: any, index: number) => (
                      <div
                        key={prov.event_id}
                        style={{ animationDelay: `${index * 45}ms` }}
                        className="audit-item"
                      >
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

                        <button
                          type="button"
                          className="hash-chip mono"
                          onClick={() => copyHash(prov.curr_hash)}
                          title="Click to copy full SHA-256 hash"
                        >
                          {copiedHash === prov.curr_hash ? (
                            <>
                              <Check size={11} color="#34d399" />
                              <span style={{ color: '#34d399' }}>Copied full SHA-256 digest</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>{prov.curr_hash.substring(0, 38)}…</span>
                            </>
                          )}
                        </button>
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