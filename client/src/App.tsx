import { useEffect, useRef, useState } from 'react'
import ChatPanel from './components/ChatPanel'
import { ProjectPicker } from './components/ProjectPicker'
import { SessionSidebar } from './components/SessionSidebar'
import { useSocket } from './ws/useSocket'
import { startGame, getScene } from './game/config'

export type Message = {
  id: number
  from: string
  content: string
  isUser?: boolean
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'agent'
  content: string
  agentId?: string
  timestamp: string
}

interface SessionData {
  id: string
  title: string
  messages: SessionMessage[]
}

export default function App() {
  const gameRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'ฟ้า', content: 'สวัสดีค่ะ — ทีมพร้อมแล้วค่ะ มีอะไรให้จัดการไหม?' },
  ])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [pendingCheckpoint, setPendingCheckpoint] = useState(false)

  const { send, lastEvent } = useSocket('ws://localhost:3001/ws')

  useEffect(() => {
    if (!gameRef.current) return
    const game = startGame(gameRef.current)
    return () => { game.destroy(true) }
  }, [])

  useEffect(() => {
    if (!lastEvent) return

    if (lastEvent.type === 'secretary_reply') {
      setMessages(prev => [...prev, {
        id: Date.now(),
        from: 'ฟ้า',
        content: lastEvent.content ?? '',
      }])
      setPendingCheckpoint(false)
    }

    if (lastEvent.type === 'user_checkpoint') {
      setMessages(prev => [...prev, {
        id: Date.now(),
        from: 'ฟ้า',
        content: lastEvent.content ?? '',
      }])
      setPendingCheckpoint(true)
    }

    if (lastEvent.type === 'pipeline_resumed') {
      setPendingCheckpoint(false)
    }

    const evtWithSession = lastEvent as unknown as { type: string; sessionId?: string }
    if (evtWithSession.type === 'session_created' && evtWithSession.sessionId) {
      setCurrentSessionId(evtWithSession.sessionId)
    }

    getScene()?.handleEvent(lastEvent)
  }, [lastEvent])

  const handleSend = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      from: 'คุณ',
      content: text,
      isUser: true,
    }])
    send({ content: text, sessionId: currentSessionId })
  }

  const handleSelectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`)
      const session = await res.json() as SessionData
      setCurrentSessionId(id)
      setPendingCheckpoint(false)
      setMessages([
        { id: 0, from: 'ฟ้า', content: 'สวัสดีค่ะ — ทีมพร้อมแล้วค่ะ มีอะไรให้จัดการไหม?' },
        ...session.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map((m, i) => ({
            id: i + 1,
            from: m.role === 'user' ? 'คุณ' : 'ฟ้า',
            content: m.content,
            isUser: m.role === 'user',
          })),
      ])
    } catch { /* ignore */ }
  }

  const handleNewSession = () => {
    setCurrentSessionId(null)
    setPendingCheckpoint(false)
    setMessages([{ id: 0, from: 'ฟ้า', content: 'สวัสดีค่ะ — ทีมพร้อมแล้วค่ะ มีอะไรให้จัดการไหม?' }])
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <SessionSidebar
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />
      <div ref={gameRef} style={{ flex: 1, background: '#0f0f1e' }} />
      <div style={{ width: 360, display: 'flex', flexDirection: 'column' }}>
        <ProjectPicker onProjectSet={(p) => console.log('project set:', p)} />
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          lastEvent={lastEvent}
          pendingCheckpoint={pendingCheckpoint}
        />
      </div>
    </div>
  )
}
