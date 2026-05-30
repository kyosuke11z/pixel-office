// server/src/agents/types.ts
export type AgentId = 'secretary' | 'dev' | 'qa' | 'tester'

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

export type WsEventType =
  | 'agent_thinking'
  | 'agent_move'
  | 'agent_message'
  | 'secretary_reply'
  | 'error'

export interface WsEvent {
  type: WsEventType
  agent?: AgentId
  from?: AgentId | 'user'
  to?: AgentId | 'user'
  content?: string
}
