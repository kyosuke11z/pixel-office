import { useState, useEffect } from 'react'

interface FileEntry { name: string; type: 'file' | 'dir'; path: string }

const EXT_ICON: Record<string, string> = {
  ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨',
  json: '📋', md: '📝', html: '🌐', css: '🎨',
  py: '🐍', sh: '⚙️', txt: '📄', env: '🔑',
}

function extIcon(name: string): string {
  const ext = name.split('.').pop() ?? ''
  return EXT_ICON[ext] ?? '📄'
}

interface Props { onClose: () => void }

export function FileViewer({ onClose }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/files')
      .then(r => r.json())
      .then((data: FileEntry[] | { error: string }) => {
        if ('error' in data) setError(data.error)
        else setFiles(data)
      })
      .catch(() => setError('โหลดไฟล์ไม่ได้ — ตั้ง project directory ก่อนนะ'))
  }, [])

  const openFile = async (path: string) => {
    setSelected(path)
    setContent(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`)
      const data = await res.json() as { content?: string; error?: string }
      if (data.error) setContent(`❌ ${data.error}`)
      else setContent(data.content ?? '')
    } catch {
      setContent('❌ โหลดไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  const dirs = files.filter(f => f.type === 'dir')
  const fileList = files.filter(f => f.type === 'file')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#0f172a', border: '1px solid #334155', borderRadius: 12,
        width: 700, height: '75vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold', flex: 1 }}>📁 Project Files</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* File tree */}
          <div style={{ width: 220, borderRight: '1px solid #1e293b', overflowY: 'auto', padding: '8px 0' }}>
            {error && <div style={{ padding: '12px', color: '#f87171', fontSize: 11 }}>{error}</div>}

            {dirs.length > 0 && (
              <>
                <div style={{ padding: '4px 12px', color: '#475569', fontSize: 10 }}>FOLDERS</div>
                {dirs.map(f => (
                  <div key={f.path} style={{ padding: '4px 12px', color: '#64748b', fontSize: 11 }}>
                    📁 {f.name}/
                  </div>
                ))}
                <div style={{ height: 8 }} />
              </>
            )}

            {fileList.length > 0 && (
              <>
                <div style={{ padding: '4px 12px', color: '#475569', fontSize: 10 }}>FILES</div>
                {fileList.map(f => (
                  <div
                    key={f.path}
                    onClick={() => openFile(f.path)}
                    style={{
                      padding: '5px 12px', cursor: 'pointer', fontSize: 11,
                      background: selected === f.path ? '#1e293b' : 'transparent',
                      borderLeft: selected === f.path ? '2px solid #60a5fa' : '2px solid transparent',
                      color: selected === f.path ? '#e2e8f0' : '#94a3b8',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span>{extIcon(f.name)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  </div>
                ))}
              </>
            )}

            {files.length === 0 && !error && (
              <div style={{ padding: 12, color: '#475569', fontSize: 11 }}>กำลังโหลด...</div>
            )}
          </div>

          {/* Code viewer */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#070b14' }}>
            {!selected && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155', fontSize: 12 }}>
                เลือกไฟล์เพื่อดูเนื้อหา
              </div>
            )}
            {selected && loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: 12 }}>
                กำลังโหลด...
              </div>
            )}
            {selected && !loading && content !== null && (
              <>
                <div style={{ padding: '6px 16px', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>
                  {selected}
                </div>
                <pre style={{
                  margin: 0, padding: '12px 16px',
                  color: '#e2e8f0', fontSize: 11, lineHeight: 1.6,
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {content}
                </pre>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
