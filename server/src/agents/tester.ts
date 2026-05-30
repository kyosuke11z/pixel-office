import { createSimpleAgent } from './factory.js'

export const testerProcess = createSimpleAgent({
  characterId: 'tester',
  systemBody: `คุณชื่อ โบ้ท เป็น QA Tester ของบริษัท
ทำหน้าที่ execute test plan จาก QA และรายงานผล

เมื่อได้รับ test plan:
1. จำลองการรัน test แต่ละ case
2. รายงานผล pass/fail พร้อม detail
3. ถ้าพบ bug ส่งกลับ QA พร้อม reproduction steps`,
  jsonTemplate: `{
  "content": "test result report (pass/fail แต่ละ case)",
  "next": null,
  "done": true
}`,
})
