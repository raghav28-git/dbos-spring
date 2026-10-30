import { useEffect, useState } from 'react'
import { ReactFlow, Background, MarkerType, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Database, ShieldAlert, ShieldCheck, RotateCcw } from 'lucide-react'
import './App.css'

export default function App() {
  const [state, setState] = useState<any>(null)
  const [selectedWfId, setSelectedWfId] = useState<string | null>(null)
  const [replayData, setReplayData] = useState<any>(null)

  const fetchState = () =>
    fetch('http://localhost:8080/api/state')
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
    await fetch(`http://localhost:8080/api/${endpoint}`)
    fetchState()
    setReplayData(null)
  }

  const runReplay = async (workflowId: string) => {
    setSelectedWfId(workflowId)
    const res = await fetch(`http://localhost:8080/api/replay?workflowId=${workflowId}`).then(r => r.json())
    setReplayData(res)
  }

  if (!state) return <div style={{ padding: 40 }}>Loading DBOS Engine State...</div>

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
      background: isDone ? '#d1fae5' : isCrashedHere ? '#fee2e2' : '#f3f4f6',
      color: isDone ? '#065f46' : isCrashedHere ? '#991b1b' : '#374151',
      border: `2px solid ${isDone ? '#10b981' : isCrashedHere ? '#ef4444' : '#9ca3af'}`,
      borderRadius: '8px',
      padding: '10px',
      fontWeight: 700,
      width: 220,
      textAlign: 'center' as const,
    }
  }

  const nodes: Node[] = [
    {
      id: '1',
      position: { x: 60, y: 45 },
      data: { label: `Step 1: Deduct Sender ${completedStepIds.has(1) ? '✅' : ''}` },
      style: getStepStyle(1),
    },
    {
      id: '2',
      position: { x: 380, y: 45 },
      data: {
        label: completedStepIds.has(2)
          ? 'Step 2: Fraud Check ✅'
          : activeWf?.status === 'PENDING'
          ? '💥 CRASHED BEFORE STEP 2 (Auto-Recovering...)'
          : 'Step 2: Fraud Check',
      },
      style: getStepStyle(2),
    },
    {
      id: '3',
      position: { x: 700, y: 45 },
      data: { label: `Step 3: Credit Receiver ${completedStepIds.has(3) ? '✅' : ''}` },
      style: getStepStyle(3),
    },
  ]

  const edges: Edge[] = [
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      animated: activeWf?.status === 'PENDING',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'e2-3',
      source: '2',
      target: '3',
      animated: activeWf?.status === 'PENDING',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
  ]

  return (
    <div className="app-container">
      <div className="header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database /> DBOS-Spring: Crash-Proof Workflow & Time-Travel Studio
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-gray" onClick={() => apiCall('reset')}>Reset System</button>
          <button className="btn-red" onClick={() => apiCall('tamper')}>Simulate DB Hack</button>
        </div>
      </div>

      {/* TOP: Live Workflow Flowchart (DAG) */}
      <div className="dag-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>
            Live Workflow DAG Inspector {activeWfId ? `— Viewing: ${activeWfId} (${activeWf.status})` : '— No workflows run yet'}
          </strong>
          <span style={{ fontSize: 12, color: '#4b5563' }}>Click any workflow below to inspect its checkpointed steps</span>
        </div>
        <div style={{ height: 150, width: '100%', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
            <Background />
          </ReactFlow>
        </div>
      </div>

      <div className="dashboard">
        {/* LEFT: Controls & Balances */}
        <div className="card">
          <h2>1. Live Balances</h2>
          {state.accounts.map((acc: any) => (
            <div key={acc.username} style={{ fontSize: '20px', marginBottom: '12px', color: '#111827' }}>
              <strong>{acc.username.toUpperCase()}:</strong> ${acc.balance}
            </div>
          ))}
          <hr style={{ margin: '20px 0', border: '0.5px solid #e5e7eb' }} />
          <h2>Trigger Workflow</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="btn-blue"
              onClick={() => {
                const id = `tx-${Date.now()}`
                apiCall(`transfer?workflowId=${id}&amount=100&crash=false`, id)
              }}
            >
              Transfer $100 (Safe)
            </button>
            <button
              className="btn-red"
              onClick={() => {
                const id = `tx-${Date.now()}`
                apiCall(`transfer?workflowId=${id}&amount=100&crash=true`, id)
              }}
            >
              Transfer $100 (Simulate Mid-Flight Crash)
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#4b5563', marginTop: 12 }}>
            * Crashed workflows turn red in the DAG above, then auto-recover after 5 seconds via the PostgreSQL background worker.
          </p>
        </div>

        {/* MIDDLE: Workflows & Time-Travel */}
        <div className="card">
          <h2>2. Execution History</h2>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {state.workflows.map((wf: any) => (
              <div
                key={wf.workflow_id}
                className={`workflow-item ${wf.workflow_id === activeWfId ? 'selected' : ''}`}
                onClick={() => setSelectedWfId(wf.workflow_id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#111827' }}>{wf.workflow_id}</strong>
                  <span className={wf.status === 'COMPLETED' ? 'badge-green' : 'badge-red'}>{wf.status}</span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <button
                    className="btn-gray"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={e => {
                      e.stopPropagation()
                      runReplay(wf.workflow_id)
                    }}
                  >
                    <RotateCcw size={13} style={{ display: 'inline', marginBottom: '-2px', marginRight: 4 }} />
                    Replay in Sandbox
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Provenance & Replay Viewer */}
        <div className="card">
          <h2>3. Cryptographic Provenance</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            {isTampered ? <ShieldAlert color="#dc2626" /> : <ShieldCheck color="#059669" />}
            <span style={{ fontWeight: 'bold', color: isTampered ? '#dc2626' : '#059669' }}>
              {state.integrity?.status}
            </span>
          </div>

          {replayData ? (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, color: '#1e3a8a' }}>R3 Sandbox Replay: {replayData.workflowId}</h3>
              <p style={{ color: '#111827', fontSize: 14 }}>
                <strong>Deterministic Match:</strong> {replayData.deterministicMatch ? '✅ YES (100% Match)' : '❌ NO'}
              </p>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Historical State Before:</div>
              <pre>{JSON.stringify(replayData.historicalStateBefore, null, 2)}</pre>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Replayed State After:</div>
              <pre>{JSON.stringify(replayData.sandboxReplayedStateAfter, null, 2)}</pre>
              <button className="btn-gray" onClick={() => setReplayData(null)}>Close Replay</button>
            </div>
          ) : (
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {state.provenance.slice(0, 10).map((prov: any) => (
                <div key={prov.event_id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#111827' }}>
                    {prov.workflow_id} (Step {prov.step_id}) — {prov.table_name}[{prov.row_key}]
                  </div>
                  <pre style={{ margin: '6px 0' }}>{prov.before_json} → {prov.after_json}</pre>
                  <div style={{ fontSize: '11px', color: '#4b5563', fontFamily: 'monospace' }}>
                    SHA-256: {prov.curr_hash.substring(0, 36)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}