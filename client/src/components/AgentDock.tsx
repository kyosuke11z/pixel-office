import { useState } from 'react'

export interface AgentState {
  id: string
  name: string
  color: string
  status: string
  statusType: 'idle' | 'thinking' | 'working' | 'waiting' | 'done' | 'cancelled'
  log: { time: string; text: string }[]
  lastTalkedTo?: string
}

const AGENT_META: Record<string, { color: string; role: string; emoji: string }> = {
  secretary: { color: '#7c3aed', role: 'Secretary',     emoji: '📋' },
  pm:        { color: '#be185d', role: 'PM',             emoji: '📊' },
  techlead:  { color: '#1d4ed8', role: 'Tech Lead',      emoji: '🏗️' },
  designer:  { color: '#b91c1c', role: 'Designer',       emoji: '🎨' },
  dev:       { color: '#1d4ed8', role: 'Developer',      emoji: '💻' },
  qa:        { color: '#065f46', role: 'QA Engineer',    emoji: '🔍' },
  tester:    { color: '#c2410c', role: 'Tester',         emoji: '🧪' },
}

const STATUS_LABEL: Record<AgentState['statusType'], string> = {
  idle:      'รอ',
  thinking:  'กำลังคิด',
  working:   'กำลังทำงาน',
  waiting:   'งานเยอะ รอสักครู่',
  done:      'เสร็จแล้ว',
  cancelled: 'ยกเลิก',
}

function AgentCard({ state, onClick, isSelected }: {
  state: AgentState
  onClick: () => void
  isSelected: boolean
}) {
  const meta = AGENT_META[state.id] ?? { color: '#64748b', role: '', emoji: '🤖' }
  const { statusType } = state

  const dotStyle: React.CSSProperties = {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: statusType === 'idle' ? '#334155'
      : statusType === 'done' ? '#22c55e'
      : statusType === 'waiting' ? '#f59e0b'
      : statusType === 'cancelled' ? '#ef4444'
      : meta.color,
    boxShadow: statusType === 'thinking' ? `0 0 8px ${meta.color}` : 'none',
    animation: statusType === 'thinking' ? 'agentPulse 1s ease-in-out infinite'
      : statusType === 'waiting' ? 'agentFlicker 0.6s ease-in-out infinite'
      : statusType === 'idle' ? 'agentBreath 3s ease-in-out infinite'
      : 'none',
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4, padding: '8px 10px',
        background: isSelected ? '#1e293b' : 'transparent',
        border: `1px solid ${isSelected ? meta.color : '#1e293b'}`,
        borderRadius: 10, cursor: 'pointer', minWidth: 90, maxWidth: 110,
        transition: 'all 0.2s',
        transform: isSelected ? 'translateY(-3px)' : 'none',
        boxShadow: isSelected ? `0 4px 16px ${meta.color}40` : 'none',
      }}
    >
      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
        <div style={dotStyle} />
        <span style={{ color: meta.color, fontSize: 11, fontWeight: 'bold', flex: 1, textAlign: 'left' }}>
          {state.name}
        </span>
        <span style={{ fontSize: 12 }}>{meta.emoji}</span>
      </div>

      {/* Status */}
      <div style={{
        fontSize: 9, color: statusType === 'idle' ? '#475569'
          : statusType === 'waiting' ? '#f59e0b'
          : statusType === 'done' ? '#22c55e'
          : '#94a3b8',
        textAlign: 'center', lineHeight: 1.3,
        maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {statusType === 'thinking' || statusType === 'working'
          ? (state.status || STATUS_LABEL[statusType])
          : STATUS_LABEL[statusType]}
      </div>
    </button>
  )
}

function AgentDetail({ state, onClose, align }: { state: AgentState; onClose: () => void; align: 'left' | 'center' | 'right' }) {
  const meta = AGENT_META[state.id] ?? { color: '#64748b', role: '', emoji: '🤖' }

  const posStyle: React.CSSProperties = align === 'left'
    ? { left: 0, transform: 'none' }
    : align === 'right'
    ? { right: 0, transform: 'none' }
    : { left: '50%', transform: 'translateX(-50%)' }

  return (
    <div style={{
      position: 'absolute', bottom: '100%', ...posStyle,
      background: '#0f172a', border: `1px solid ${meta.color}`,
      borderRadius: 12, padding: '12px 14px', zIndex: 100,
      minWidth: 260, maxWidth: 320,
      boxShadow: `0 -8px 32px ${meta.color}30`,
      animation: `${align === 'center' ? 'slideUpCenter' : 'slideUpEdge'} 0.2s ease-out`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{meta.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: meta.color, fontWeight: 'bold', fontSize: 13 }}>
            {state.name}
          </div>
          <div style={{ color: '#64748b', fontSize: 10 }}>{meta.role}</div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#475569',
          cursor: 'pointer', fontSize: 14,
        }}>✕</button>
      </div>

      {/* Current status */}
      <div style={{
        background: '#1e293b', borderRadius: 6, padding: '6px 10px', marginBottom: 8,
        fontSize: 11, color: '#e2e8f0',
      }}>
        {state.status || 'ว่างอยู่'}
        {state.lastTalkedTo && (
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
            → คุยกับ {state.lastTalkedTo}
          </div>
        )}
      </div>

      {/* Activity log */}
      <div style={{ maxHeight: 140, overflowY: 'auto' }}>
        {state.log.length === 0 && (
          <div style={{ color: '#334155', fontSize: 10, textAlign: 'center', padding: 8 }}>
            ยังไม่มีกิจกรรม
          </div>
        )}
        {[...state.log].reverse().map((entry, i) => (
          <div key={i} style={{
            display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start',
          }}>
            <span style={{ color: '#334155', fontSize: 9, flexShrink: 0, marginTop: 1 }}>
              {entry.time}
            </span>
            <span style={{ color: '#64748b', fontSize: 10, lineHeight: 1.4 }}>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  agentStates: Record<string, AgentState>
}

const AGENT_ORDER = ['secretary', 'pm', 'techlead', 'designer', 'dev', 'qa', 'tester']

export function AgentDock({ agentStates }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleClick = (id: string) => {
    setSelectedId(prev => prev === id ? null : id)
  }

  return (
    <>
      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }
        @keyframes agentFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes agentBreath {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        @keyframes slideUpCenter {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideUpEdge {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        gap: 6, padding: '8px 10px',
        background: '#070b14', borderTop: '1px solid #1e293b',
        position: 'relative',
      }}>
        {AGENT_ORDER.map((id, idx) => {
          const state = agentStates[id]
          if (!state) return null
          const total = AGENT_ORDER.length
          const align = idx <= 1 ? 'left' : idx >= total - 2 ? 'right' : 'center'
          return (
            <div key={id} style={{ position: 'relative' }}>
              {selectedId === id && (
                <AgentDetail
                  state={state}
                  onClose={() => setSelectedId(null)}
                  align={align}
                />
              )}
              <AgentCard
                state={state}
                onClick={() => handleClick(id)}
                isSelected={selectedId === id}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

// Factory สร้าง initial state
export function createAgentStates(): Record<string, AgentState> {
  return Object.fromEntries(
    AGENT_ORDER.map(id => [id, {
      id,
      name: { secretary:'ฟ้า', pm:'อิง', techlead:'ต้น', designer:'แนน', dev:'เปา', qa:'มิ้น', tester:'โบ้ท' }[id] ?? id,
      color: AGENT_META[id]?.color ?? '#64748b',
      status: '',
      statusType: 'idle' as const,
      log: [],
    }])
  )
}
