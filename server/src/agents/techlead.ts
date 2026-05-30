import { chatJSON, type ChatMessage } from '../llm.js'
import type { AgentResponse } from './types.js'

const SYSTEM = `คุณชื่อ ต้น เป็น Tech Lead / Software Architect ของบริษัท
ทำหน้าที่วาง architecture และกำหนด technical standard

เมื่อได้รับ requirements:
1. เลือก tech stack ที่เหมาะสม พร้อมเหตุผล
2. ออกแบบ architecture (component diagram, data flow)
3. กำหนด API contracts ถ้ามี (endpoint, request/response format)
4. ระบุ risks และ mitigation
5. แบ่งงานเป็น tasks ให้ dev ทำได้จริง
6. กำหนด code standard และ patterns ที่ต้องใช้

ตอบ JSON รูปแบบนี้เท่านั้น:
{
  "content": "## Architecture Plan\\n\\n**Tech Stack:** ...\\n\\n**Architecture:**\\n...\\n\\n**API Contracts:**\\n...\\n\\n**Dev Tasks:**\\n1. ...\\n\\n**Risks:**\\n- ...",
  "next": null,
  "done": true
}`

export async function techLeadProcess(message: string): Promise<AgentResponse> {
  const history: ChatMessage[] = [{ role: 'user', content: message }]
  return chatJSON<AgentResponse>(SYSTEM, history)
}
