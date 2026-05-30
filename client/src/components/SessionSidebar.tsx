import { useState, useEffect } from 'react'
import { ProviderSettings } from './ProviderSettings'

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

const styles = {
  root: { width: 200, background: '#070b14', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', fontSize: '11px', flexShrink: 0 } as React.CSSProperties,
  header: { padding: '12px 10px 8px', borderBottom: '1px solid #1e293b' } as React.CSSProperties,
  headerRow: { display: 'flex', alignItems: 'center', marginBottom: 8 } as React.CSSProperties,
  headerLabel: { color: '#475569', fontSize: '10px', flex: 1 } as React.CSSProperties,
  settingsBtn: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '13px', padding: '0 2px' } as React.CSSProperties,
  newBtn: { width: '100%', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontSize: '11px' } as React.CSSProperties,
  list: { flex: 1, overflowY: 'auto' } as React.CSSProperties,
  sessionItem: (isActive: boolean): React.CSSProperties => ({
    padding: '8px 10px', borderBottom: '1px solid #0f172a', cursor: 'pointer',
    background: isActive ? '#1e293b' : 'transparent',
    borderLeft: isActive ? '2px solid #60a5fa' : '2px solid transparent',
    display: 'flex', alignItems: 'flex-start', gap: 4,
  }),
  sessionTitle: (isActive: boolean): React.CSSProperties => ({
    color: isActive ? '#e2e8f0' : '#94a3b8',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2,
  }),
  sessionDate: { color: '#475569', fontSize: '10px' } as React.CSSProperties,
  deleteBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: 1, flexShrink: 0, marginTop: 1 } as React.CSSProperties,
  empty: { padding: 12, color: '#475569', textAlign: 'center' } as React.CSSProperties,
}

export function SessionSidebar({ currentSessionId, onSelectSession, onNewSession, onDeleteSession }: Props) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

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
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerRow}>
          <span style={styles.headerLabel}>PIXEL OFFICE</span>
          <button onClick={() => setShowSettings(true)} title="ตั้งค่า LLM Provider" style={styles.settingsBtn}>
            ⚙️
          </button>
        </div>
        <button onClick={onNewSession} style={styles.newBtn}>
          + แชทใหม่
        </button>
      </div>

      <div style={styles.list}>
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            onMouseEnter={() => setHoverId(s.id)}
            onMouseLeave={() => setHoverId(null)}
            style={styles.sessionItem(s.id === currentSessionId)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.sessionTitle(s.id === currentSessionId)}>
                {s.title}
              </div>
              <div style={styles.sessionDate}>{fmt(s.updatedAt)}</div>
            </div>
            {hoverId === s.id && (
              <button onClick={(e) => handleDelete(e, s.id)} title="ลบแชทนี้" style={styles.deleteBtn}>
                🗑
              </button>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <div style={styles.empty}>ยังไม่มีประวัติ</div>
        )}
      </div>

      {showSettings && <ProviderSettings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
