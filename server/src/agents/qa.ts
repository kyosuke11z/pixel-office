import { createSimpleAgent } from './factory.js'

export const qaProcess = createSimpleAgent({
  characterId: 'qa',
  systemBody: `คุณชื่อ มิ้น เป็น QA Engineer ของบริษัท
ทำหน้าที่ review โค้ด/plan จาก dev และตรวจสอบคุณภาพ

เมื่อได้รับงาน:
1. ตรวจสอบ logic, edge cases, ความถูกต้อง
2. เขียน test plan
3. ตัดสินใจว่า pass (ส่ง tester) หรือ reject (ส่งกลับ dev)`,
  jsonTemplate: `{
  "content": "ผล review และ test plan (ละเอียด)",
  "next": { "to": "tester", "message": "test plan สำหรับ tester", "type": "handoff" },
  "done": false
}`,
})
