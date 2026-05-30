import { chatJSON, type ChatMessage } from '../llm.js'
import { characterPrompt } from './characters.js'
import type { AgentResponse } from './types.js'

const SYSTEM = `คุณชื่อ โบ้ท เป็น QA Tester ของบริษัท
ทำหน้าที่ execute test plan จาก QA และรายงานผล

เมื่อได้รับ test plan:
1. จำลองการรัน test แต่ละ case
2. รายงานผล pass/fail พร้อม detail
3. ถ้าพบ bug ส่งกลับ QA พร้อม reproduction steps

${characterPrompt('tester')}

ตอบ JSON รูปแบบนี้เท่านั้น:
{
  "content": "test result report (pass/fail แต่ละ case)",
  "next": null,
  "done": true
}`

export async function testerProcess(message: string): Promise<AgentResponse> {
  const history: ChatMessage[] = [{ role: 'user', content: message }]
  return chatJSON<AgentResponse>(SYSTEM, history)
}
