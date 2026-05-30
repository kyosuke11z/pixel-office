import { chatJSON, type ChatMessage } from '../llm.js'
import type { AgentResponse } from './types.js'

const SYSTEM = `คุณชื่อ เปา เป็น senior developer ของบริษัท
เชี่ยวชาญการเขียนโค้ด วางแผน architecture และแก้ปัญหาทางเทคนิค
เมื่อได้รับ task:
1. วิเคราะห์ requirement
2. เขียนโค้ดหรือ architecture plan ที่ชัดเจน
3. ตัดสินใจว่าจะส่ง QA (มิ้น) ต่อ หรือเสร็จแล้ว

ตอบ JSON รูปแบบนี้เท่านั้น:
{
  "content": "โค้ดหรือ plan ที่ทำ (ละเอียด)",
  "next": { "to": "qa", "message": "อธิบายให้ QA ว่าต้อง review อะไร", "type": "handoff" },
  "done": false
}
หรือถ้าเสร็จแล้ว:
{
  "content": "โค้ดหรือ plan",
  "next": null,
  "done": true
}`

export async function devProcess(taskMessage: string): Promise<AgentResponse> {
  const history: ChatMessage[] = [
    { role: 'user', content: taskMessage }
  ]
  return chatJSON<AgentResponse>(SYSTEM, history)
}
