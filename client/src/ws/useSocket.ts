import { useEffect, useRef, useState, useCallback } from 'react'
import type { WsEvent } from 'shared/types'

export type { WsEvent }

export function useSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let retryDelay = 1_000
    let destroyed = false

    function connect() {
      if (destroyed) return
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        retryDelay = 1_000
        setConnected(true)
      }
      ws.onclose = () => {
        setConnected(false)
        if (!destroyed) {
          setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30_000)
        }
      }
      ws.onmessage = (e) => {
        try {
          setLastEvent(JSON.parse(e.data) as WsEvent)
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()
    return () => {
      destroyed = true
      wsRef.current?.close()
    }
  }, [url])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send, lastEvent, connected }
}
