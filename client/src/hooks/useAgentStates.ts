import { useState, useCallback } from 'react'
import type { WsEvent } from '../ws/useSocket'
import { createAgentStates, type AgentState } from '../components/AgentDock'

const THINKING_MAP: Record<string, string> = {
  secretary: 'ฟ้า', pm: 'อิง', techlead: 'ต้น',
  designer: 'แนน', dev: 'เปา', qa: 'มิ้น', tester: 'โบ้ท',
}

function now() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function addLog(logs: AgentState['log'], text: string): AgentState['log'] {
  return [...logs, { time: now(), text }].slice(-12) // เก็บแค่ 12 รายการล่าสุด
}

export function useAgentStates() {
  const [states, setStates] = useState<Record<string, AgentState>>(createAgentStates)

  const update = useCallback((id: string, patch: Partial<AgentState>) => {
    setStates(prev => {
      if (!prev[id]) return prev
      return { ...prev, [id]: { ...prev[id], ...patch } }
    })
  }, [])

  const handleEvent = useCallback((evt: WsEvent) => {
    const { type, agent, from, to, content } = evt

    if (type === 'agent_thinking' && agent) {
      update(agent, {
        statusType: 'thinking',
        status: 'กำลังนึกอยู่...',
        log: addLog(
          (states[agent]?.log ?? []),
          'เริ่มคิด...'
        ),
      })
    }

    if (type === 'agent_status' && agent) {
      const text = content ?? ''
      const isDone = text.includes('เสร็จแล้ว')
      const isWait = text.includes('รอ') || text.includes('ลองใหม่') || text.includes('พัก')
      update(agent, {
        status: text,
        statusType: isDone ? 'done' : isWait ? 'waiting' : 'working',
        log: isDone ? addLog(states[agent]?.log ?? [], text) : (states[agent]?.log ?? []),
      })
    }

    if (type === 'agent_message' && from) {
      const fromName = THINKING_MAP[from] ?? from
      const toName = to ? (THINKING_MAP[to] ?? to) : ''
      const preview = (content ?? '').replace(/#+\s*/g, '').replace(/\*+/g, '').trim().slice(0, 80)
      update(from, {
        statusType: 'done',
        status: `ส่งงานให้ ${toName} แล้ว`,
        lastTalkedTo: toName,
        log: addLog(states[from]?.log ?? [], `→ ${toName}: ${preview}${preview.length >= 80 ? '…' : ''}`),
      })
      if (to && states[to]) {
        update(to, {
          log: addLog(states[to]?.log ?? [], `← ${fromName}: ${preview}${preview.length >= 80 ? '…' : ''}`),
        })
      }
    }

    if (type === 'agent_move' && from && to) {
      const toName = THINKING_MAP[to] ?? to
      update(from as string, {
        status: `กำลังเดินไปหา ${toName}`,
        log: addLog(states[from as string]?.log ?? [], `เดินไปหา ${toName}`),
      })
    }

    if (type === 'secretary_reply' || type === 'pipeline_cancelled') {
      // reset ทุกคน
      setStates(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(id => {
          next[id] = {
            ...next[id],
            statusType: type === 'pipeline_cancelled' ? 'cancelled' : 'idle',
            status: type === 'pipeline_cancelled' ? 'ยกเลิก' : '',
          }
        })
        return next
      })
      // clear cancelled state หลัง 2 วินาที
      if (type === 'pipeline_cancelled') {
        setTimeout(() => {
          setStates(prev => {
            const next = { ...prev }
            Object.keys(next).forEach(id => {
              if (next[id].statusType === 'cancelled') {
                next[id] = { ...next[id], statusType: 'idle', status: '' }
              }
            })
            return next
          })
        }, 2000)
      }
    }

    if (type === 'pipeline_resumed') {
      // ทุกคนที่ done ให้กลับ idle รอ
      setStates(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(id => {
          if (next[id].statusType === 'done') {
            next[id] = { ...next[id], statusType: 'idle', status: '' }
          }
        })
        return next
      })
    }
  }, [states, update])

  return { agentStates: states, handleAgentEvent: handleEvent }
}
