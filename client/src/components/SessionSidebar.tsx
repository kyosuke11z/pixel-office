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
  onDeleteSession?: (id: string) => void
}

export function SessionSidebar({ currentSessionId, onSelectSession, onNewSession, onDeleteSession }: Props) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [hoverId, setHoverId] = useState<string | null>(null)

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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('ลบประวัติแชทนี้?')) return
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (id === currentSessionId) onDeleteSession?.(id)
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('th-TH', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{
      width: 200, background: '#070b14', borderRight: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column', fontSize: '11px', flexShrink: 0,
    }}>
      <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ color: '#475569', fontSize: '10px', marginBottom: 8 }}>PIXEL OFFICE</div>
        <button onClick={onNewSession} style={{
          width: '100%', background: '#1e40af', color: '#fff', border: 'none',
          borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontSize: '11px',
        }}>
          + แชทใหม่
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            onMouseEnter={() => setHoverId(s.id)}
            onMouseLeave={() => setHoverId(null)}
            style={{
              padding: '8px 10px', borderBottom: '1px solid #0f172a', cursor: 'pointer',
              background: s.id === currentSessionId ? '#1e293b' : 'transparent',
              borderLeft: s.id === currentSessionId ? '2px solid #60a5fa' : '2px solid transparent',
              display: 'flex', alignItems: 'flex-start', gap: 4,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: s.id === currentSessionId ? '#e2e8f0' : '#94a3b8',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2,
              }}>
                {s.title}
              </div>
              <div style={{ color: '#475569', fontSize: '10px' }}>{fmt(s.updatedAt)}</div>
            </div>
            {hoverId === s.id && (
              <button
                onClick={(e) => handleDelete(e, s.id)}
                title="ลบแชทนี้"
                style={{
                  background: 'none', border: 'none', color: '#64748b',
                  cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: 1,
                  flexShrink: 0, marginTop: 1,
                }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <div style={{ padding: 12, color: '#475569', textAlign: 'center' }}>ยังไม่มีประวัติ</div>
        )}
      </div>
    </div>
  )
}
