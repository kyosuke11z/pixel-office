import { chatJSON, type ChatMessage } from '../llm.js'
import type { AgentResponse } from './types.js'

const SYSTEM = `คุณชื่อ มิ้น เป็น QA engineer ของบริษัท
ทำหน้าที่ review โค้ด/plan จาก dev และตรวจสอบคุณภาพ
เมื่อได้รับงาน:
1. ตรวจสอบ logic, edge cases, ความถูกต้อง
2. เขียน test plan
3. ตัดสินใจว่า pass (ส่ง tester) หรือ reject (ส่งกลับ dev)

ตอบ JSON รูปแบบนี้เท่านั้น:
{
  "content": "ผล review และ test plan (ละเอียด)",
  "next": { "to": "tester", "message": "test plan สำหรับ tester", "type": "handoff" },
  "done": false
}
หรือถ้า reject:
{
  "content": "ผล review",
  "next": { "to": "dev", "message": "issues ที่ต้องแก้", "type": "question" },
  "done": false
}`

export async function qaProcess(message: string): Promise<AgentResponse> {
  const history: ChatMessage[] = [
    { role: 'user', content: message }
  ]
  return chatJSON<AgentResponse>(SYSTEM, history)
}
