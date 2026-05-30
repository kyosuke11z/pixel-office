import { useEffect, useRef, useState } from 'react'
import type { Message } from '../App'
import type { WsEvent } from '../ws/useSocket'

const AGENT_COLORS: Record<string, string> = {
  'ฟ้า': '#a78bfa',
  'เปา': '#60a5fa',
  'มิ้น': '#34d399',
  'โบ้ท': '#fb923c',
  'คุณ': '#f9fafb',
}

const THINKING_MAP: Record<string, string> = {
  secretary: 'ฟ้า',
  dev: 'เปา',
  qa: 'มิ้น',
  tester: 'โบ้ท',
}

interface Props {
  messages: Message[]
  onSend: (text: string) => void
  lastEvent: WsEvent | null
}

export default function ChatPanel({ messages, onSend, lastEvent }: Props) {
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState<string | null>(null)
  const [agentLog, setAgentLog] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, agentLog, thinking])

  useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.type === 'agent_thinking') {
      setThinking(THINKING_MAP[lastEvent.agent ?? ''] ?? lastEvent.agent ?? null)
    } else if (lastEvent.type === 'secretary_reply') {
      setThinking(null)
    } else if (lastEvent.type === 'agent_message') {
      const from = THINKING_MAP[lastEvent.from ?? ''] ?? lastEvent.from
      const to = THINKING_MAP[lastEvent.to ?? ''] ?? lastEvent.to
      const preview = (lastEvent.content ?? '').slice(0, 80)
      setAgentLog(prev => [...prev, `[${from} → ${to}]: ${preview}${preview.length >= 80 ? '...' : ''}`])
      setThinking(null)
    }
  }, [lastEvent])

  const handleSend = () => {
    if (!input.trim()) return
    setAgentLog([])
    onSend(input.trim())
    setInput('')
  }

  return (
    <div style={{
      width: 360,
      display: 'flex',
      flexDirection: 'column',
      background: '#0f0f23',
      borderLeft: '1px solid #2d2d4e',
      color: '#e2e8f0',
      fontSize: 13,
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d2d4e', background: '#1a1a35' }}>
        <div style={{ fontWeight: 'bold', color: '#a78bfa' }}>🏢 Pixel Office</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>AI Team Simulation</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isUser ? 'flex-end' : 'flex-start' }}>
            <span style={{ fontSize: 10, color: AGENT_COLORS[msg.from] ?? '#94a3b8', marginBottom: 2 }}>
              {msg.from}
            </span>
            <div style={{
              background: msg.isUser ? '#312e81' : '#1e293b',
              padding: '8px 12px',
              borderRadius: 8,
              maxWidth: '85%',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {agentLog.length > 0 && (
          <div style={{ borderTop: '1px solid #2d2d4e', paddingTop: 8, marginTop: 4 }}>
            {agentLog.map((log, i) => (
              <div key={i} style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{log}</div>
            ))}
          </div>
        )}

        {thinking && (
          <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
            {thinking} กำลังคิด...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #2d2d4e', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="พิมพ์ข้อความถึงฟ้า..."
          style={{
            flex: 1,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#e2e8f0',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            background: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 14px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          ส่ง
        </button>
      </div>
    </div>
  )
}
