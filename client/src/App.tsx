import { useEffect, useRef, useState } from 'react'
import ChatPanel from './components/ChatPanel'
import { useSocket } from './ws/useSocket'
import { startGame, getScene } from './game/config'

export type Message = {
  id: number
  from: string
  content: string
  isUser?: boolean
}

export default function App() {
  const gameRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'ฟ้า', content: 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?' },
  ])

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
    }
  }, [lastEvent])

  useEffect(() => {
    if (!lastEvent) return
    const scene = getScene()
    scene?.handleEvent(lastEvent)
  }, [lastEvent])

  const handleSend = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      from: 'คุณ',
      content: text,
      isUser: true,
    }])
    send({ content: text })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div ref={gameRef} style={{ flex: 1, background: '#0f0f1e' }} />
      <ChatPanel messages={messages} onSend={handleSend} lastEvent={lastEvent} />
    </div>
  )
}
