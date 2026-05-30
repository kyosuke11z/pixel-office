import type WebSocket from 'ws'
import type { AgentId, WsEvent } from './agents/types.js'
import { secretaryDecide, secretarySummarize } from './agents/secretary.js'
import { pmProcess } from './agents/pm.js'
import { techLeadProcess } from './agents/techlead.js'
import { designerProcess } from './agents/designer.js'
import { devProcess } from './agents/dev.js'
import { qaProcess } from './agents/qa.js'
import { testerProcess } from './agents/tester.js'

// Checkpoint resolver — per WS connection
const checkpointResolvers: Map<WebSocket, (answer: string) => void> = new Map()

export function resolveCheckpoint(ws: WebSocket, answer: string): boolean {
  const resolver = checkpointResolvers.get(ws)
  if (!resolver) return false
  checkpointResolvers.delete(ws)
  resolver(answer)
  return true
}

function emit(ws: WebSocket, event: WsEvent) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event))
  }
}

// Pause pipeline — ask user, wait for reply
async function checkpoint(
  ws: WebSocket,
  summary: string,
  question: string
): Promise<string> {
  emit(ws, {
    type: 'user_checkpoint',
    content: `${summary}\n\n---\n${question}`,
  })
  return new Promise(resolve => {
    checkpointResolvers.set(ws, resolve)
  })
}

function thinking(ws: WebSocket, ...agents: AgentId[]) {
  agents.forEach(agent => emit(ws, { type: 'agent_thinking', agent }))
}

function message(ws: WebSocket, from: AgentId, to: AgentId | 'user', content: string) {
  emit(ws, { type: 'agent_message', from, to, content: content.slice(0, 200) })
}

function move(ws: WebSocket, from: AgentId, to: AgentId) {
  emit(ws, { type: 'agent_move', from, to })
}

export async function handleUserMessage(userMessage: string, ws: WebSocket) {
  // ฟ้า ตัดสินใจ: คุยเล่น หรือ งานจริง
  thinking(ws, 'secretary')
  const decision = await secretaryDecide(userMessage)

  if (decision.action === 'reply_user') {
    emit(ws, { type: 'secretary_reply', content: decision.replyContent })
    return
  }

  const originalTask = decision.taskMessage ?? userMessage
  const results: Record<string, string> = {}

  // ─── Stage 1: PM วิเคราะห์ requirement ───────────────────────────────────
  move(ws, 'secretary', 'pm')
  thinking(ws, 'pm')
  const pmResult = await pmProcess(originalTask)
  results.pm = pmResult.content
  message(ws, 'pm', 'secretary', pmResult.content)

  // 🔔 Checkpoint 1 — user approve requirements?
  const ck1 = await checkpoint(
    ws,
    `**อิง (PM) วิเคราะห์ requirement เสร็จแล้ว:**\n\n${pmResult.content}`,
    'ดำเนินการต่อไหมคะ? พิมพ์ "ต่อ" หรือแก้ไข requirement ได้เลย'
  )
  const refinedTask = isApproval(ck1) ? originalTask : `${originalTask}\n\nหัวหน้าแก้ไข: ${ck1}`
  emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ดำเนินการต่อเลย' })

  // ─── Stage 2: Tech Lead + Designer (parallel) ─────────────────────────────
  move(ws, 'pm', 'techlead')
  thinking(ws, 'techlead', 'designer') // ทั้งสองทำงานพร้อมกัน

  // emit thinking พร้อมกันก่อน แต่รัน sequential เพื่อหลีกเลี่ยง rate limit
  const tlResult = await techLeadProcess(`Requirements:\n${results.pm}\n\nTask: ${refinedTask}`)
  const dsResult = await designerProcess(`Requirements:\n${results.pm}\n\nTask: ${refinedTask}`)
  results.techlead = tlResult.content
  results.designer = dsResult.content
  message(ws, 'techlead', 'dev', tlResult.content)
  message(ws, 'designer', 'dev', dsResult.content)

  // 🔔 Checkpoint 2 — user approve architecture + design?
  const preview2 = [
    `**ต้น (Tech Lead):** ${tlResult.content.slice(0, 300)}...`,
    `**แนน (Designer):** ${dsResult.content.slice(0, 300)}...`,
  ].join('\n\n')
  const ck2 = await checkpoint(
    ws,
    `**ต้น และ แนน ทำงานเสร็จพร้อมกัน:**\n\n${preview2}`,
    'อนุมัติ plan นี้ไหมคะ? พิมพ์ "ต่อ" หรือระบุสิ่งที่ต้องแก้'
  )
  const devContext = buildDevContext(results, isApproval(ck2) ? '' : ck2)
  emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ส่งให้เปาเลย' })

  // ─── Stage 3: Dev implement ────────────────────────────────────────────────
  move(ws, 'techlead', 'dev')
  thinking(ws, 'dev')
  const devResult = await devProcess(devContext)
  results.dev = devResult.content
  message(ws, 'dev', 'qa', devResult.content)

  // 🔔 Checkpoint 3 — user approve dev output before QA?
  const ck3 = await checkpoint(
    ws,
    `**เปา (Dev) ทำงานเสร็จแล้ว:**\n\n${devResult.content.slice(0, 400)}${devResult.content.length > 400 ? '...' : ''}`,
    'ส่ง QA และ Tester ต่อไหมคะ? พิมพ์ "ต่อ" หรือสั่งให้เปาแก้ไขก่อน'
  )
  if (!isApproval(ck3)) {
    // ส่งกลับให้ dev แก้ก่อน
    emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ให้เปาแก้ก่อนนะคะ' })
    thinking(ws, 'dev')
    const devRevised = await devProcess(`${devContext}\n\nหัวหน้าขอแก้: ${ck3}\n\nงานเดิม:\n${devResult.content}`)
    results.dev = devRevised.content
    message(ws, 'dev', 'qa', devRevised.content)
  }
  emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ส่ง QA + Tester พร้อมกันเลย' })

  // ─── Stage 4: QA + Tester (parallel) ─────────────────────────────────────
  move(ws, 'dev', 'qa')
  thinking(ws, 'qa', 'tester') // ทั้งสองทำงานพร้อมกัน

  const qaResult = await qaProcess(`Code/Plan จาก Dev:\n${results.dev}\n\nOriginal requirements:\n${results.pm}`)
  const testerResult = await testerProcess(`Code/Plan จาก Dev:\n${results.dev}\n\nOriginal requirements:\n${results.pm}`)
  results.qa = qaResult.content
  results.tester = testerResult.content
  message(ws, 'qa', 'secretary', qaResult.content)
  message(ws, 'tester', 'secretary', testerResult.content)

  // ─── Final summary by ฟ้า ──────────────────────────────────────────────────
  thinking(ws, 'secretary')
  const allResults = Object.entries(results)
    .map(([k, v]) => `### ${k.toUpperCase()}\n${v}`)
    .join('\n\n---\n\n')
  const summary = await secretarySummarize(userMessage, allResults)
  emit(ws, { type: 'secretary_reply', content: summary })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isApproval(text: string): boolean {
  const t = text.trim().toLowerCase()
  return ['ต่อ', 'ok', 'okay', 'yes', 'ใช่', 'ได้', 'ดี', 'โอเค', 'ตกลง', 'ผ่าน', 'continue'].some(
    w => t === w || t.startsWith(w + ' ') || t.startsWith(w + '\n')
  )
}

function buildDevContext(results: Record<string, string>, userNote: string): string {
  return [
    `## Requirements (PM)\n${results.pm}`,
    `## Architecture (Tech Lead)\n${results.techlead}`,
    `## UI/UX Spec (Designer)\n${results.designer}`,
    userNote ? `## หมายเหตุจากหัวหน้า\n${userNote}` : '',
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')
}
