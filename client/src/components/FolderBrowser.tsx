import { useState, useEffect } from 'react'

interface DirEntry { name: string; path: string }
interface BrowseResult { path: string; parent: string | null; entries: DirEntry[] }

interface Props {
  onSelect: (path: string) => void
  onClose: () => void
}

export function FolderBrowser({ onSelect, onClose }: Props) {
  const [current, setCurrent] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const browse = async (path?: string) => {
    setLoading(true)
    setError('')
    try {
      const url = path ? `/api/browse?path=${encodeURIComponent(path)}` : '/api/browse'
      const res = await fetch(url)
      const data = await res.json() as BrowseResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      setCurrent(data)
    } catch {
      setError('เชื่อมต่อ server ไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { browse() }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 10,
        width: 420,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: '13px', color: '#e2e8f0', flex: 1 }}>เลือกโฟลเดอร์โปรเจค</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: '16px', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Current path */}
        <div style={{
          padding: '8px 16px',
          background: '#0a0f1e',
          borderBottom: '1px solid #1e293b',
          fontSize: '10px',
          color: '#60a5fa',
          wordBreak: 'break-all',
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {current?.parent && (
            <button onClick={() => browse(current.parent!)} style={{
              background: '#1e293b', border: 'none', color: '#94a3b8',
              borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '10px',
              flexShrink: 0,
            }}>↑ ขึ้น</button>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.path ?? '...'}
          </span>
        </div>

        {/* Directory list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: 16, color: '#475569', textAlign: 'center', fontSize: '11px' }}>
              กำลังโหลด...
            </div>
          )}
          {error && (
            <div style={{ padding: 16, color: '#f87171', fontSize: '11px' }}>{error}</div>
          )}
          {!loading && current?.entries.length === 0 && (
            <div style={{ padding: 16, color: '#475569', textAlign: 'center', fontSize: '11px' }}>
              ไม่มีโฟลเดอร์ย่อย
            </div>
          )}
          {!loading && current?.entries.map(entry => (
            <div
              key={entry.path}
              onClick={() => browse(entry.path)}
              style={{
                padding: '7px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '12px',
                color: '#cbd5e1',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#fbbf24' }}>📁</span>
              <span style={{ flex: 1 }}>{entry.name}</span>
              <span style={{ color: '#475569', fontSize: '10px' }}>›</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            background: '#1e293b', color: '#94a3b8', border: 'none',
            borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '12px',
          }}>
            ยกเลิก
          </button>
          <button
            onClick={() => current && onSelect(current.path)}
            disabled={!current}
            style={{
              background: current ? '#2563eb' : '#1e293b',
              color: current ? '#fff' : '#475569',
              border: 'none', borderRadius: 6,
              padding: '6px 14px', cursor: current ? 'pointer' : 'default',
              fontSize: '12px',
            }}
          >
            เลือกโฟลเดอร์นี้
          </button>
        </div>
      </div>
    </div>
  )
}
