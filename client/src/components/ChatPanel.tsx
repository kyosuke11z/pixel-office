import { useEffect, useRef, useState } from 'react'
import type { Message } from '../App'
import type { WsEvent } from '../ws/useSocket'

const AGENT_COLORS: Record<string, string> = {
  'ฟ้า': '#a78bfa',
  'อิง': '#f472b6',
  'ต้น': '#38bdf8',
  'แนน': '#fb7185',
  'เปา': '#60a5fa',
  'มิ้น': '#34d399',
  'โบ้ท': '#fb923c',
  'คุณ': '#f9fafb',
}

const THINKING_MAP: Record<string, string> = {
  secretary: 'ฟ้า',
  pm: 'อิง',
  techlead: 'ต้น',
  designer: 'แนน',
  dev: 'เปา',
  qa: 'มิ้น',
  tester: 'โบ้ท',
}

interface Props {
  messages: Message[]
  onSend: (text: string) => void
  lastEvent: WsEvent | null
  pendingCheckpoint: boolean
}

export default function ChatPanel({ messages, onSend, lastEvent, pendingCheckpoint }: Props) {
  const [input, setInput] = useState('')
  const [thinkingAgents, setThinkingAgents] = useState<Set<string>>(new Set())
  const [agentLog, setAgentLog] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, agentLog, thinkingAgents])

  useEffect(() => {
    if (!lastEvent) return

    if (lastEvent.type === 'agent_thinking') {
      const name = THINKING_MAP[lastEvent.agent ?? ''] ?? lastEvent.agent ?? ''
      setThinkingAgents(prev => new Set([...prev, name]))
    } else if (lastEvent.type === 'secretary_reply') {
      setThinkingAgents(new Set())
    } else if (lastEvent.type === 'user_checkpoint') {
      setThinkingAgents(new Set())
    } else if (lastEvent.type === 'pipeline_resumed') {
      setAgentLog(prev => [...prev, `▶ ${lastEvent.content ?? 'ดำเนินการต่อ'}`])
    } else if (lastEvent.type === 'agent_message') {
      const from = THINKING_MAP[lastEvent.from ?? ''] ?? lastEvent.from
      const to = THINKING_MAP[lastEvent.to ?? ''] ?? lastEvent.to
      const preview = (lastEvent.content ?? '').slice(0, 80)
      setAgentLog(prev => [
        ...prev,
        `[${from} → ${to}]: ${preview}${preview.length >= 80 ? '...' : ''}`,
      ])
      // ลบคนที่เพิ่งส่งงานออกจาก thinking
      if (lastEvent.from) {
        const name = THINKING_MAP[lastEvent.from] ?? lastEvent.from
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

  const quickReply = (text: string) => {
    onSend(text)
    setInput('')
  }

  const isCheckpoint = lastEvent?.type === 'user_checkpoint'
  const thinkingList = [...thinkingAgents]

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#0f0f23',
      borderLeft: '1px solid #2d2d4e',
      color: '#e2e8f0',
      fontSize: 13,
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d2d4e', background: '#1a1a35' }}>
        <div style={{ fontWeight: 'bold', color: '#a78bfa' }}>🏢 Pixel Office</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>AI Team — หัวหน้าคุณ</div>
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
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 6, marginTop: 2 }}>
            {agentLog.map((log, i) => (
              <div key={i} style={{
                fontSize: 10,
                color: log.startsWith('▶') ? '#22d3ee' : '#475569',
                marginBottom: 2,
              }}>
                {log}
              </div>
            ))}
          </div>
        )}

        {thinkingList.length > 0 && (
          <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
            {thinkingList.length === 1
              ? `${thinkingList[0]} กำลังคิด...`
              : `${thinkingList.join(' + ')} กำลังทำงานพร้อมกัน...`}
          </div>
        )}

        {/* Checkpoint UI — user เป็นคนตัดสินใจ */}
        {isCheckpoint && (
          <div style={{
            border: '1px solid #f59e0b',
            borderRadius: 8,
            padding: 12,
            background: '#1c1200',
            marginTop: 4,
          }}>
            <div style={{ color: '#fbbf24', fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>
              🔔 รอการอนุมัติจากหัวหน้า
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => quickReply('ต่อ')} style={btnStyle('#15803d')}>
                ✅ อนุมัติ / ต่อ
              </button>
              <button onClick={() => quickReply('หยุดก่อน')} style={btnStyle('#9f1239')}>
                ⏸ หยุดก่อน
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
              หรือพิมพ์คำสั่งแก้ไขได้เลย
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #2d2d4e', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={isCheckpoint ? 'พิมพ์คำสั่งแก้ไข หรือกด ✅ ด้านบน...' : 'พิมพ์ข้อความถึงฟ้า...'}
          style={{
            flex: 1,
            background: '#1e293b',
            border: `1px solid ${isCheckpoint ? '#f59e0b' : '#334155'}`,
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
            background: isCheckpoint ? '#d97706' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 14px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {isCheckpoint ? 'ส่ง' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 11,
  }
}
