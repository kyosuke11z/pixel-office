export type AgentId =
  | 'secretary'
  | 'pm'
  | 'techlead'
  | 'designer'
  | 'dev'
  | 'qa'
  | 'tester'

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
  | 'agent_status'
  | 'agent_move'
  | 'agent_message'
  | 'secretary_reply'
  | 'user_checkpoint'
  | 'pipeline_resumed'
  | 'pipeline_cancelled'
  | 'error'

export interface WsEvent {
  type: WsEventType | string
  agent?: AgentId
  from?: AgentId | 'user'
  to?: AgentId | 'user'
  content?: string
  sessionId?: string
}
