import { useState, useEffect } from 'react'

interface Props {
  onProjectSet: (path: string) => void
}

export function ProjectPicker({ onProjectSet }: Props) {
  const [path, setPath] = useState('')
  const [current, setCurrent] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/project')
      .then(r => r.json())
      .then((d: { path?: string }) => {
        if (d.path) { setCurrent(d.path); onProjectSet(d.path) }
      })
      .catch(() => {})
  }, [])

  const handleSet = async () => {
    if (!path.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/project', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.trim() }),
      })
      const data = await res.json() as { path?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      setCurrent(data.path ?? null)
      if (data.path) onProjectSet(data.path)
      setPath('')
    } catch {
      setError('ไม่สามารถเชื่อมต่อ server ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '8px 12px',
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      fontSize: '11px',
    }}>
      <div style={{ color: '#64748b', marginBottom: 4 }}>📁 Project Directory</div>
      {current && (
        <div style={{ color: '#22d3ee', marginBottom: 6, wordBreak: 'break-all' }}>
          {current}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={path}
          onChange={e => setPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSet()}
          placeholder="/Users/you/project"
          style={{
            flex: 1, background: '#1e293b', border: '1px solid #334155',
            color: '#e2e8f0', borderRadius: 4, padding: '4px 8px', fontSize: '11px',
          }}
        />
        <button
          onClick={handleSet}
          disabled={loading || !path.trim()}
          style={{
            background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 4,
            padding: '4px 10px', cursor: 'pointer', fontSize: '11px',
            opacity: loading || !path.trim() ? 0.5 : 1,
          }}
        >
          {loading ? '...' : 'ตั้ง'}
        </button>
      </div>
      {error && <div style={{ color: '#f87171', marginTop: 4 }}>{error}</div>}
    </div>
  )
}
