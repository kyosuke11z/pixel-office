import { chatJSON } from '../llm.js'
import { characterPrompt } from './characters.js'
import type { AgentResponse } from './types.js'
import type { ChatMessage } from '../llm.js'

export interface SimpleAgentConfig {
  characterId: string
  systemBody: string
  jsonTemplate: string
}

export function createSimpleAgent(
  config: SimpleAgentConfig
): (message: string) => Promise<AgentResponse> {
  const system = [
    config.systemBody,
    '',
    characterPrompt(config.characterId),
    '',
    'ตอบ JSON รูปแบบนี้เท่านั้น:',
    config.jsonTemplate,
  ].join('\n')

  return async function process(message: string): Promise<AgentResponse> {
    const history: ChatMessage[] = [{ role: 'user', content: message }]
    return chatJSON<AgentResponse>(system, history)
  }
}
