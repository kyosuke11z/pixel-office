import { useState, useEffect } from 'react'

interface Provider {
  id: string
  name: string
  baseURL: string
  apiKey: string
  model: string
  isActive: boolean
}

interface Props {
  onClose: () => void
}

const TEMPLATES = [
  { name: 'Moonshot Official', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: 'Groq (llama-3.3-70b)', baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { name: 'DeepSeek Chat', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
]

export function ProviderSettings({ onClose }: Props) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', baseURL: '', apiKey: '', model: '' })
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  const load = () => {
    fetch('/api/providers').then(r => r.json()).then(setProviders).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const activate = async (id: string) => {
    await fetch(`/api/providers/${id}/activate`, { method: 'PUT' })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('ลบ provider นี้?')) return
    await fetch(`/api/providers/${id}`, { method: 'DELETE' })
    load()
  }

  const save = async () => {
    if (!form.name || !form.baseURL || !form.apiKey || !form.model) return
    if (editId) {
      await fetch(`/api/providers/${editId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setAdding(false); setEditId(null); setForm({ name: '', baseURL: '', apiKey: '', model: '' })
    load()
  }

  const test = async (p: Provider) => {
    setTesting(p.id)
    setTestResult(prev => ({ ...prev, [p.id]: 'กำลังทดสอบ...' }))
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseURL: p.baseURL, apiKey: p.apiKey, model: p.model }),
      })
      const data = await res.json() as { ok: boolean; response?: string; error?: string }
      setTestResult(prev => ({ ...prev, [p.id]: data.ok ? `✅ ตอบ: "${data.response}"` : `❌ ${data.error}` }))
    } catch {
      setTestResult(prev => ({ ...prev, [p.id]: '❌ เชื่อมต่อไม่ได้' }))
    } finally { setTesting(null) }
  }

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setForm(f => ({ ...f, name: t.name, baseURL: t.baseURL, model: t.model }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#0f172a', border: '1px solid #334155', borderRadius: 12,
        width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 'bold', flex: 1 }}>⚙️ LLM Providers</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {providers.map(p => (
            <div key={p.id} style={{
              border: `1px solid ${p.isActive ? '#2563eb' : '#1e293b'}`,
              borderRadius: 8, padding: '10px 12px', marginBottom: 10,
              background: p.isActive ? '#0f1e3d' : '#070b14',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: p.isActive ? '#22d3ee' : '#334155',
                }} />
                <span style={{ color: p.isActive ? '#e2e8f0' : '#94a3b8', fontSize: 13, fontWeight: 'bold', flex: 1 }}>
                  {p.name}
                  {p.isActive && <span style={{ color: '#22d3ee', fontSize: 10, marginLeft: 6 }}>ACTIVE</span>}
                </span>
                <button onClick={() => test(p)} disabled={testing === p.id}
                  style={{ background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10 }}>
                  {testing === p.id ? '...' : 'ทดสอบ'}
                </button>
                {!p.isActive && (
                  <button onClick={() => activate(p.id)}
                    style={{ background: '#1e40af', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10 }}>
                    ใช้งาน
                  </button>
                )}
                <button onClick={() => { setEditId(p.id); setForm({ name: p.name, baseURL: p.baseURL, apiKey: p.apiKey, model: p.model }); setAdding(true) }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                {!p.isActive && (
                  <button onClick={() => remove(p.id)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                )}
              </div>
              <div style={{ color: '#475569', fontSize: 10, marginLeft: 16 }}>{p.model} · {p.baseURL.replace('https://', '')}</div>
              {p.apiKey && <div style={{ color: '#334155', fontSize: 10, marginLeft: 16 }}>key: {'•'.repeat(8) + p.apiKey.slice(-4)}</div>}
              {testResult[p.id] && <div style={{ color: testResult[p.id].startsWith('✅') ? '#22d3ee' : '#f87171', fontSize: 10, marginLeft: 16, marginTop: 4 }}>{testResult[p.id]}</div>}
            </div>
          ))}

          {!adding && (
            <button onClick={() => { setAdding(true); setEditId(null); setForm({ name: '', baseURL: '', apiKey: '', model: '' }) }}
              style={{ width: '100%', background: '#1e293b', border: '1px dashed #334155', color: '#64748b', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12 }}>
              + เพิ่ม Provider ใหม่
            </button>
          )}

          {adding && (
            <div style={{ border: '1px solid #334155', borderRadius: 8, padding: 14, background: '#0a0f1e' }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                {editId ? 'แก้ไข Provider' : 'เพิ่ม Provider ใหม่'}
              </div>

              {!editId && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: '#475569', fontSize: 10, marginBottom: 6 }}>เทมเพลต:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TEMPLATES.map(t => (
                      <button key={t.name} onClick={() => applyTemplate(t)}
                        style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10 }}>
                        {t.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {[
                { key: 'name', label: 'ชื่อ', placeholder: 'Groq Production' },
                { key: 'baseURL', label: 'Base URL', placeholder: 'https://api.groq.com/openai/v1' },
                { key: 'apiKey', label: 'API Key', placeholder: 'gsk_...' },
                { key: 'model', label: 'Model', placeholder: 'llama-3.3-70b-versatile' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <div style={{ color: '#64748b', fontSize: 10, marginBottom: 3 }}>{f.label}</div>
                  <input
                    type={f.key === 'apiKey' ? 'password' : 'text'}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{
                      width: '100%', background: '#1e293b', border: '1px solid #334155',
                      color: '#e2e8f0', borderRadius: 4, padding: '5px 8px', fontSize: 11,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={save} style={{ background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 12 }}>
                  {editId ? 'บันทึก' : 'เพิ่ม'}
                </button>
                <button onClick={() => { setAdding(false); setEditId(null) }}
                  style={{ background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
