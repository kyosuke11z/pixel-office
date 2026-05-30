// server/src/shared/types.ts
export type AgentId =
  | 'secretary'
  | 'pm'
  | 'techlead'
  | 'designer'
  | 'dev'
  | 'qa'
  | 'tester'

export type WsEventType =
  | 'agent_thinking'
  | 'agent_status'
  | 'agent_move'
  | 'agent_message'
  | 'secretary_reply'
  | 'user_checkpoint'
  | 'pipeline_resumed'
  | 'pipeline_cancelled'
  | 'session_created'
  | 'error'

export interface WsEvent {
  type: WsEventType | string
  agent?: AgentId | string
  from?: AgentId | string
  to?: AgentId | string
  content?: string
  sessionId?: string
}
