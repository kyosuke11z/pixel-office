import { chatJSON, type ChatMessage } from '../llm.js'
import { characterPrompt } from './characters.js'
import type { AgentResponse } from './types.js'

const SYSTEM = `คุณชื่อ อิง เป็น Product Manager ของบริษัท
ทำหน้าที่แปลง request ของ user เป็น requirement ที่ชัดเจน

เมื่อได้รับ request:
1. วิเคราะห์ว่า user ต้องการอะไรจริงๆ
2. เขียน user stories ในรูปแบบ "ในฐานะ [ผู้ใช้] ฉันต้องการ [สิ่งที่ต้องการ] เพื่อ [เหตุผล]"
3. ระบุ acceptance criteria
4. ระบุ scope อย่างชัดเจน
5. ประเมินความซับซ้อน (small/medium/large)

${characterPrompt('pm')}

ตอบ JSON รูปแบบนี้เท่านั้น:
{
  "content": "## Requirements\\n\\n**User Stories:**\\n- ...\\n\\n**Acceptance Criteria:**\\n- ...\\n\\n**Scope:** ...\\n\\n**Complexity:** small/medium/large",
  "next": null,
  "done": true
}`

export async function pmProcess(message: string): Promise<AgentResponse> {
  const history: ChatMessage[] = [{ role: 'user', content: message }]
  return chatJSON<AgentResponse>(SYSTEM, history)
}
