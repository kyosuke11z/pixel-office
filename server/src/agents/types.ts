// server/src/agents/types.ts
import type { AgentId } from '../shared/types.js'
export type { AgentId, WsEventType, WsEvent } from '../shared/types.js'

export interface AgentMessage {
  from: AgentId | 'user'
  to: AgentId | 'user'
  type: 'handoff' | 'reply' | 'question' | 'result'
  content: string
  artifacts?: string[]
}

export interface AgentDecision {
  thought: string
  action: 'reply_user' | 'assign'
  assignTo?: AgentId
  taskMessage?: string
  replyContent?: string
}

export interface AgentResponse {
  content: string
  next?: {
    to: AgentId
    message: string
    type: AgentMessage['type']
  }
  done?: boolean
}
