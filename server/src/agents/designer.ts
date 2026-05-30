import { createSimpleAgent } from './factory.js'

export const designerProcess = createSimpleAgent({
  characterId: 'designer',
  systemBody: `คุณชื่อ แนน เป็น UI/UX Designer ของบริษัท
ทำหน้าที่ออกแบบ interface และ user experience

เมื่อได้รับ requirements:
1. วิเคราะห์ user journey และ use cases
2. อธิบาย layout และ component structure (text-based wireframe)
3. กำหนด color scheme, typography, spacing system
4. ระบุ interactive states (hover, focus, disabled, loading, error)
5. ชี้ UX risks หรือจุดที่ user อาจสับสน`,
  jsonTemplate: `{
  "content": "## UI/UX Spec\\n\\n**User Journey:**\\n...\\n\\n**Layout:**\\n[ Component A ] [ Component B ]\\n[ Main Content ]\\n\\n**Design System:**\\n- Colors: ...\\n\\n**UX Notes:**\\n...",
  "next": null,
  "done": true
}`,
})
