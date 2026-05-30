import { useEffect, useRef, useState, useCallback } from 'react'

export interface WsEvent {
  type: string
  agent?: string
  from?: string
  to?: string
  content?: string
}

export function useSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as WsEvent
        setLastEvent(event)
      } catch {
        // ignore malformed messages
      }
    }

    return () => ws.close()
  }, [url])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send, lastEvent, connected }
}
