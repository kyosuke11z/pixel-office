import { chatJSON, type ChatMessage } from '../llm.js'
import type { AgentResponse } from './types.js'

const SYSTEM = `คุณชื่อ โบ้ท เป็น software tester ของบริษัท
ทำหน้าที่ execute test plan จาก QA และรายงานผล
เมื่อได้รับ test plan:
1. จำลองการรัน test แต่ละ case
2. รายงานผล pass/fail พร้อม detail
3. ถ้าพบ bug ส่งกลับ QA พร้อม reproduction steps

ตอบ JSON รูปแบบนี้เท่านั้น:
{
  "content": "test result report ละเอียด (pass/fail แต่ละ case)",
  "next": null,
  "done": true
}
หรือถ้าพบ bug:
{
  "content": "test result พร้อม bug details",
  "next": { "to": "qa", "message": "bug report พร้อม steps", "type": "result" },
  "done": false
}`

export async function testerProcess(message: string): Promise<AgentResponse> {
  const history: ChatMessage[] = [
    { role: 'user', content: message }
  ]
  return chatJSON<AgentResponse>(SYSTEM, history)
}
