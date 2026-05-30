import { useEffect, useRef, useState, useCallback } from 'react'
import ChatPanel from './components/ChatPanel'
import { ProjectPicker } from './components/ProjectPicker'
import { SessionSidebar } from './components/SessionSidebar'
import { FileViewer } from './components/FileViewer'
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
  const [isRunning, setIsRunning] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [showFiles, setShowFiles] = useState(false)

  const { send, lastEvent } = useSocket('ws://localhost:3001/ws')

  useEffect(() => {
    if (!gameRef.current) return
    const game = startGame(gameRef.current)
    return () => { game.destroy(true) }
  }, [])

  // Load demo mode state from server on mount
  useEffect(() => {
    fetch('/api/demo').then(r => r.json()).then((d: { demo: boolean }) => setDemoMode(d.demo)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!lastEvent) return
    const { type } = lastEvent

    if (type === 'agent_thinking') setIsRunning(true)

    if (type === 'secretary_reply') {
      setMessages(prev => [...prev, { id: Date.now(), from: 'ฟ้า', content: lastEvent.content ?? '' }])
      setPendingCheckpoint(false)
      setIsRunning(false)
    }

    if (type === 'user_checkpoint') {
      setMessages(prev => [...prev, { id: Date.now(), from: 'ฟ้า', content: lastEvent.content ?? '' }])
      setPendingCheckpoint(true)
    }

    if (type === 'pipeline_resumed') setPendingCheckpoint(false)

    if (type === 'pipeline_cancelled') {
      setMessages(prev => [...prev, { id: Date.now(), from: 'ฟ้า', content: 'ยกเลิก pipeline แล้วค่ะ' }])
      setPendingCheckpoint(false)
      setIsRunning(false)
    }

    const evtAny = lastEvent as { type: string; sessionId?: string }
    if (evtAny.type === 'session_created' && evtAny.sessionId) {
      setCurrentSessionId(evtAny.sessionId)
    }

    getScene()?.handleEvent(lastEvent)
  }, [lastEvent])

  const handleSend = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now(), from: 'คุณ', content: text, isUser: true }])
    send({ content: text, sessionId: currentSessionId })
  }

  const handleCancel = useCallback(() => {
    send({ type: 'cancel', content: '' })
  }, [send])

  const handleToggleDemo = async () => {
    const res = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json() as { demo: boolean }
    setDemoMode(data.demo)
  }

  const handleSelectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`)
      const session = await res.json() as SessionData
      setCurrentSessionId(id)
      setPendingCheckpoint(false)
      setIsRunning(false)
      setMessages([
        { id: 0, from: 'ฟ้า', content: 'สวัสดีค่ะ — ทีมพร้อมแล้วค่ะ มีอะไรให้จัดการไหม?' },
        ...session.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map((m, i) => ({ id: i + 1, from: m.role === 'user' ? 'คุณ' : 'ฟ้า', content: m.content, isUser: m.role === 'user' })),
      ])
    } catch { /* ignore */ }
  }

  const handleNewSession = () => {
    setCurrentSessionId(null)
    setPendingCheckpoint(false)
    setIsRunning(false)
    setMessages([{ id: 0, from: 'ฟ้า', content: 'สวัสดีค่ะ — ทีมพร้อมแล้วค่ะ มีอะไรให้จัดการไหม?' }])
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <SessionSidebar
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleNewSession}
      />

      {/* Canvas + file viewer button */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={gameRef} style={{ width: '100%', height: '100%', background: '#0f0f1e' }} />
        <button
          onClick={() => setShowFiles(true)}
          title="ดู project files"
          style={{
            position: 'absolute', bottom: 12, right: 12,
            background: '#1e293b', border: '1px solid #334155',
            color: '#94a3b8', borderRadius: 8, padding: '6px 12px',
            cursor: 'pointer', fontSize: 11,
          }}
        >
          📁 Files
        </button>
      </div>

      {/* Right panel */}
      <div style={{ width: 360, display: 'flex', flexDirection: 'column' }}>
        <ProjectPicker onProjectSet={() => {}} />
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          onCancel={handleCancel}
          lastEvent={lastEvent}
          pendingCheckpoint={pendingCheckpoint}
          isRunning={isRunning}
          demoMode={demoMode}
          onToggleDemo={handleToggleDemo}
        />
      </div>

      {showFiles && <FileViewer onClose={() => setShowFiles(false)} />}
    </div>
  )
}
