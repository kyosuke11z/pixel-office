# Pixel Office — Multi-Agent AI Simulation

จำลองออฟฟิศ pixel art (top-down view) ที่ AI agent 4 ตัวทำงานร่วมกัน  
คุยกับเลขา **ฟ้า** ด้วยภาษาธรรมดา — เธอจะแปลงเป็น task และ orchestrate ทีมเอง

## ทีมงาน

| ตัวละคร | บทบาท | หน้าที่ |
|---------|-------|---------|
| ฟ้า 🟣 | Secretary | รับ request, แปลภาษา, orchestrate ทีม |
| เปา 🔵 | Dev | เขียนโค้ด, วาง architecture |
| มิ้น 🟢 | QA | review, หา bug, เขียน test plan |
| โบ้ท 🟠 | Tester | รัน test, รายงานผล |

---

## Architecture

```mermaid
graph TB
    subgraph Browser["🌐 Browser"]
        UI["Phaser 3 Canvas\n(Pixel Office)"]
        Chat["React Chat Panel"]
    end

    subgraph Server["🖥️ Node.js Server"]
        WS["WebSocket Server\n:3001/ws"]
        Orch["Orchestrator"]
        subgraph Agents["AI Agents"]
            FA["🟣 ฟ้า\nSecretary"]
            PA["🔵 เปา\nDev"]
            MI["🟢 มิ้น\nQA"]
            BO["🟠 โบ้ท\nTester"]
        end
    end

    LLM["☁️ Kimi K2.6\n(OpenAI-compatible API)"]

    Browser <-->|WebSocket events| WS
    WS --> Orch
    Orch --> FA
    FA <-->|orchestrate| PA
    FA <-->|orchestrate| MI
    FA <-->|orchestrate| BO
    PA <-->|handoff| MI
    MI <-->|handoff| BO
    Agents <-->|chat completions| LLM
```

---

## Agent Pipeline

```mermaid
flowchart TD
    U(["👤 User"]) -->|พิมพ์ข้อความ| FA

    FA{{"🟣 ฟ้า\nSecretary"}}

    FA -->|คุยเล่น / ถามทั่วไป| REPLY(["💬 ตอบโดยตรง"])

    FA -->|งานเทคนิค\nแปลงเป็น spec| PA

    PA["🔵 เปา\nDev\n─────────────\nวิเคราะห์ + เขียนโค้ด\nหรือ architecture plan"]

    PA -->|ส่ง code/plan\nให้ review| MI

    MI["🟢 มิ้น\nQA\n─────────────\nreview logic\nเขียน test plan"]

    MI -->|reject: มี bug| PA
    MI -->|pass: ส่ง test| BO

    BO["🟠 โบ้ท\nTester\n─────────────\nรัน test cases\nรายงาน pass/fail"]

    BO -->|พบ bug| MI
    BO -->|ทุก test ผ่าน| FA

    FA -->|สรุปผลลัพธ์\nเป็นภาษาคน| U

    style FA fill:#7c3aed,color:#fff
    style PA fill:#2563eb,color:#fff
    style MI fill:#059669,color:#fff
    style BO fill:#ea580c,color:#fff
    style U fill:#1e293b,color:#e2e8f0
    style REPLY fill:#1e293b,color:#e2e8f0
```

---

## WebSocket Event Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant WS as WebSocket
    participant Orch as Orchestrator
    participant FA as 🟣 ฟ้า
    participant PA as 🔵 เปา
    participant MI as 🟢 มิ้น
    participant BO as 🟠 โบ้ท

    U->>WS: { content: "สร้าง fibonacci..." }
    WS->>Orch: handleUserMessage()

    Orch-->>U: agent_thinking (secretary)
    Orch->>FA: secretaryDecide()
    FA-->>Orch: action: "assign", taskMessage: ...

    Orch-->>U: agent_move (secretary → dev)
    Orch-->>U: agent_message (secretary → dev)
    Orch->>PA: devProcess()

    PA-->>U: agent_thinking (dev)
    PA-->>Orch: content + next: { to: "qa" }
    Orch-->>U: agent_message (dev → qa)
    Orch-->>U: agent_move (dev → qa)

    Orch->>MI: qaProcess()
    MI-->>U: agent_thinking (qa)
    MI-->>Orch: content + next: { to: "tester" }
    Orch-->>U: agent_message (qa → tester)

    Orch->>BO: testerProcess()
    BO-->>U: agent_thinking (tester)
    BO-->>Orch: content, done: true

    Orch->>FA: secretarySummarize()
    FA-->>U: agent_thinking (secretary)
    Orch-->>U: secretary_reply (สรุปผล)
```

---

## Setup

### 1. ตั้งค่า environment

```bash
cp .env.example .env
# แก้ .env ใส่ API key จริง
```

```env
LLM_BASE_URL=https://api.maxplus-ai.cc/kimi/v1
LLM_API_KEY=your-api-key-here
LLM_MODEL=moonshotai/kimi-k2.6
PORT=3001
```

### 2. รัน server

```bash
cd server
npm install
npm run dev
```

### 3. รัน client

```bash
cd client
npm install
npm run dev
```

### 4. เปิดใช้งาน

เปิด [http://localhost:5173](http://localhost:5173)

## การใช้งาน

พิมพ์ข้อความถึงฟ้าในช่อง chat:

- **คุยเล่น**: ฟ้าตอบเองโดยตรง ไม่ involve ทีม
- **งานเทคนิค**: ฟ้าแปลงเป็น spec → ส่งเปา → เปาส่ง QA → QA ส่ง tester → ฟ้าสรุปกลับ

ดูตัวละครเดินในออฟฟิศ pixel art และ speech bubble แสดง real-time

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Phaser 3
- **Backend**: Node.js + Express + WebSocket
- **AI**: Kimi K2.6 via OpenAI-compatible API (swap ได้ผ่าน .env)
