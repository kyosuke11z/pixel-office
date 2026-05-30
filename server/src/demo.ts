import type { AgentDecision, AgentResponse } from './agents/types.js'

let demoMode = false
export const isDemoMode = () => demoMode
export const setDemoMode = (v: boolean) => { demoMode = v; return demoMode }

export const MOCK_RESPONSES: Record<string, AgentDecision | AgentResponse | string> = {
  secretary: {
    thought: 'หัวหน้าต้องการให้ทีมทำงาน ส่งต่อให้ทีม',
    action: 'assign',
    taskMessage: 'ทีม: ช่วยดำเนินการตาม requirement ที่ได้รับ',
  } as AgentDecision,
  pm: {
    content: '## Requirements\n\n**User Stories:**\n- ในฐานะ user ฉันต้องการใช้งาน feature นี้เพื่อแก้ปัญหาได้จริง\n\n**Acceptance Criteria:**\n- ✅ ทำงานได้ตาม requirement\n- ✅ UI ใช้งานง่าย\n- ✅ ไม่มี error\n\n**Scope:** feature เดียว ไม่มี dependency ซับซ้อน\n**Complexity:** small',
    done: true,
  } as AgentResponse,
  techlead: {
    content: '## Architecture Plan\n\n**Tech Stack:** ตาม requirement ที่กำหนด\n\n**Architecture:**\n```\nComponent A → Component B → Output\n```\n\n**Dev Tasks:**\n1. Setup structure\n2. Implement logic\n3. Connect components\n\n**Risks:** ไม่มีความเสี่ยงสูง',
    done: true,
  } as AgentResponse,
  designer: {
    content: '## UI/UX Spec\n\n**User Journey:**\nUser เปิดหน้า → กรอกข้อมูล → กด Submit → เห็นผล\n\n**Layout:**\n```\n[ Header                    ]\n[ Input Form    ] [ Preview ]\n[ Submit Button             ]\n```\n\n**Design System:**\n- Colors: #2563eb (primary), #1e293b (bg)\n- Typography: 14px/1.5 system-ui\n\n**UX Notes:** ควรมี loading state และ error message',
    done: true,
  } as AgentResponse,
  dev: {
    content: '## Implementation\n\nสร้างไฟล์ตาม spec:\n\n```javascript\n// main.js\nfunction init() {\n  // setup\n}\n\nfunction handleSubmit(data) {\n  // process\n  return result\n}\n\ninit()\n```\n\nไฟล์ที่สร้าง:\n- `index.html` — หน้าหลัก\n- `main.js` — logic\n- `style.css` — styling',
    done: true,
  } as AgentResponse,
  qa: {
    content: '## QA Review\n\n✅ Logic ถูกต้อง\n✅ Edge cases ครอบคลุม\n✅ ไม่มี TODO ที่ค้างอยู่\n\n**Test Plan:**\n1. Happy path: ✅\n2. Empty input: ✅\n3. Invalid data: ✅\n4. Network error: ✅',
    next: { to: 'tester', message: 'test plan พร้อมแล้ว', type: 'handoff' },
    done: false,
  } as AgentResponse,
  tester: {
    content: '## Test Results\n\n✅ TC-001: Happy path — PASS\n✅ TC-002: Empty input — PASS\n✅ TC-003: Invalid data — PASS\n✅ TC-004: Error handling — PASS\n\n**สรุป: 4/4 ผ่าน — พร้อม deploy**',
    done: true,
  } as AgentResponse,
  secretary_summarize: 'ทีมทำงานเสร็จเรียบร้อยแล้วค่ะ! ทุกขั้นตอนผ่านหมด พร้อมใช้งานได้เลยค่ะ 🎉',
}
