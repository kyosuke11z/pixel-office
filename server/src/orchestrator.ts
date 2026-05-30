import type WebSocket from 'ws'
import type { AgentId, WsEvent } from './agents/types.js'
import { secretaryDecide, secretarySummarize } from './agents/secretary.js'
import { devProcess } from './agents/dev.js'
import { qaProcess } from './agents/qa.js'
import { testerProcess } from './agents/tester.js'

function emit(ws: WebSocket, event: WsEvent) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event))
  }
}

async function runAgent(
  agentId: AgentId,
  message: string,
  ws: WebSocket,
  depth = 0
): Promise<string> {
  if (depth > 6) return 'Pipeline หยุดแล้ว (ลึกเกินไป)'

  emit(ws, { type: 'agent_thinking', agent: agentId })

  let response
  switch (agentId) {
    case 'dev':    response = await devProcess(message); break
    case 'qa':     response = await qaProcess(message); break
    case 'tester': response = await testerProcess(message); break
    default:       return message
  }

  emit(ws, {
    type: 'agent_message',
    from: agentId,
    to: response.next?.to ?? 'secretary',
    content: response.content,
  })

  if (response.next) {
    emit(ws, {
      type: 'agent_move',
      from: agentId,
      to: response.next.to,
    })
    const nextResult = await runAgent(
      response.next.to,
      response.next.message + '\n\nContext จากก่อนหน้า:\n' + response.content,
      ws,
      depth + 1
    )
    return response.content + '\n\n---\n\n' + nextResult
  }

  return response.content
}

export async function handleUserMessage(userMessage: string, ws: WebSocket) {
  emit(ws, { type: 'agent_thinking', agent: 'secretary' })

  const decision = await secretaryDecide(userMessage)

  if (decision.action === 'reply_user') {
    emit(ws, {
      type: 'secretary_reply',
      content: decision.replyContent,
    })
    return
  }

  emit(ws, { type: 'agent_move', from: 'secretary', to: 'dev' })
  emit(ws, {
    type: 'agent_message',
    from: 'secretary',
    to: 'dev',
    content: decision.taskMessage,
  })

  const teamResults = await runAgent('dev', decision.taskMessage!, ws)

  emit(ws, { type: 'agent_thinking', agent: 'secretary' })
  const summary = await secretarySummarize(userMessage, teamResults)

  emit(ws, {
    type: 'secretary_reply',
    content: summary,
  })
}
