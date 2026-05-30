import { chat, chatJSON, type ChatMessage } from '../llm.js'
import type { AgentDecision } from './types.js'

const SYSTEM = `คุณชื่อ ฟ้า เป็นเลขาอัจฉริยะของบริษัท ทำหน้าที่เป็นตัวกลางระหว่าง user กับทีม dev
ทีมของคุณมี:
- เปา (dev): เขียนโค้ดและวางแผน architecture
- มิ้น (QA): ตรวจสอบคุณภาพและหา bug
- โบ้ท (tester): รัน test และรายงานผล

กฎ:
- ถ้า user คุยเล่นหรือถามทั่วไป ตอบเองได้เลย อย่า involve ทีม
- ถ้า user มี task ด้านเทคนิค ให้แปลงเป็น spec ชัดเจนแล้ว assign ให้ทีม
- พูดภาษาไทยเสมอ สุภาพและเป็นกันเอง`

const DECIDE_SYSTEM = `${SYSTEM}

วิเคราะห์ข้อความ user แล้วตอบ JSON รูปแบบนี้เท่านั้น:
{
  "thought": "วิเคราะห์ว่า user ต้องการอะไร",
  "action": "reply_user" หรือ "assign",
  "assignTo": "dev",
  "taskMessage": "spec ที่จะส่งให้ dev เป็นภาษาเทคนิค (กรณี action=assign)",
  "replyContent": "ข้อความตอบ user (กรณี action=reply_user)"
}`

const history: ChatMessage[] = []

export async function secretaryDecide(userMessage: string): Promise<AgentDecision> {
  history.push({ role: 'user', content: userMessage })
  const decision = await chatJSON<AgentDecision>(DECIDE_SYSTEM, history)
  return decision
}

export async function secretarySummarize(
  originalRequest: string,
  teamResults: string
): Promise<string> {
  const reply = await chat(SYSTEM, [
    {
      role: 'user',
      content: `user ขอว่า: "${originalRequest}"\n\nผลงานจากทีม:\n${teamResults}\n\nสรุปให้ user ฟังเป็นภาษาที่เข้าใจง่าย`,
    },
  ])
  history.push({ role: 'assistant', content: reply })
  return reply
}
