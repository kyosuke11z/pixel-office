# Pixel Office — Multi-Agent AI Simulation

![Pixel Office Screenshot](screenshot.png)

![Pixel Office Demo](demo.gif)

จำลองออฟฟิศ pixel art (top-down view) ที่ AI agent **7 ตัว** ทำงานร่วมกัน  
คุยกับเลขา **ฟ้า** ด้วยภาษาธรรมดา — เธอแปลเป็น spec แล้ว orchestrate ทีมเอง  
**User คือหัวหน้า** — มี checkpoint ให้ approve งานทุกขั้นตอนสำคัญ

---

## ทีมงาน

| ตัวละคร | บทบาท | นิสัย |
|---------|-------|-------|
| ฟ้า | Secretary | สุภาพ เป็นกันเอง ใช้ "ค่ะ" เสมอ |
| อิง | Product Manager | จู้จี้ requirement ชอบ acceptance criteria |
| ต้น | Tech Lead | ตรงๆ สั้น ชอบ YAGNI |
| แนน | UI/UX Designer | กระตือรือร้น ชอบเสนอ dark mode |
| เปา | Developer | เงียบขรึม ตอบสั้น "โอเค / เดี๋ยวทำ" |
| มิ้น | QA Engineer | หา edge case ไม่ sign-off ถ้ายัง TODO |
| โบ้ท | Tester | รายงาน ✅❌ สั้นๆ ถ้า fail จะ list ยาวมาก |

---

## Architecture

```mermaid
graph TB
    subgraph Browser["🌐 Browser (React + Phaser 3)"]
        Canvas["Pixel Art Canvas\n7 agents + speech bubbles"]
        Chat["Chat Panel\nagent status · checkpoints"]
        Sidebar["Session Sidebar\nhistory · demo mode · ⚙️ providers"]
        FilePicker["📁 File Viewer"]
    end

    subgraph Server["🖥️ Node.js Server :3001"]
        WS["WebSocket /ws\nchat · cancel · checkpoint"]
        REST["REST API\n/api/providers · /api/sessions\n/api/demo · /api/files · /api/browse"]
        Orch["Orchestrator\ncheckpoint · cancel · demo mode"]
        subgraph Agents["AI Agents"]
            FA["ฟ้า · Secretary"]
            IG["อิง · PM"]
            TL["ต้น · Tech Lead"]
            DS["แนน · Designer"]
            PA["เปา · Dev\n+ file tools"]
            MI["มิ้น · QA"]
            BO["โบ้ท · Tester"]
        end
        Providers["Provider Manager\nKimi · Groq · DeepSeek · Moonshot"]
        Sessions["Session Store\nJSON files"]
    end

    LLM["☁️ LLM Provider\n(swappable via UI)"]

    Browser <-->|"WS events"| WS
    Browser <-->|"REST"| REST
    WS --> Orch
    Orch --> FA --> IG --> TL & DS --> PA --> MI & BO
    Agents <-->|"chat completions"| LLM
    REST --> Providers & Sessions
    Providers -->|"active provider"| LLM
```

---

## Agent Pipeline

```mermaid
flowchart TD
    U(["👤 User\n(หัวหน้า)"])
    FA{{"ฟ้า\nSecretary"}}
    REPLY(["💬 ตอบโดยตรง"])
    IG["อิง · PM\nแตก requirement\nเขียน user stories"]
    CK1{{"🔔 Checkpoint 1\nUser approve?"}}
    TL["ต้น · Tech Lead\nวาง architecture\nกำหนด tech stack"]
    DS["แนน · Designer\nออกแบบ UI/UX\nwireframe"]
    CK2{{"🔔 Checkpoint 2\nUser approve?"}}
    PA["เปา · Dev\nเขียนโค้ด\nอ่าน/เขียน file จริง"]
    CK3{{"🔔 Checkpoint 3\nUser approve?"}}
    MI["มิ้น · QA\nreview code\nเขียน test plan"]
    BO["โบ้ท · Tester\nรัน test\nรายงาน pass/fail"]
    DONE(["ฟ้าสรุปผลให้หัวหน้า"])

    U -->|"พิมพ์ข้อความ"| FA
    FA -->|"คุยเล่น"| REPLY
    FA -->|"งานจริง"| IG
    IG --> CK1
    CK1 -->|"✅ ต่อ"| TL & DS
    CK1 -->|"✏️ แก้ไข"| IG
    TL & DS --> CK2
    CK2 -->|"✅ ต่อ"| PA
    CK2 -->|"✏️ แก้ไข"| TL
    PA --> CK3
    CK3 -->|"✅ ต่อ"| MI & BO
    CK3 -->|"✏️ ให้แก้ก่อน"| PA
    MI & BO --> DONE
    DONE --> U

    style FA fill:#7c3aed,color:#fff
    style IG fill:#be185d,color:#fff
    style TL fill:#1d4ed8,color:#fff
    style DS fill:#b91c1c,color:#fff
    style PA fill:#1d4ed8,color:#fff
    style MI fill:#065f46,color:#fff
    style BO fill:#c2410c,color:#fff
    style U fill:#0f172a,color:#e2e8f0
    style REPLY fill:#0f172a,color:#e2e8f0
    style DONE fill:#0f172a,color:#e2e8f0
    style CK1 fill:#92400e,color:#fff
    style CK2 fill:#92400e,color:#fff
    style CK3 fill:#92400e,color:#fff
```

---

## WebSocket Event Flow

```mermaid
sequenceDiagram
    participant U as 👤 User (หัวหน้า)
    participant WS as WebSocket
    participant Orch as Orchestrator
    participant FA as ฟ้า · Secretary
    participant IG as อิง · PM
    participant TL as ต้น + แนน
    participant PA as เปา · Dev
    participant QT as มิ้น + โบ้ท

    U->>WS: { content: "สร้าง todo list..." }
    WS->>Orch: handleUserMessage()

    Orch-->>U: agent_thinking (secretary)
    Orch-->>U: agent_status (secretary, "กำลังนึกอยู่...")
    Orch->>FA: secretaryDecide()

    Orch-->>U: agent_move (secretary → pm)
    Orch-->>U: agent_thinking (pm)
    Orch-->>U: agent_status (pm, "กำลังนึกอยู่...")
    Orch->>IG: pmProcess()
    Orch-->>U: agent_message (pm → secretary)

    Orch-->>U: user_checkpoint (🔔 รอ approve จากหัวหน้า)
    U->>WS: { content: "ต่อ" }
    Orch-->>U: pipeline_resumed

    Orch-->>U: agent_thinking (techlead)
    Orch-->>U: agent_thinking (designer)
    Orch->>TL: techLeadProcess() + designerProcess()
    Orch-->>U: agent_message (techlead → dev)
    Orch-->>U: agent_message (designer → dev)

    Orch-->>U: user_checkpoint (🔔)
    U->>WS: { content: "ต่อ" }
    Orch-->>U: pipeline_resumed

    Orch-->>U: agent_thinking (dev)
    Orch-->>U: agent_status (dev, "กำลังอ่านไฟล์...")
    Note over PA: ReAct loop: list_files → read_file → write_file
    Orch->>PA: devProcess() with file tools
    Orch-->>U: agent_message (dev → qa)

    Orch-->>U: user_checkpoint (🔔)
    U->>WS: { content: "ต่อ" }
    Orch-->>U: pipeline_resumed

    Orch-->>U: agent_thinking (qa)
    Orch-->>U: agent_thinking (tester)
    Orch->>QT: qaProcess() + testerProcess()
    Orch-->>U: agent_message (qa → secretary)
    Orch-->>U: agent_message (tester → secretary)

    Orch->>FA: secretarySummarize()
    Orch-->>U: secretary_reply (สรุปผล)

    Note over U,WS: หรือกด ⛔ ยกเลิก ได้ทุกเวลา
    U->>WS: { type: "cancel" }
    Orch-->>U: pipeline_cancelled
```

---

## Features

| Feature | รายละเอียด |
|---------|-----------|
| 🎮 **Pixel Art Office** | Phaser 3 top-down view, 7 agents เดินได้, speech bubble แสดงเนื้อหาจริง |
| 🤝 **Multi-Agent Pipeline** | PM → Tech Lead + Designer → Dev → QA + Tester ตามลำดับ |
| 🔔 **User Checkpoints** | User approve/แก้ไขงานได้ 3 จุด ก่อนส่งต่อทีม |
| ⛔ **Cancel Pipeline** | หยุด pipeline ได้ทุกเวลา agents หยุดหลัง call ปัจจุบันเสร็จ |
| 📁 **File Tools** | Dev อ่าน/เขียน file จริงใน project directory (sandboxed) |
| 💬 **Session History** | บันทึก chat ทุก session, load กลับได้, ลบได้ |
| ⚡ **Demo Mode** | pipeline เสร็จใน ~13s โดยไม่เรียก LLM เหมาะสำหรับ demo |
| ⚙️ **Multi-Provider** | สลับ LLM ได้ใน UI: Kimi · Moonshot · Groq · DeepSeek + test connection |
| 📊 **Real-time Status** | เห็นสถานะ agent real-time: "กำลังนึกอยู่..." / "งานเข้ามาเยอะ ขอพักซักครู่..." |

---

## Setup

### 1. Clone และติดตั้ง

```bash
git clone https://github.com/kyosuke11z/pixel-office.git
cd pixel-office

cd server && npm install
cd ../client && npm install
```

### 2. ตั้งค่า LLM provider

```bash
# server/.env
LLM_BASE_URL=https://api.maxplus-ai.cc/kimi/v1
LLM_API_KEY=your-key-here
LLM_MODEL=moonshotai/kimi-k2.6
PORT=3001
```

> หรือสลับ provider ได้ใน UI หลังเปิดแอพ โดยกดปุ่ม ⚙️ ที่ sidebar

### 3. รัน

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

เปิด [http://localhost:5173](http://localhost:5173)

---

## การใช้งาน

- **คุยเล่น**: ฟ้าตอบเองโดยตรง ไม่ involve ทีม
- **สั่งงานจริง**: ระบุ project directory → ทีมทำงาน → approve ที่ checkpoint → เห็นไฟล์จริงใน File Viewer
- **Demo**: กด ⚡ Demo ที่ header เพื่อดู pipeline วิ่งเร็ว 13 วินาที

---

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Phaser 3
- **Backend**: Node.js + Express + WebSocket
- **AI**: OpenAI-compatible API (swappable — Kimi K2.6 / Groq / DeepSeek / Moonshot)
- **Storage**: JSON files (sessions + provider config)
