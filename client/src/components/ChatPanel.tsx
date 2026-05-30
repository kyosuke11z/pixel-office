import { useEffect, useRef, useState } from 'react'
import type { Message } from '../App'
import type { WsEvent } from '../ws/useSocket'

const AGENT_COLORS: Record<string, string> = {
  'ฟ้า': '#a78bfa', 'อิง': '#f472b6', 'ต้น': '#38bdf8',
  'แนน': '#fb7185', 'เปา': '#60a5fa', 'มิ้น': '#34d399',
  'โบ้ท': '#fb923c', 'คุณ': '#f9fafb',
}

const THINKING_MAP: Record<string, string> = {
  secretary: 'ฟ้า', pm: 'อิง', techlead: 'ต้น',
  designer: 'แนน', dev: 'เปา', qa: 'มิ้น', tester: 'โบ้ท',
}

interface Props {
  messages: Message[]
  onSend: (text: string) => void
  onCancel: () => void
  lastEvent: WsEvent | null
  pendingCheckpoint: boolean
  isRunning: boolean
  demoMode: boolean
  onToggleDemo: () => void
}

export default function ChatPanel({ messages, onSend, onCancel, lastEvent, pendingCheckpoint, isRunning, demoMode, onToggleDemo }: Props) {
  const [input, setInput] = useState('')
  const [thinkingAgents, setThinkingAgents] = useState<Set<string>>(new Set())
  const [agentLog, setAgentLog] = useState<string[]>([])
  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, agentLog, thinkingAgents])

  useEffect(() => {
    if (!lastEvent) return
    const { type, agent, from, content } = lastEvent

    if (type === 'agent_thinking') {
      const name = THINKING_MAP[agent ?? ''] ?? agent ?? ''
      setThinkingAgents(prev => new Set([...prev, name]))
      setAgentStatus(prev => ({ ...prev, [name]: 'กำลังเตรียม...' }))
    } else if (type === 'agent_status') {
      const name = THINKING_MAP[agent ?? ''] ?? agent ?? ''
      setAgentStatus(prev => ({ ...prev, [name]: content ?? '' }))
    } else if (type === 'secretary_reply' || type === 'pipeline_cancelled') {
      setThinkingAgents(new Set())
      setAgentStatus({})
      if (type === 'pipeline_cancelled') {
        setAgentLog(prev => [...prev, '⛔ ยกเลิก pipeline แล้ว'])
      }
    } else if (type === 'user_checkpoint') {
      setThinkingAgents(new Set())
    } else if (type === 'pipeline_resumed') {
      setAgentLog(prev => [...prev, `▶ ${content ?? 'ดำเนินการต่อ'}`])
    } else if (type === 'agent_message') {
      const fromName = THINKING_MAP[from ?? ''] ?? from
      const toName = THINKING_MAP[lastEvent.to ?? ''] ?? lastEvent.to
      const preview = (content ?? '').slice(0, 80)
      setAgentLog(prev => [...prev, `[${fromName} → ${toName}]: ${preview}${preview.length >= 80 ? '...' : ''}`])
      if (from) {
        const name = THINKING_MAP[from] ?? from
        setThinkingAgents(prev => { const s = new Set(prev); s.delete(name); return s })
      }
    }
  }, [lastEvent])

  const handleSend = () => {
    if (!input.trim()) return
    if (!pendingCheckpoint) setAgentLog([])
    onSend(input.trim())
    setInput('')
  }

  const quickReply = (text: string) => { onSend(text); setInput('') }

  const isCheckpoint = lastEvent?.type === 'user_checkpoint'
  const thinkingList = [...thinkingAgents]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f23', borderLeft: '1px solid #2d2d4e', color: '#e2e8f0', fontSize: 13 }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #2d2d4e', background: '#1a1a35', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', color: '#a78bfa', fontSize: 12 }}>🏢 Pixel Office</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>AI Team — หัวหน้าคุณ</div>
        </div>

        {/* Demo toggle */}
        <button
          onClick={onToggleDemo}
          title={demoMode ? 'ปิด Demo Mode' : 'เปิด Demo Mode (ตอบเร็ว ไม่เรียก LLM)'}
          style={{
            background: demoMode ? '#7c3aed' : '#1e293b',
            border: `1px solid ${demoMode ? '#7c3aed' : '#334155'}`,
            color: demoMode ? '#fff' : '#64748b',
            borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 10,
          }}
        >
          {demoMode ? '⚡ Demo ON' : '⚡ Demo'}
        </button>

        {/* Cancel button — แสดงเมื่อ pipeline รันอยู่ */}
        {isRunning && !isCheckpoint && (
          <button
            onClick={onCancel}
            title="ยกเลิก pipeline ที่รันอยู่"
            style={{
              background: '#7f1d1d', border: '1px solid #991b1b',
              color: '#fca5a5', borderRadius: 5, padding: '3px 10px',
              cursor: 'pointer', fontSize: 10, fontWeight: 'bold',
            }}
          >
            ⛔ ยกเลิก
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isUser ? 'flex-end' : 'flex-start' }}>
            <span style={{ fontSize: 10, color: AGENT_COLORS[msg.from] ?? '#94a3b8', marginBottom: 2 }}>{msg.from}</span>
            <div style={{
              background: msg.isUser ? '#312e81' : '#1e293b',
              padding: '8px 12px', borderRadius: 8, maxWidth: '85%',
              lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Agent log */}
        {agentLog.length > 0 && (
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 6, marginTop: 2 }}>
            {agentLog.map((log, i) => (
              <div key={i} style={{
                fontSize: 10, marginBottom: 2,
                color: log.startsWith('▶') ? '#22d3ee' : log.startsWith('⛔') ? '#f87171' : '#475569',
              }}>
                {log}
              </div>
            ))}
          </div>
        )}

        {/* Thinking status */}
        {thinkingList.length > 0 && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
            {thinkingList.map(name => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: isWaiting(agentStatus[name]) ? '#f59e0b' : '#22d3ee',
                  animation: 'pulse 1.2s infinite',
                }} />
                <span style={{ color: AGENT_COLORS[name] ?? '#94a3b8', fontSize: 11, fontWeight: 'bold', minWidth: 28 }}>
                  {name}
                </span>
                <span style={{
                  fontSize: 10, fontStyle: 'italic',
                  color: isWaiting(agentStatus[name]) ? '#f59e0b' : '#64748b',
                }}>
                  {agentStatus[name] || 'กำลังทำงาน...'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Checkpoint */}
        {isCheckpoint && (
          <div style={{ border: '1px solid #f59e0b', borderRadius: 8, padding: 12, background: '#1c1200', marginTop: 4 }}>
            <div style={{ color: '#fbbf24', fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>🔔 รอการอนุมัติจากหัวหน้า</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => quickReply('ต่อ')} style={btnStyle('#15803d')}>✅ อนุมัติ / ต่อ</button>
              <button onClick={onCancel} style={btnStyle('#7f1d1d')}>⛔ ยกเลิก</button>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>หรือพิมพ์คำสั่งแก้ไขได้เลย</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid #2d2d4e', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={isCheckpoint ? 'พิมพ์คำสั่งแก้ไข หรือกด ✅ ด้านบน...' : 'พิมพ์ข้อความถึงฟ้า...'}
          style={{
            flex: 1, background: '#1e293b',
            border: `1px solid ${isCheckpoint ? '#f59e0b' : '#334155'}`,
            borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={handleSend} style={{
          background: isCheckpoint ? '#d97706' : '#7c3aed',
          color: 'white', border: 'none', borderRadius: 6,
          padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold',
        }}>
          ส่ง
        </button>
      </div>
    </div>
  )
}

function isWaiting(status?: string): boolean {
  return !!(status && (status.includes('รอ') || status.includes('retry') || status.includes('ลองใหม่')))
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }
}
