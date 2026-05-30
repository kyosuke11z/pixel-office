import { useState, useEffect } from 'react'

interface SessionMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

interface Props {
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
}

export function SessionSidebar({ currentSessionId, onSelectSession, onNewSession }: Props) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])

  const refresh = () => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then((data: SessionMeta[]) => setSessions(data))
      .catch(() => {})
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 10_000)
    return () => clearInterval(t)
  }, [])

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      width: 200,
      background: '#070b14',
      borderRight: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      fontSize: '11px',
      flexShrink: 0,
    }}>
      <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ color: '#475569', fontSize: '10px', marginBottom: 8 }}>PIXEL OFFICE</div>
        <button
          onClick={onNewSession}
          style={{
            width: '100%', background: '#1e40af', color: '#fff', border: 'none',
            borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontSize: '11px',
          }}
        >
          + แชทใหม่
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid #0f172a',
              cursor: 'pointer',
              background: s.id === currentSessionId ? '#1e293b' : 'transparent',
              borderLeft: s.id === currentSessionId ? '2px solid #60a5fa' : '2px solid transparent',
            }}
          >
            <div style={{
              color: s.id === currentSessionId ? '#e2e8f0' : '#94a3b8',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 2,
            }}>
              {s.title}
            </div>
            <div style={{ color: '#475569', fontSize: '10px' }}>{fmt(s.updatedAt)}</div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div style={{ padding: 12, color: '#475569', textAlign: 'center' }}>ยังไม่มีประวัติ</div>
        )}
      </div>
    </div>
  )
}
