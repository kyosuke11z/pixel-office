import { useState, useCallback } from 'react'
import type { WsEvent } from 'shared/types'
import { createAgentStates, type AgentState } from '../components/AgentDock'
import { agentIdToName } from '../constants/agents'

function now() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function addLog(logs: AgentState['log'], text: string): AgentState['log'] {
  return [...logs, { time: now(), text }].slice(-12)
}

export function useAgentStates() {
  const [states, setStates] = useState<Record<string, AgentState>>(createAgentStates)

  const handleEvent = useCallback((evt: WsEvent) => {
    const { type, agent, from, to, content } = evt

    if (type === 'agent_thinking' && agent) {
      setStates(prev => {
        const s = prev[agent]
        if (!s) return prev
        return { ...prev, [agent]: { ...s, statusType: 'thinking', status: 'กำลังนึกอยู่...', log: addLog(s.log, 'เริ่มคิด...') } }
      })
    }

    if (type === 'agent_status' && agent) {
      const text = content ?? ''
      const isDone = text.includes('เสร็จแล้ว')
      const isWait = text.includes('รอ') || text.includes('ลองใหม่') || text.includes('พัก')
      setStates(prev => {
        const s = prev[agent]
        if (!s) return prev
        return {
          ...prev,
          [agent]: {
            ...s,
            status: text,
            statusType: isDone ? 'done' : isWait ? 'waiting' : 'working',
            log: isDone ? addLog(s.log, text) : s.log,
          },
        }
      })
    }

    if (type === 'agent_message' && from) {
      const fromName = agentIdToName(from)
      const toName = to ? agentIdToName(to) : ''
      const preview = (content ?? '').replace(/#+\s*/g, '').replace(/\*+/g, '').trim().slice(0, 80)
      const previewText = preview + (preview.length >= 80 ? '…' : '')

      setStates(prev => {
        const next = { ...prev }
        const fromState = prev[from]
        if (fromState) {
          next[from] = {
            ...fromState,
            statusType: 'done',
            status: `ส่งงานให้ ${toName} แล้ว`,
            lastTalkedTo: toName,
            log: addLog(fromState.log, `→ ${toName}: ${previewText}`),
          }
        }
        if (to && prev[to]) {
          const toState = prev[to]
          next[to] = { ...toState, log: addLog(toState.log, `← ${fromName}: ${previewText}`) }
        }
        return next
      })
    }

    if (type === 'agent_move' && from && to) {
      const toName = agentIdToName(to)
      setStates(prev => {
        const s = prev[from]
        if (!s) return prev
        return { ...prev, [from]: { ...s, status: `กำลังเดินไปหา ${toName}`, log: addLog(s.log, `เดินไปหา ${toName}`) } }
      })
    }

    if (type === 'secretary_reply' || type === 'pipeline_cancelled') {
      setStates(prev => {
        const next = { ...prev }
        const isCancelled = type === 'pipeline_cancelled'
        Object.keys(next).forEach(id => {
          next[id] = { ...next[id], statusType: isCancelled ? 'cancelled' : 'idle', status: isCancelled ? 'ยกเลิก' : '' }
        })
        return next
      })
      if (type === 'pipeline_cancelled') {
        setTimeout(() => {
          setStates(prev => {
            const next = { ...prev }
            Object.keys(next).forEach(id => {
              if (next[id].statusType === 'cancelled') next[id] = { ...next[id], statusType: 'idle', status: '' }
            })
            return next
          })
        }, 2000)
      }
    }

    if (type === 'pipeline_resumed') {
      setStates(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(id => {
          if (next[id].statusType === 'done') next[id] = { ...next[id], statusType: 'idle', status: '' }
        })
        return next
      })
    }
  }, []) // no dependency on `states` — all reads use functional prev

  return { agentStates: states, handleAgentEvent: handleEvent }
}
