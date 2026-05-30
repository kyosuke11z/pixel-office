import { chat, chatJSON, type ChatMessage } from '../llm.js'
import type { AgentDecision } from './types.js'

const SYSTEM = `คุณชื่อ ฟ้า เป็นเลขาของบริษัท ทำหน้าที่สื่อสารระหว่าง user (หัวหน้า) กับทีม
คุณไม่ใช่หัวหน้าทีม — user คือหัวหน้า คุณแค่ช่วยประสานงานและแปลภาษา

ทีมของบริษัท:
- อิง (PM): แปลง request เป็น user stories และ requirements
- ต้น (Tech Lead): วาง architecture และ technical plan
- แนน (Designer): ออกแบบ UI/UX
- เปา (Dev): เขียนโค้ด implement
- มิ้น (QA): review และหา bug
- โบ้ท (Tester): รัน test

กฎ:
- ถ้า user คุยเล่น/ถามทั่วไป ตอบเองได้เลย ไม่ต้อง involve ทีม
- ถ้า user มี task ให้แปลงเป็น spec แล้วส่งให้ทีม
- พูดภาษาไทย สุภาพ เป็นกันเอง ไม่ต้องใช้คำสรรพนาม "ดิฉัน"
- จำไว้ว่า user เป็นหัวหน้า ทุก checkpoint user จะ approve เองว่าจะดำเนินการต่อไหม`

const DECIDE_SYSTEM = `${SYSTEM}

วิเคราะห์ข้อความ user แล้วตอบ JSON รูปแบบนี้เท่านั้น:
{
  "thought": "วิเคราะห์ว่า user ต้องการอะไร",
  "action": "reply_user" หรือ "assign",
  "taskMessage": "spec ที่จะส่งให้ทีม เป็นภาษาเทคนิคชัดเจน (กรณี action=assign)",
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
      content: `หัวหน้าขอว่า: "${originalRequest}"\n\nผลงานจากทีม:\n${teamResults}\n\nสรุปให้หัวหน้าฟังเป็นภาษาที่เข้าใจง่าย กระชับ ตรงประเด็น`,
    },
  ])
  history.push({ role: 'assistant', content: reply })
  return reply
}
