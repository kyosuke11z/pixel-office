import { useState, useEffect } from 'react'
import { FolderBrowser } from './FolderBrowser'

interface Props {
  onProjectSet: (path: string) => void
}

const styles = {
  root: { padding: '8px 12px', background: '#0f172a', borderBottom: '1px solid #1e293b', fontSize: '11px' } as React.CSSProperties,
  label: { color: '#64748b', marginBottom: 6 } as React.CSSProperties,
  pathRow: { display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  pathText: { flex: 1, color: '#22d3ee', wordBreak: 'break-all', fontSize: '10px', lineHeight: 1.4 } as React.CSSProperties,
  changeBtn: { background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '10px', flexShrink: 0 } as React.CSSProperties,
  pickBtn: { width: '100%', background: '#1e293b', border: '1px dashed #334155', borderRadius: 6, color: '#64748b', padding: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 } as React.CSSProperties,
  error: { color: '#f87171', marginTop: 4, fontSize: '10px' } as React.CSSProperties,
}

export function ProjectPicker({ onProjectSet }: Props) {
  const [current, setCurrent] = useState<string | null>(null)
  const [showBrowser, setShowBrowser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/project')
      .then(r => r.json())
      .then((d: { path?: string }) => {
        if (d.path) { setCurrent(d.path); onProjectSet(d.path) }
      })
      .catch(() => {})
  }, [])

  const handleSelect = async (path: string) => {
    setShowBrowser(false)
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/project', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const data = await res.json() as { path?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      setCurrent(data.path ?? null)
      if (data.path) onProjectSet(data.path)
    } catch {
      setError('ไม่สามารถเชื่อมต่อ server ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={styles.root}>
        <div style={styles.label}>📁 Project Directory</div>

        {current ? (
          <div style={styles.pathRow}>
            <div style={styles.pathText}>
              {current}
            </div>
            <button onClick={() => setShowBrowser(true)} style={styles.changeBtn}>
              เปลี่ยน
            </button>
          </div>
        ) : (
          <button onClick={() => setShowBrowser(true)} disabled={loading} style={styles.pickBtn}>
            {loading ? 'กำลังตั้งค่า...' : '🔍 เลือกโฟลเดอร์โปรเจค'}
          </button>
        )}

        {error && <div style={styles.error}>{error}</div>}
      </div>

      {showBrowser && (
        <FolderBrowser
          onSelect={handleSelect}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </>
  )
}
