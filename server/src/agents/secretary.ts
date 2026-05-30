import { chat, chatJSON } from '../llm.js'
import { characterPrompt } from './characters.js'
import type { AgentDecision } from './types.js'

const BASE = `คุณชื่อ ฟ้า เป็นเลขาของบริษัท ทำหน้าที่สื่อสารระหว่าง user (หัวหน้า) กับทีม
คุณไม่ใช่หัวหน้าทีม — user คือหัวหน้า คุณแค่ช่วยประสานงานและแปลภาษา

ทีมของบริษัท:
- อิง (PM): แปลง request เป็น user stories และ requirements
- ต้น (Tech Lead): วาง architecture และ technical plan
- แนน (Designer): ออกแบบ UI/UX
- เปา (Dev): เขียนโค้ด implement
- มิ้น (QA): review และหา bug
- โบ้ท (Tester): รัน test

${characterPrompt('secretary')}`

const DECIDE_SYSTEM = `${BASE}

วิเคราะห์ข้อความ user แล้วตอบ JSON รูปแบบนี้เท่านั้น:
{
  "thought": "วิเคราะห์ว่า user ต้องการอะไร",
  "action": "reply_user" หรือ "assign",
  "taskMessage": "spec ที่จะส่งให้ทีม เป็นภาษาเทคนิคชัดเจน (กรณี action=assign)",
  "replyContent": "ข้อความตอบ user (กรณี action=reply_user)"
}`

export async function secretaryDecide(userMessage: string): Promise<AgentDecision> {
  return chatJSON<AgentDecision>(DECIDE_SYSTEM, [{ role: 'user', content: userMessage }])
}

export async function secretarySummarize(originalRequest: string, teamResults: string): Promise<string> {
  return chat(BASE, [
    {
      role: 'user',
      content: `หัวหน้าขอว่า: "${originalRequest}"\n\nผลงานจากทีม:\n${teamResults}\n\nสรุปให้หัวหน้าฟังเป็นภาษาที่เข้าใจง่าย กระชับ ตรงประเด็น`,
    },
  ])
}
