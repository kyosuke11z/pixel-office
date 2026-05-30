# Full Overhaul — Clean Code, Performance & Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all correctness bugs, eliminate ~48 s of artificial pipeline sleep, eliminate repeated disk I/O on every API call, create agent factory, single source of truth for shared constants and types, WS auto-reconnect.

**Architecture:** `server/src/shared/types.ts` is the single source for `WsEvent`/`AgentId` (client aliases via vite + tsconfig paths). Server modules own in-memory caches (`providers.ts`, `sessions.ts`) with async write-behind. Agent factory in `agents/factory.ts` reduces 5 identical boilerplate files to config objects. Client `constants/agents.ts` replaces 3 duplicate maps across 3 files.

**Tech Stack:** TypeScript 5, Node.js 20, Express, `ws`, React 18, Vite 6, Phaser 3, OpenAI SDK

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `server/src/shared/types.ts` | `AgentId`, `WsEventType`, `WsEvent` — source of truth |
| CREATE | `server/src/constants.ts` | All magic numbers |
| CREATE | `server/src/agents/factory.ts` | `createSimpleAgent()` factory |
| CREATE | `server/src/bench.ts` | Benchmark script |
| CREATE | `client/src/constants/agents.ts` | `AGENT_META`, `THINKING_MAP`, `AGENT_ORDER`, `AGENT_NAMES` |
| MODIFY | `server/src/agents/types.ts` | Remove duplicated types, re-export from shared |
| MODIFY | `server/src/agents/secretary.ts` | Move `history` into function scope |
| MODIFY | `server/src/agents/pm.ts` | → config object via factory |
| MODIFY | `server/src/agents/techlead.ts` | → config object via factory |
| MODIFY | `server/src/agents/designer.ts` | → config object via factory |
| MODIFY | `server/src/agents/qa.ts` | → config object via factory |
| MODIFY | `server/src/agents/tester.ts` | → config object via factory |
| MODIFY | `server/src/demo.ts` | Remove dead `mockAgentCall` export |
| MODIFY | `server/src/llm.ts` | Lazy OpenAI singleton + `clearClientCache()` |
| MODIFY | `server/src/providers.ts` | In-memory `_cache`, call `clearClientCache` on activate |
| MODIFY | `server/src/sessions.ts` | Async fs/promises + in-memory Map |
| MODIFY | `server/src/orchestrator.ts` | Remove `sleep(8_000)`, unify demo mode path |
| MODIFY | `server/src/index.ts` | `await` async session functions |
| MODIFY | `server/tsconfig.json` | Add paths for `shared/*` |
| MODIFY | `client/vite.config.ts` | Add `resolve.alias` for `shared` |
| MODIFY | `client/tsconfig.app.json` | Add paths for `shared/*` |
| MODIFY | `client/src/ws/useSocket.ts` | Import `WsEvent` from shared, add reconnect |
| MODIFY | `client/src/hooks/useAgentStates.ts` | Fix stale closure, import from shared + constants |
| MODIFY | `client/src/App.tsx` | Dynamic WS URL |
| MODIFY | `client/src/components/ChatPanel.tsx` | Import from constants, cap log, extract styles |
| MODIFY | `client/src/components/AgentDock.tsx` | Import from constants, extract styles |
| MODIFY | `client/src/components/SessionSidebar.tsx` | Extract inline styles |
| MODIFY | `client/src/components/ProjectPicker.tsx` | Extract inline styles |

---

## Task 1: Run Baseline Benchmark

**Files:**
- Create: `server/src/bench.ts`

- [ ] **Step 1: Create the benchmark script**

```ts
// server/src/bench.ts
import { performance } from 'node:perf_hooks'
import { getActiveProvider } from './providers.js'
import { listSessions } from './sessions.js'

async function run() {
  console.log('=== BASELINE BENCHMARK ===\n')

  // 1. Provider — 100 calls
  const t1 = performance.now()
  for (let i = 0; i < 100; i++) getActiveProvider()
  const t2 = performance.now()
  console.log(`getActiveProvider() × 100 : ${(t2 - t1).toFixed(1)} ms  (${((t2-t1)/100).toFixed(2)} ms/call)`)

  // 2. Session list
  const t3 = performance.now()
  const sessions = await listSessions()
  const t4 = performance.now()
  console.log(`listSessions() (${sessions.length} sessions) : ${(t4 - t3).toFixed(1)} ms`)

  // 3. Pipeline overhead estimate (no LLM involved)
  const AGENT_COUNT = 6
  const SLEEP_MS_BEFORE = 8_000
  console.log(`\nPipeline sleep overhead (non-demo): ${AGENT_COUNT} × ${SLEEP_MS_BEFORE}ms = ${AGENT_COUNT * SLEEP_MS_BEFORE / 1000}s`)
  console.log('\n=== Save these numbers as BEFORE baseline ===')
}

run().catch(console.error)
```

- [ ] **Step 2: Run the benchmark (record output)**

```bash
cd server && npx tsx src/bench.ts
```

Expected output (approximate):
```
=== BASELINE BENCHMARK ===

getActiveProvider() × 100 : 8.0 ms  (0.08 ms/call)
listSessions() (N sessions) : X.X ms

Pipeline sleep overhead (non-demo): 6 × 8000ms = 48s
```

> Save the exact numbers — you will compare them in Task 18.

- [ ] **Step 3: Commit**

```bash
git add server/src/bench.ts
git commit -m "chore: add benchmark script for before/after comparison"
```

---

## Task 2: Create Shared Types + Wire Build

**Files:**
- Create: `server/src/shared/types.ts`
- Modify: `server/src/agents/types.ts`
- Modify: `server/tsconfig.json`
- Modify: `client/tsconfig.app.json`
- Modify: `client/vite.config.ts`
- Modify: `client/src/ws/useSocket.ts`

- [ ] **Step 1: Create `server/src/shared/types.ts`**

```ts
// server/src/shared/types.ts
export type AgentId =
  | 'secretary'
  | 'pm'
  | 'techlead'
  | 'designer'
  | 'dev'
  | 'qa'
  | 'tester'

export type WsEventType =
  | 'agent_thinking'
  | 'agent_status'
  | 'agent_move'
  | 'agent_message'
  | 'secretary_reply'
  | 'user_checkpoint'
  | 'pipeline_resumed'
  | 'pipeline_cancelled'
  | 'session_created'
  | 'error'

export interface WsEvent {
  type: WsEventType | string
  agent?: AgentId | string
  from?: AgentId | string
  to?: AgentId | string
  content?: string
  sessionId?: string
}
```

- [ ] **Step 2: Update `server/src/agents/types.ts` — remove duplicated types, re-export from shared**

Replace the entire file:

```ts
// server/src/agents/types.ts
export type { AgentId, WsEventType, WsEvent } from '../shared/types.js'

export interface AgentMessage {
  from: AgentId | 'user'
  to: AgentId | 'user'
  type: 'handoff' | 'reply' | 'question' | 'result'
  content: string
  artifacts?: string[]
}

export interface AgentDecision {
  thought: string
  action: 'reply_user' | 'assign'
  assignTo?: AgentId
  taskMessage?: string
  replyContent?: string
}

export interface AgentResponse {
  content: string
  next?: {
    to: AgentId
    message: string
    type: AgentMessage['type']
  }
  done?: boolean
}
```

- [ ] **Step 3: Update `server/tsconfig.json` — add paths**

Replace the entire file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "paths": {
      "shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Update `client/tsconfig.app.json` — add paths**

Replace the entire file:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "shared/*": ["../server/src/shared/*"]
    }
  },
  "include": ["src", "../server/src/shared"]
}
```

- [ ] **Step 5: Update `client/vite.config.ts` — add resolve alias**

Replace the entire file:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      shared: path.resolve(__dirname, '../server/src/shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 6: Update `client/src/ws/useSocket.ts` — use shared WsEvent, re-export it**

Replace the entire file:

```ts
import { useEffect, useRef, useState, useCallback } from 'react'
import type { WsEvent } from 'shared/types'

export type { WsEvent }

export function useSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let retryDelay = 1_000
    let destroyed = false

    function connect() {
      if (destroyed) return
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        retryDelay = 1_000
        setConnected(true)
      }
      ws.onclose = () => {
        setConnected(false)
        if (!destroyed) {
          setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30_000)
        }
      }
      ws.onmessage = (e) => {
        try {
          setLastEvent(JSON.parse(e.data) as WsEvent)
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()
    return () => {
      destroyed = true
      wsRef.current?.close()
    }
  }, [url])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send, lastEvent, connected }
}
```

- [ ] **Step 7: Verify TypeScript compiles on both sides**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

```bash
cd ../client && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add server/src/shared/types.ts server/src/agents/types.ts server/tsconfig.json \
        client/tsconfig.app.json client/vite.config.ts client/src/ws/useSocket.ts
git commit -m "refactor: add shared/types.ts as single source of truth for WsEvent + AgentId"
```

---

## Task 3: Create Server Constants

**Files:**
- Create: `server/src/constants.ts`

- [ ] **Step 1: Create `server/src/constants.ts`**

```ts
// server/src/constants.ts
export const AGENT_SLEEP_MS = 300
export const DEMO_SLEEP_MS = 500
export const RETRY_BASE_DELAY_MS = 15_000
export const RETRY_MAX_DELAY_MS = 120_000
export const MAX_RETRIES = 5
export const AGENT_MESSAGE_PREVIEW_LEN = 200
export const AGENT_STATUS_DONE_DELAY_MS = 300
```

- [ ] **Step 2: Verify file parses**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/constants.ts
git commit -m "refactor: extract server magic numbers into constants.ts"
```

---

## Task 4: Fix `secretary.ts` History Singleton

**Files:**
- Modify: `server/src/agents/secretary.ts`

- [ ] **Step 1: Replace `secretary.ts` — move history into function scope**

Replace the entire file:

```ts
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
```

Key change: the module-level `const history: ChatMessage[] = []` and its `.push()` calls are gone. Each call is now stateless.

- [ ] **Step 2: Verify**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/agents/secretary.ts
git commit -m "fix: secretary history singleton — each call now uses fresh context"
```

---

## Task 5: Clean Up `demo.ts`

**Files:**
- Modify: `server/src/demo.ts`

- [ ] **Step 1: Remove the unused `mockAgentCall` export**

Replace the entire file:

```ts
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
```

- [ ] **Step 2: Verify**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/demo.ts
git commit -m "refactor: remove dead mockAgentCall export from demo.ts"
```

---

## Task 6: OpenAI Client Cache in `llm.ts`

**Files:**
- Modify: `server/src/llm.ts`

- [ ] **Step 1: Replace `llm.ts` — add lazy singleton + `clearClientCache()`**

Replace the entire file:

```ts
import OpenAI from 'openai'
import 'dotenv/config'
import { getActiveProvider } from './providers.js'
import {
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  MAX_RETRIES,
} from './constants.js'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type StatusFn = (msg: string) => void
let _statusFn: StatusFn | null = null
export function setStatusEmitter(fn: StatusFn | null) { _statusFn = fn }
function emitStatus(msg: string) { _statusFn?.(msg) }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Client cache ──────────────────────────────────────────────────────────────
const _clientCache = new Map<string, { client: OpenAI; model: string }>()

export function clearClientCache() {
  _clientCache.clear()
}

function getClient(): { client: OpenAI; model: string } {
  const p = getActiveProvider()
  if (p?.apiKey) {
    const key = `${p.baseURL}::${p.apiKey}::${p.model}`
    let cached = _clientCache.get(key)
    if (!cached) {
      cached = { client: new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey }), model: p.model }
      _clientCache.set(key, cached)
    }
    return cached
  }
  // fallback to env
  const baseURL = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL ?? 'moonshotai/kimi-k2.6'
  if (!baseURL || !apiKey) throw new Error('ไม่มี LLM provider ที่พร้อมใช้งาน')
  const key = `${baseURL}::${apiKey}::${model}`
  let cached = _clientCache.get(key)
  if (!cached) {
    cached = { client: new OpenAI({ baseURL, apiKey }), model }
    _clientCache.set(key, cached)
  }
  return cached
}

async function chatWithRetry(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxRetries = MAX_RETRIES
): Promise<string> {
  let delay = RETRY_BASE_DELAY_MS

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      emitStatus(attempt === 0 ? 'กำลังนึกอยู่...' : 'ขอคิดใหม่อีกทีนะ...')
      const { client, model } = getClient()
      const response = await client.chat.completions.create({ model, messages })
      const content = response.choices[0]?.message.content
      if (!content) {
        emitStatus('เอ๋ ยังไม่ได้คำตอบ รอแป๊บนึง...')
        await sleep(5_000)
        continue
      }
      return content
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit')
      const is5xx = msg.includes('500') || msg.includes('502') || msg.includes('503')

      if ((is429 || is5xx) && attempt < maxRetries) {
        const waitSec = Math.round(delay / 1000)
        emitStatus(is429
          ? `งานเข้ามาเยอะหน่อย ขอพักซักครู่ (~${waitSec}s)...`
          : `มีปัญหานิดหน่อย ลองใหม่อีกทีนะ...`
        )
        await sleep(delay)
        delay = Math.min(delay * 1.5, RETRY_MAX_DELAY_MS)
        continue
      }
      throw err
    }
  }
  throw new Error('LLM: เกิน max retries')
}

export async function chat(systemPrompt: string, history: ChatMessage[]): Promise<string> {
  return chatWithRetry([{ role: 'system', content: systemPrompt }, ...history])
}

export async function chatJSON<T>(systemPrompt: string, history: ChatMessage[]): Promise<T> {
  const raw = await chat(systemPrompt + '\n\nตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น', history)
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    throw new Error(`Invalid JSON response: ${cleaned.slice(0, 200)}`, { cause: error })
  }
}

export async function testProvider(baseURL: string, apiKey: string, model: string): Promise<string> {
  const client = new OpenAI({ baseURL, apiKey })
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'ตอบว่า "ok" เท่านั้น' }],
    max_tokens: 10,
  })
  return res.choices[0]?.message.content ?? '(ไม่มีคำตอบ)'
}
```

- [ ] **Step 2: Verify**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/llm.ts
git commit -m "perf: add lazy OpenAI client singleton + clearClientCache()"
```

---

## Task 7: In-Memory Cache for `providers.ts`

**Files:**
- Modify: `server/src/providers.ts`

- [ ] **Step 1: Replace `providers.ts` — add module-level `_cache`, call `clearClientCache` on activate**

Replace the entire file:

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { clearClientCache } from './llm.js'

const DATA_DIR = join(process.cwd(), 'data')
const FILE = join(DATA_DIR, 'providers.json')

export interface Provider {
  id: string
  name: string
  baseURL: string
  apiKey: string
  model: string
  isActive: boolean
}

let _cache: Provider[] | null = null

function load(): Provider[] {
  if (_cache) return _cache
  if (!existsSync(FILE)) { _cache = defaultProviders(); return _cache }
  try {
    _cache = JSON.parse(readFileSync(FILE, 'utf8')) as Provider[]
    return _cache
  } catch {
    _cache = defaultProviders()
    return _cache
  }
}

function save(providers: Provider[]) {
  _cache = providers
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(providers, null, 2), 'utf8')
}

function defaultProviders(): Provider[] {
  const list: Provider[] = [
    {
      id: randomUUID(),
      name: 'Kimi K2.6 (maxplus)',
      baseURL: process.env.LLM_BASE_URL ?? 'https://api.maxplus-ai.cc/kimi/v1',
      apiKey: process.env.LLM_API_KEY ?? '',
      model: 'moonshotai/kimi-k2.6',
      isActive: true,
    },
    {
      id: randomUUID(),
      name: 'Moonshot Official',
      baseURL: 'https://api.moonshot.cn/v1',
      apiKey: '',
      model: 'moonshot-v1-8k',
      isActive: false,
    },
    {
      id: randomUUID(),
      name: 'Groq (llama-3.3-70b)',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: '',
      model: 'llama-3.3-70b-versatile',
      isActive: false,
    },
    {
      id: randomUUID(),
      name: 'DeepSeek Chat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
      isActive: false,
    },
  ]
  save(list)
  return list
}

export function listProviders(): Provider[] {
  return load()
}

export function getActiveProvider(): Provider | null {
  return load().find(p => p.isActive) ?? null
}

export function addProvider(data: Omit<Provider, 'id' | 'isActive'>): Provider {
  const providers = load()
  const p: Provider = { ...data, id: randomUUID(), isActive: false }
  providers.push(p)
  save(providers)
  return p
}

export function activateProvider(id: string): Provider | null {
  const providers = load()
  const target = providers.find(p => p.id === id)
  if (!target) return null
  providers.forEach(p => { p.isActive = p.id === id })
  save(providers)
  clearClientCache()
  return target
}

export function deleteProvider(id: string): boolean {
  const providers = load()
  const idx = providers.findIndex(p => p.id === id)
  if (idx === -1) return false
  providers.splice(idx, 1)
  if (providers.length > 0 && !providers.some(p => p.isActive)) {
    providers[0].isActive = true
  }
  save(providers)
  clearClientCache()
  return true
}

export function updateProvider(id: string, data: Partial<Omit<Provider, 'id' | 'isActive'>>): Provider | null {
  const providers = load()
  const p = providers.find(p => p.id === id)
  if (!p) return null
  Object.assign(p, data)
  save(providers)
  clearClientCache()
  return p
}
```

- [ ] **Step 2: Verify**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/providers.ts
git commit -m "perf: in-memory provider cache — reads disk once per process lifetime"
```

---

## Task 8: Async Sessions with In-Memory Map

**Files:**
- Modify: `server/src/sessions.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Replace `sessions.ts` — async fs/promises + in-memory Map**

Replace the entire file:

```ts
import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const DATA_DIR = join(process.cwd(), 'data', 'sessions')

export interface SessionMessage {
  role: 'user' | 'assistant' | 'agent'
  content: string
  agentId?: string
  timestamp: string
}

export interface Session {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: SessionMessage[]
}

const _sessions = new Map<string, Session>()
let _initialized = false

async function ensureLoaded(): Promise<void> {
  if (_initialized) return
  _initialized = true
  try {
    const files = await readdir(DATA_DIR)
    for (const f of files.filter(f => f.endsWith('.json'))) {
      try {
        const raw = await readFile(join(DATA_DIR, f), 'utf8')
        const s: Session = JSON.parse(raw)
        _sessions.set(s.id, s)
      } catch { /* skip corrupted files */ }
    }
  } catch { /* DATA_DIR doesn't exist yet — start empty */ }
}

function sessionPath(id: string) {
  return join(DATA_DIR, `${id}.json`)
}

async function writeToDisk(session: Session): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf8')
  } catch (err) {
    console.error('[sessions] write error:', err)
  }
}

async function deleteDisk(id: string): Promise<void> {
  try {
    await unlink(sessionPath(id))
  } catch { /* file may not exist on disk yet */ }
}

export async function createSession(): Promise<Session> {
  await ensureLoaded()
  const now = new Date().toISOString()
  const session: Session = {
    id: randomUUID(),
    title: 'แชทใหม่',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
  _sessions.set(session.id, session)
  void writeToDisk(session)
  return session
}

export async function listSessions(): Promise<Omit<Session, 'messages'>[]> {
  await ensureLoaded()
  return [..._sessions.values()]
    .map(({ messages: _m, ...meta }) => meta)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getSession(id: string): Promise<Session | null> {
  await ensureLoaded()
  return _sessions.get(id) ?? null
}

export async function deleteSession(id: string): Promise<boolean> {
  await ensureLoaded()
  if (!_sessions.has(id)) return false
  _sessions.delete(id)
  void deleteDisk(id)
  return true
}

export async function appendMessage(id: string, msg: SessionMessage): Promise<void> {
  await ensureLoaded()
  const session = _sessions.get(id)
  if (!session) return
  session.messages.push(msg)
  session.updatedAt = new Date().toISOString()
  if (session.title === 'แชทใหม่' && msg.role === 'user') {
    session.title = msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : '')
  }
  void writeToDisk(session)
}
```

- [ ] **Step 2: Update `server/src/index.ts` — await all async session calls**

Replace the entire file:

```ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import http from 'http'
import { readdirSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { handleUserMessage, resolveCheckpoint, cancelPipeline, registerReplyHook, unregisterReplyHook } from './orchestrator.js'
import { setProjectRoot, getProjectRoot } from './project.js'
import { listProviders, addProvider, activateProvider, deleteProvider, updateProvider } from './providers.js'
import { testProvider } from './llm.js'
import { createSession, listSessions, getSession, appendMessage, deleteSession } from './sessions.js'
import { isDemoMode, setDemoMode } from './demo.js'
import { listFiles, readFile } from './tools/fileSystem.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// LLM Providers
app.get('/api/providers', (_req, res) => res.json(listProviders()))

app.post('/api/providers', (req, res) => {
  const { name, baseURL, apiKey, model } = req.body as Record<string, string>
  if (!name || !baseURL || !apiKey || !model) { res.status(400).json({ error: 'ข้อมูลไม่ครบ' }); return }
  res.json(addProvider({ name, baseURL, apiKey, model }))
})

app.put('/api/providers/:id', (req, res) => {
  const p = updateProvider(req.params.id, req.body)
  if (!p) { res.status(404).json({ error: 'ไม่พบ provider' }); return }
  res.json(p)
})

app.put('/api/providers/:id/activate', (req, res) => {
  const p = activateProvider(req.params.id)
  if (!p) { res.status(404).json({ error: 'ไม่พบ provider' }); return }
  res.json(p)
})

app.delete('/api/providers/:id', (req, res) => {
  if (!deleteProvider(req.params.id)) { res.status(404).json({ error: 'ไม่พบ provider' }); return }
  res.json({ ok: true })
})

app.post('/api/providers/test', async (req, res) => {
  const { baseURL, apiKey, model } = req.body as Record<string, string>
  try {
    const result = await testProvider(baseURL, apiKey, model)
    res.json({ ok: true, response: result })
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// Directory browser
app.get('/api/browse', (req, res) => {
  const raw = (req.query.path as string) || homedir()
  const abs = resolve(raw)
  if (!existsSync(abs)) {
    res.status(400).json({ error: 'ไม่พบ path นี้' })
    return
  }
  try {
    const entries = readdirSync(abs, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: join(abs, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    res.json({ path: abs, parent: dirname(abs) !== abs ? dirname(abs) : null, entries })
  } catch {
    res.status(403).json({ error: 'ไม่มีสิทธิ์อ่าน directory นี้' })
  }
})

// Project directory
app.get('/api/project', (_req, res) => {
  res.json({ path: getProjectRoot() })
})

app.put('/api/project', (req, res) => {
  const { path } = req.body as { path?: string }
  if (typeof path !== 'string') {
    res.status(400).json({ error: 'path ต้องเป็น string' })
    return
  }
  const result = setProjectRoot(path)
  if (!result.ok) {
    res.status(400).json({ error: result.error })
    return
  }
  res.json({ path: getProjectRoot() })
})

// Sessions
app.get('/api/sessions', async (_req, res) => {
  res.json(await listSessions())
})

app.post('/api/sessions', async (_req, res) => {
  res.json(await createSession())
})

app.get('/api/sessions/:id', async (req, res) => {
  const session = await getSession(req.params.id)
  if (!session) { res.status(404).json({ error: 'ไม่พบ session' }); return }
  res.json(session)
})

app.delete('/api/sessions/:id', async (req, res) => {
  const ok = await deleteSession(req.params.id)
  if (!ok) { res.status(404).json({ error: 'ไม่พบ session' }); return }
  res.json({ ok: true })
})

// Demo mode
app.get('/api/demo', (_req, res) => res.json({ demo: isDemoMode() }))
app.post('/api/demo', (req, res) => {
  const { demo } = req.body as { demo?: boolean }
  const current = demo !== undefined ? setDemoMode(demo) : setDemoMode(!isDemoMode())
  res.json({ demo: current })
})

// File browser API
app.get('/api/files', (_req, res) => {
  try {
    const files = listFiles('.', 3)
    res.json(files)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

app.get('/api/files/read', (req, res) => {
  const path = req.query.path as string
  if (!path) { res.status(400).json({ error: 'ต้องระบุ path' }); return }
  try {
    const content = readFile(path)
    res.json({ content })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  console.log('[ws] client connected')
  let currentSessionId: string | null = null

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as { type?: string; content: string; sessionId?: string }

      if (parsed.type === 'cancel') {
        cancelPipeline(ws)
        return
      }

      const { content, sessionId } = parsed

      if (!content || typeof content !== 'string') {
        ws.send(JSON.stringify({ type: 'error', content: 'Invalid message format' }))
        return
      }

      if (resolveCheckpoint(ws, content)) return

      if (sessionId && await getSession(sessionId)) {
        currentSessionId = sessionId
      }
      if (!currentSessionId) {
        const newSession = await createSession()
        currentSessionId = newSession.id
        ws.send(JSON.stringify({ type: 'session_created', sessionId: currentSessionId }))
      }

      await appendMessage(currentSessionId, {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      })

      const sid = currentSessionId
      registerReplyHook(ws, (replyContent) => {
        void appendMessage(sid, {
          role: 'assistant',
          content: replyContent,
          timestamp: new Date().toISOString(),
        })
      })

      try {
        await handleUserMessage(content, ws)
      } finally {
        unregisterReplyHook(ws)
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', content: String(err) }))
    }
  })

  ws.on('close', () => console.log('[ws] client disconnected'))
})

const PORT = Number(process.env.PORT ?? 3001)
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
```

- [ ] **Step 3: Verify**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/src/sessions.ts server/src/index.ts
git commit -m "perf: sessions in-memory Map + async write-behind — listSessions() now O(1)"
```

---

## Task 9: Remove `sleep(8_000)` from `orchestrator.ts`

**Files:**
- Modify: `server/src/orchestrator.ts`

- [ ] **Step 1: Replace `orchestrator.ts` — use constants, unify demo mode path for secretary**

Replace the entire file:

```ts
import type WebSocket from 'ws'
import type { AgentId, WsEvent } from './agents/types.js'
import { setStatusEmitter } from './llm.js'
import { secretaryDecide, secretarySummarize } from './agents/secretary.js'
import { pmProcess } from './agents/pm.js'
import { techLeadProcess } from './agents/techlead.js'
import { designerProcess } from './agents/designer.js'
import { devProcess } from './agents/dev.js'
import { qaProcess } from './agents/qa.js'
import { testerProcess } from './agents/tester.js'
import { isDemoMode, MOCK_RESPONSES } from './demo.js'
import {
  AGENT_SLEEP_MS,
  DEMO_SLEEP_MS,
  AGENT_MESSAGE_PREVIEW_LEN,
} from './constants.js'

// ─── Cancel Pipeline ──────────────────────────────────────────────────────────

class PipelineCancelledError extends Error { constructor() { super('Pipeline cancelled') } }

const cancelledConnections = new WeakSet<WebSocket>()

export function cancelPipeline(ws: WebSocket) {
  cancelledConnections.add(ws)
  const resolver = checkpointResolvers.get(ws)
  if (resolver) { checkpointResolvers.delete(ws); resolver('__cancelled__') }
}

function checkCancelled(ws: WebSocket) {
  if (cancelledConnections.has(ws)) {
    cancelledConnections.delete(ws)
    throw new PipelineCancelledError()
  }
}

const checkpointResolvers: Map<WebSocket, (answer: string) => void> = new Map()

export function resolveCheckpoint(ws: WebSocket, answer: string): boolean {
  const resolver = checkpointResolvers.get(ws)
  if (!resolver) return false
  checkpointResolvers.delete(ws)
  resolver(answer)
  return true
}

const replyHooks: Map<WebSocket, (content: string) => void> = new Map()
export function registerReplyHook(ws: WebSocket, fn: (content: string) => void) { replyHooks.set(ws, fn) }
export function unregisterReplyHook(ws: WebSocket) { replyHooks.delete(ws) }

function emit(ws: WebSocket, event: WsEvent) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event))
    if (event.type === 'secretary_reply' && event.content) {
      replyHooks.get(ws)?.(event.content)
    }
  }
}

async function checkpoint(ws: WebSocket, summary: string, question: string): Promise<string> {
  emit(ws, { type: 'user_checkpoint', content: `${summary}\n\n---\n${question}` })
  return new Promise(resolve => { checkpointResolvers.set(ws, resolve) })
}

function thinking(ws: WebSocket, ...agents: AgentId[]) {
  agents.forEach(agent => emit(ws, { type: 'agent_thinking', agent }))
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function withStatus(ws: WebSocket, agentId: AgentId, fn: () => Promise<unknown>) {
  checkCancelled(ws)
  setStatusEmitter((msg) => emit(ws, { type: 'agent_status', agent: agentId, content: msg }))

  let result: unknown
  if (isDemoMode()) {
    emit(ws, { type: 'agent_status', agent: agentId, content: 'กำลังทำงาน...' })
    await sleep(DEMO_SLEEP_MS + Math.random() * 300)
    const mock = MOCK_RESPONSES[agentId]
    result = mock !== undefined ? mock : await fn()
  } else {
    result = await fn()
  }

  setStatusEmitter(null)
  checkCancelled(ws)
  emit(ws, { type: 'agent_status', agent: agentId, content: 'เสร็จแล้ว ส่งต่อ...' })
  await sleep(AGENT_SLEEP_MS)
  return result
}

function message(ws: WebSocket, from: AgentId, to: AgentId | 'user', content: string) {
  emit(ws, { type: 'agent_message', from, to, content: content.slice(0, AGENT_MESSAGE_PREVIEW_LEN) })
}

function move(ws: WebSocket, from: AgentId, to: AgentId) {
  emit(ws, { type: 'agent_move', from, to })
}

export async function handleUserMessage(userMessage: string, ws: WebSocket) {
  try {
    thinking(ws, 'secretary')

    const decision = await withStatus(ws, 'secretary', () => secretaryDecide(userMessage)) as Awaited<ReturnType<typeof secretaryDecide>>

    if (decision.action === 'reply_user') {
      emit(ws, { type: 'secretary_reply', content: decision.replyContent })
      return
    }

    const originalTask = decision.taskMessage ?? userMessage
    const results: Record<string, string> = {}

    // ─── Stage 1: PM ──────────────────────────────────────────────────────────
    move(ws, 'secretary', 'pm')
    thinking(ws, 'pm')
    const pmResult = await withStatus(ws, 'pm', () => pmProcess(originalTask)) as Awaited<ReturnType<typeof pmProcess>>
    results.pm = pmResult.content
    message(ws, 'pm', 'secretary', pmResult.content)

    const ck1 = await checkpoint(
      ws,
      `**อิง (PM) วิเคราะห์ requirement เสร็จแล้ว:**\n\n${pmResult.content}`,
      'ดำเนินการต่อไหมคะ? พิมพ์ "ต่อ" หรือแก้ไข requirement ได้เลย'
    )
    if (ck1 === '__cancelled__') throw new PipelineCancelledError()
    const refinedTask = isApproval(ck1) ? originalTask : `${originalTask}\n\nหัวหน้าแก้ไข: ${ck1}`
    emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ดำเนินการต่อเลย' })

    // ─── Stage 2: Tech Lead + Designer ────────────────────────────────────────
    move(ws, 'pm', 'techlead')
    thinking(ws, 'techlead', 'designer')

    const ctx = `Requirements:\n${results.pm}\n\nTask: ${refinedTask}`
    const tlResult = await withStatus(ws, 'techlead', () => techLeadProcess(ctx)) as Awaited<ReturnType<typeof techLeadProcess>>
    const dsResult = await withStatus(ws, 'designer', () => designerProcess(ctx)) as Awaited<ReturnType<typeof designerProcess>>
    results.techlead = tlResult.content
    results.designer = dsResult.content
    message(ws, 'techlead', 'dev', tlResult.content)
    message(ws, 'designer', 'dev', dsResult.content)

    const preview2 = [
      `**ต้น (Tech Lead):** ${tlResult.content.slice(0, 300)}...`,
      `**แนน (Designer):** ${dsResult.content.slice(0, 300)}...`,
    ].join('\n\n')
    const ck2 = await checkpoint(
      ws,
      `**ต้น และ แนน ทำงานเสร็จพร้อมกัน:**\n\n${preview2}`,
      'อนุมัติ plan นี้ไหมคะ? พิมพ์ "ต่อ" หรือระบุสิ่งที่ต้องแก้'
    )
    if (ck2 === '__cancelled__') throw new PipelineCancelledError()
    const devContext = buildDevContext(results, isApproval(ck2) ? '' : ck2)
    emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ส่งให้เปาเลย' })

    // ─── Stage 3: Dev ─────────────────────────────────────────────────────────
    move(ws, 'techlead', 'dev')
    thinking(ws, 'dev')
    const devResult = await withStatus(ws, 'dev', () => devProcess(devContext)) as Awaited<ReturnType<typeof devProcess>>
    results.dev = devResult.content
    message(ws, 'dev', 'qa', devResult.content)

    const ck3 = await checkpoint(
      ws,
      `**เปา (Dev) ทำงานเสร็จแล้ว:**\n\n${devResult.content.slice(0, 400)}${devResult.content.length > 400 ? '...' : ''}`,
      'ส่ง QA และ Tester ต่อไหมคะ? พิมพ์ "ต่อ" หรือสั่งให้เปาแก้ไขก่อน'
    )
    if (ck3 === '__cancelled__') throw new PipelineCancelledError()
    if (!isApproval(ck3)) {
      emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ให้เปาแก้ก่อนนะคะ' })
      thinking(ws, 'dev')
      const devRevised = await devProcess(`${devContext}\n\nหัวหน้าขอแก้: ${ck3}\n\nงานเดิม:\n${devResult.content}`)
      results.dev = devRevised.content
      message(ws, 'dev', 'qa', devRevised.content)
    }
    emit(ws, { type: 'pipeline_resumed', content: 'รับทราบค่ะ ส่ง QA + Tester พร้อมกันเลย' })

    // ─── Stage 4: QA + Tester ─────────────────────────────────────────────────
    move(ws, 'dev', 'qa')
    thinking(ws, 'qa', 'tester')

    const testCtx = `Code/Plan จาก Dev:\n${results.dev}\n\nOriginal requirements:\n${results.pm}`
    const qaResult = await withStatus(ws, 'qa', () => qaProcess(testCtx)) as Awaited<ReturnType<typeof qaProcess>>
    const testerResult = await withStatus(ws, 'tester', () => testerProcess(testCtx)) as Awaited<ReturnType<typeof testerProcess>>
    results.qa = qaResult.content
    results.tester = testerResult.content
    message(ws, 'qa', 'secretary', qaResult.content)
    message(ws, 'tester', 'secretary', testerResult.content)

    // ─── Final summary ────────────────────────────────────────────────────────
    thinking(ws, 'secretary')
    setStatusEmitter((msg) => emit(ws, { type: 'agent_status', agent: 'secretary', content: msg }))
    const allResults = Object.entries(results)
      .map(([k, v]) => `### ${k.toUpperCase()}\n${v}`)
      .join('\n\n---\n\n')

    const summary = isDemoMode()
      ? MOCK_RESPONSES['secretary_summarize'] as string
      : await secretarySummarize(userMessage, allResults)

    emit(ws, { type: 'secretary_reply', content: summary })
  } catch (err) {
    if (err instanceof PipelineCancelledError) {
      setStatusEmitter(null)
      emit(ws, { type: 'pipeline_cancelled', content: 'ยกเลิกแล้วค่ะ' })
      return
    }
    throw err
  }
}

function isApproval(text: string): boolean {
  const t = text.trim().toLowerCase()
  return ['ต่อ', 'ok', 'okay', 'yes', 'ใช่', 'ได้', 'ดี', 'โอเค', 'ตกลง', 'ผ่าน', 'continue'].some(
    w => t === w || t.startsWith(w + ' ') || t.startsWith(w + '\n')
  )
}

function buildDevContext(results: Record<string, string>, userNote: string): string {
  return [
    `## Requirements (PM)\n${results.pm}`,
    `## Architecture (Tech Lead)\n${results.techlead}`,
    `## UI/UX Spec (Designer)\n${results.designer}`,
    userNote ? `## หมายเหตุจากหัวหน้า\n${userNote}` : '',
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')
}
```

- [ ] **Step 2: Verify**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/orchestrator.ts
git commit -m "perf: replace sleep(8_000) with AGENT_SLEEP_MS=300 — saves ~46s per pipeline run"
```

---

## Task 10: Agent Factory + Refactor Simple Agents

**Files:**
- Create: `server/src/agents/factory.ts`
- Modify: `server/src/agents/pm.ts`
- Modify: `server/src/agents/techlead.ts`
- Modify: `server/src/agents/designer.ts`
- Modify: `server/src/agents/qa.ts`
- Modify: `server/src/agents/tester.ts`

> `dev.ts` is NOT changed — it has a tool-calling loop that doesn't fit the factory pattern.

- [ ] **Step 1: Create `server/src/agents/factory.ts`**

```ts
import { chatJSON } from '../llm.js'
import { characterPrompt } from './characters.js'
import type { AgentResponse } from './types.js'
import type { ChatMessage } from '../llm.js'

export interface SimpleAgentConfig {
  characterId: string
  systemBody: string
  jsonTemplate: string
}

export function createSimpleAgent(
  config: SimpleAgentConfig
): (message: string) => Promise<AgentResponse> {
  const system = [
    config.systemBody,
    '',
    characterPrompt(config.characterId),
    '',
    'ตอบ JSON รูปแบบนี้เท่านั้น:',
    config.jsonTemplate,
  ].join('\n')

  return async function process(message: string): Promise<AgentResponse> {
    const history: ChatMessage[] = [{ role: 'user', content: message }]
    return chatJSON<AgentResponse>(system, history)
  }
}
```

- [ ] **Step 2: Replace `server/src/agents/pm.ts`**

```ts
import { createSimpleAgent } from './factory.js'

export const pmProcess = createSimpleAgent({
  characterId: 'pm',
  systemBody: `คุณชื่อ อิง เป็น Product Manager ของบริษัท
ทำหน้าที่แปลง request ของ user เป็น requirement ที่ชัดเจน

เมื่อได้รับ request:
1. วิเคราะห์ว่า user ต้องการอะไรจริงๆ
2. เขียน user stories ในรูปแบบ "ในฐานะ [ผู้ใช้] ฉันต้องการ [สิ่งที่ต้องการ] เพื่อ [เหตุผล]"
3. ระบุ acceptance criteria
4. ระบุ scope อย่างชัดเจน
5. ประเมินความซับซ้อน (small/medium/large)`,
  jsonTemplate: `{
  "content": "## Requirements\\n\\n**User Stories:**\\n- ...\\n\\n**Acceptance Criteria:**\\n- ...\\n\\n**Scope:** ...\\n\\n**Complexity:** small/medium/large",
  "next": null,
  "done": true
}`,
})
```

- [ ] **Step 3: Replace `server/src/agents/techlead.ts`**

```ts
import { createSimpleAgent } from './factory.js'

export const techLeadProcess = createSimpleAgent({
  characterId: 'techlead',
  systemBody: `คุณชื่อ ต้น เป็น Tech Lead / Software Architect ของบริษัท
ทำหน้าที่วาง architecture และกำหนด technical standard

เมื่อได้รับ requirements:
1. เลือก tech stack ที่เหมาะสม พร้อมเหตุผล
2. ออกแบบ architecture (component diagram, data flow)
3. กำหนด API contracts ถ้ามี
4. ระบุ risks และ mitigation
5. แบ่งงานเป็น tasks ให้ dev ทำได้จริง`,
  jsonTemplate: `{
  "content": "## Architecture Plan\\n\\n**Tech Stack:** ...\\n\\n**Architecture:**\\n...\\n\\n**Dev Tasks:**\\n1. ...\\n\\n**Risks:**\\n- ...",
  "next": null,
  "done": true
}`,
})
```

- [ ] **Step 4: Replace `server/src/agents/designer.ts`**

```ts
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
```

- [ ] **Step 5: Replace `server/src/agents/qa.ts`**

```ts
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
```

- [ ] **Step 6: Replace `server/src/agents/tester.ts`**

```ts
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
```

- [ ] **Step 7: Verify everything compiles**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add server/src/agents/factory.ts server/src/agents/pm.ts server/src/agents/techlead.ts \
        server/src/agents/designer.ts server/src/agents/qa.ts server/src/agents/tester.ts
git commit -m "refactor: agent factory — 5 boilerplate files replaced with config objects"
```

---

## Task 11: Create Client Agent Constants

**Files:**
- Create: `client/src/constants/agents.ts`

- [ ] **Step 1: Create `client/src/constants/agents.ts`**

```ts
// client/src/constants/agents.ts
export const AGENT_ORDER = ['secretary', 'pm', 'techlead', 'designer', 'dev', 'qa', 'tester'] as const
export type AgentKey = typeof AGENT_ORDER[number]

export const AGENT_NAMES: Record<AgentKey, string> = {
  secretary: 'ฟ้า',
  pm:        'อิง',
  techlead:  'ต้น',
  designer:  'แนน',
  dev:       'เปา',
  qa:        'มิ้น',
  tester:    'โบ้ท',
}

export const AGENT_META: Record<AgentKey, { color: string; role: string; emoji: string }> = {
  secretary: { color: '#7c3aed', role: 'Secretary',   emoji: '📋' },
  pm:        { color: '#be185d', role: 'PM',           emoji: '📊' },
  techlead:  { color: '#1d4ed8', role: 'Tech Lead',    emoji: '🏗️' },
  designer:  { color: '#b91c1c', role: 'Designer',     emoji: '🎨' },
  dev:       { color: '#1d4ed8', role: 'Developer',    emoji: '💻' },
  qa:        { color: '#065f46', role: 'QA Engineer',  emoji: '🔍' },
  tester:    { color: '#c2410c', role: 'Tester',       emoji: '🧪' },
}

export const AGENT_COLORS: Record<string, string> = {
  ฟ้า: '#a78bfa',
  อิง: '#f472b6',
  ต้น: '#38bdf8',
  แนน: '#fb7185',
  เปา: '#60a5fa',
  มิ้น: '#34d399',
  โบ้ท: '#fb923c',
  คุณ: '#f9fafb',
}

export function agentIdToName(id: string): string {
  return AGENT_NAMES[id as AgentKey] ?? id
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/constants/agents.ts
git commit -m "refactor: add client constants/agents.ts — single source for all agent metadata"
```

---

## Task 12: Fix Stale Closure in `useAgentStates.ts`

**Files:**
- Modify: `client/src/hooks/useAgentStates.ts`

- [ ] **Step 1: Replace `useAgentStates.ts` — functional updates everywhere, remove `states` from deps**

Replace the entire file:

```ts
import { useState, useCallback } from 'react'
import type { WsEvent } from 'shared/types'
import { createAgentStates, type AgentState } from '../components/AgentDock'
import { agentIdToName } from '../constants/agents'

function now() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function addLog(logs: AgentState['log'], text: string): AgentState['log'] {
  return [...logs, { time: now(), text }].slice(-12)
}

export function useAgentStates() {
  const [states, setStates] = useState<Record<string, AgentState>>(createAgentStates)

  const handleEvent = useCallback((evt: WsEvent) => {
    const { type, agent, from, to, content } = evt

    if (type === 'agent_thinking' && agent) {
      setStates(prev => {
        const s = prev[agent]
        if (!s) return prev
        return { ...prev, [agent]: { ...s, statusType: 'thinking', status: 'กำลังนึกอยู่...', log: addLog(s.log, 'เริ่มคิด...') } }
      })
    }

    if (type === 'agent_status' && agent) {
      const text = content ?? ''
      const isDone = text.includes('เสร็จแล้ว')
      const isWait = text.includes('รอ') || text.includes('ลองใหม่') || text.includes('พัก')
      setStates(prev => {
        const s = prev[agent]
        if (!s) return prev
        return {
          ...prev,
          [agent]: {
            ...s,
            status: text,
            statusType: isDone ? 'done' : isWait ? 'waiting' : 'working',
            log: isDone ? addLog(s.log, text) : s.log,
          },
        }
      })
    }

    if (type === 'agent_message' && from) {
      const fromName = agentIdToName(from)
      const toName = to ? agentIdToName(to) : ''
      const preview = (content ?? '').replace(/#+\s*/g, '').replace(/\*+/g, '').trim().slice(0, 80)
      const previewText = preview + (preview.length >= 80 ? '…' : '')

      setStates(prev => {
        const next = { ...prev }
        const fromState = prev[from]
        if (fromState) {
          next[from] = {
            ...fromState,
            statusType: 'done',
            status: `ส่งงานให้ ${toName} แล้ว`,
            lastTalkedTo: toName,
            log: addLog(fromState.log, `→ ${toName}: ${previewText}`),
          }
        }
        if (to && prev[to]) {
          const toState = prev[to]
          next[to] = { ...toState, log: addLog(toState.log, `← ${fromName}: ${previewText}`) }
        }
        return next
      })
    }

    if (type === 'agent_move' && from && to) {
      const toName = agentIdToName(to)
      setStates(prev => {
        const s = prev[from]
        if (!s) return prev
        return { ...prev, [from]: { ...s, status: `กำลังเดินไปหา ${toName}`, log: addLog(s.log, `เดินไปหา ${toName}`) } }
      })
    }

    if (type === 'secretary_reply' || type === 'pipeline_cancelled') {
      setStates(prev => {
        const next = { ...prev }
        const isCancelled = type === 'pipeline_cancelled'
        Object.keys(next).forEach(id => {
          next[id] = { ...next[id], statusType: isCancelled ? 'cancelled' : 'idle', status: isCancelled ? 'ยกเลิก' : '' }
        })
        return next
      })
      if (type === 'pipeline_cancelled') {
        setTimeout(() => {
          setStates(prev => {
            const next = { ...prev }
            Object.keys(next).forEach(id => {
              if (next[id].statusType === 'cancelled') next[id] = { ...next[id], statusType: 'idle', status: '' }
            })
            return next
          })
        }, 2000)
      }
    }

    if (type === 'pipeline_resumed') {
      setStates(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(id => {
          if (next[id].statusType === 'done') next[id] = { ...next[id], statusType: 'idle', status: '' }
        })
        return next
      })
    }
  }, []) // no dependency on `states` — all reads use functional prev

  return { agentStates: states, handleAgentEvent: handleEvent }
}
```

- [ ] **Step 2: Verify**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useAgentStates.ts
git commit -m "fix: stale closure in useAgentStates — all state reads use functional prev"
```

---

## Task 13: Fix `App.tsx` Hardcoded URL

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Replace the hardcoded WS URL with a dynamic one**

In `App.tsx`, find:
```ts
const { send, lastEvent } = useSocket('ws://localhost:3001/ws')
```

Replace with:
```ts
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001/ws`
const { send, lastEvent } = useSocket(WS_URL)
```

Place the `WS_URL` constant directly above the `useSocket` call inside the `App` function body.

- [ ] **Step 2: Verify**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "fix: derive WS URL from window.location instead of hardcoding localhost"
```

---

## Task 14: Refactor `ChatPanel.tsx`

**Files:**
- Modify: `client/src/components/ChatPanel.tsx`

- [ ] **Step 1: Replace the entire file — remove duplicate maps, cap agentLog, extract styles**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Message } from '../App'
import type { WsEvent } from 'shared/types'
import { AGENT_COLORS, agentIdToName } from '../constants/agents'

interface Props {
  messages: Message[]
  onSend: (text: string) => void
  onCancel: () => void
  lastEvent: WsEvent | null
  pendingCheckpoint: boolean
  isRunning: boolean
  demoMode: boolean
  onToggleDemo: () => void
}

const MAX_LOG = 50

const styles = {
  root: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f23', borderLeft: '1px solid #2d2d4e', color: '#e2e8f0', fontSize: 13 } as React.CSSProperties,
  header: { padding: '10px 14px', borderBottom: '1px solid #2d2d4e', background: '#1a1a35', display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  headerTitle: { fontWeight: 'bold', color: '#a78bfa', fontSize: 12 } as React.CSSProperties,
  headerSub: { fontSize: 10, color: '#64748b' } as React.CSSProperties,
  messageList: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 } as React.CSSProperties,
  msgUserBubble: { background: '#312e81', padding: '8px 12px', borderRadius: 8, maxWidth: '85%', lineHeight: 1.5, whiteSpace: 'pre-wrap' } as React.CSSProperties,
  msgAgentBubble: { background: '#1e293b', padding: '8px 12px', borderRadius: 8, maxWidth: '85%', lineHeight: 1.5, whiteSpace: 'pre-wrap' } as React.CSSProperties,
  agentLogSection: { borderTop: '1px solid #1e293b', paddingTop: 6, marginTop: 2 } as React.CSSProperties,
  thinkingBox: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 10px', marginTop: 4 } as React.CSSProperties,
  checkpointBox: { border: '1px solid #f59e0b', borderRadius: 8, padding: 12, background: '#1c1200', marginTop: 4 } as React.CSSProperties,
  input: (isCheckpoint: boolean): React.CSSProperties => ({
    flex: 1, background: '#1e293b',
    border: `1px solid ${isCheckpoint ? '#f59e0b' : '#334155'}`,
    borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
  }),
  sendBtn: (isCheckpoint: boolean): React.CSSProperties => ({
    background: isCheckpoint ? '#d97706' : '#7c3aed',
    color: 'white', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold',
  }),
  demoBtn: (active: boolean): React.CSSProperties => ({
    background: active ? '#7c3aed' : '#1e293b',
    border: `1px solid ${active ? '#7c3aed' : '#334155'}`,
    color: active ? '#fff' : '#64748b',
    borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 10,
  }),
  cancelBtn: { background: '#7f1d1d', border: '1px solid #991b1b', color: '#fca5a5', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 'bold' } as React.CSSProperties,
  inputRow: { padding: 12, borderTop: '1px solid #2d2d4e', display: 'flex', gap: 8 } as React.CSSProperties,
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }
}

function isWaiting(status?: string): boolean {
  return !!(status && (status.includes('รอ') || status.includes('retry') || status.includes('ลองใหม่')))
}

export default function ChatPanel({ messages, onSend, onCancel, lastEvent, pendingCheckpoint, isRunning, demoMode, onToggleDemo }: Props) {
  const [input, setInput] = useState('')
  const [thinkingAgents, setThinkingAgents] = useState<Set<string>>(new Set())
  const [agentLog, setAgentLog] = useState<string[]>([])
  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, agentLog, thinkingAgents])

  useEffect(() => {
    if (!lastEvent) return
    const { type, agent, from, content } = lastEvent

    if (type === 'agent_thinking') {
      const name = agentIdToName(agent ?? '')
      setThinkingAgents(prev => new Set([...prev, name]))
      setAgentStatus(prev => ({ ...prev, [name]: 'กำลังเตรียม...' }))
    } else if (type === 'agent_status') {
      const name = agentIdToName(agent ?? '')
      setAgentStatus(prev => ({ ...prev, [name]: content ?? '' }))
    } else if (type === 'secretary_reply' || type === 'pipeline_cancelled') {
      setThinkingAgents(new Set())
      setAgentStatus({})
      if (type === 'pipeline_cancelled') {
        setAgentLog(prev => [...prev, '⛔ ยกเลิก pipeline แล้ว'].slice(-MAX_LOG))
      }
    } else if (type === 'user_checkpoint') {
      setThinkingAgents(new Set())
    } else if (type === 'pipeline_resumed') {
      setAgentLog(prev => [...prev, `▶ ${content ?? 'ดำเนินการต่อ'}`].slice(-MAX_LOG))
    } else if (type === 'agent_message') {
      const fromName = agentIdToName(from ?? '')
      const toName = agentIdToName(lastEvent.to ?? '')
      const preview = (content ?? '').slice(0, 80)
      setAgentLog(prev => [...prev, `[${fromName} → ${toName}]: ${preview}${preview.length >= 80 ? '...' : ''}`].slice(-MAX_LOG))
      if (from) {
        const name = agentIdToName(from)
        setThinkingAgents(prev => { const s = new Set(prev); s.delete(name); return s })
      }
    }
  }, [lastEvent])

  const handleSend = () => {
    if (!input.trim()) return
    if (!pendingCheckpoint) setAgentLog([])
    onSend(input.trim())
    setInput('')
  }

  const quickReply = (text: string) => { onSend(text); setInput('') }
  const isCheckpoint = lastEvent?.type === 'user_checkpoint'
  const thinkingList = [...thinkingAgents]

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={{ flex: 1 }}>
          <div style={styles.headerTitle}>🏢 Pixel Office</div>
          <div style={styles.headerSub}>AI Team — หัวหน้าคุณ</div>
        </div>
        <button onClick={onToggleDemo} title={demoMode ? 'ปิด Demo Mode' : 'เปิด Demo Mode'} style={styles.demoBtn(demoMode)}>
          {demoMode ? '⚡ Demo ON' : '⚡ Demo'}
        </button>
        {isRunning && !isCheckpoint && (
          <button onClick={onCancel} title="ยกเลิก pipeline" style={styles.cancelBtn}>⛔ ยกเลิก</button>
        )}
      </div>

      <div style={styles.messageList}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isUser ? 'flex-end' : 'flex-start' }}>
            <span style={{ fontSize: 10, color: AGENT_COLORS[msg.from] ?? '#94a3b8', marginBottom: 2 }}>{msg.from}</span>
            <div style={msg.isUser ? styles.msgUserBubble : styles.msgAgentBubble}>{msg.content}</div>
          </div>
        ))}

        {agentLog.length > 0 && (
          <div style={styles.agentLogSection}>
            {agentLog.map((log, i) => (
              <div key={i} style={{ fontSize: 10, marginBottom: 2, color: log.startsWith('▶') ? '#22d3ee' : log.startsWith('⛔') ? '#f87171' : '#475569' }}>
                {log}
              </div>
            ))}
          </div>
        )}

        {thinkingList.length > 0 && (
          <div style={styles.thinkingBox}>
            {thinkingList.map(name => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: isWaiting(agentStatus[name]) ? '#f59e0b' : '#22d3ee', animation: 'pulse 1.2s infinite' }} />
                <span style={{ color: AGENT_COLORS[name] ?? '#94a3b8', fontSize: 11, fontWeight: 'bold', minWidth: 28 }}>{name}</span>
                <span style={{ fontSize: 10, fontStyle: 'italic', color: isWaiting(agentStatus[name]) ? '#f59e0b' : '#64748b' }}>
                  {agentStatus[name] || 'กำลังทำงาน...'}
                </span>
              </div>
            ))}
          </div>
        )}

        {isCheckpoint && (
          <div style={styles.checkpointBox}>
            <div style={{ color: '#fbbf24', fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>🔔 รอการอนุมัติจากหัวหน้า</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => quickReply('ต่อ')} style={btnStyle('#15803d')}>✅ อนุมัติ / ต่อ</button>
              <button onClick={onCancel} style={btnStyle('#7f1d1d')}>⛔ ยกเลิก</button>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>หรือพิมพ์คำสั่งแก้ไขได้เลย</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={isCheckpoint ? 'พิมพ์คำสั่งแก้ไข หรือกด ✅ ด้านบน...' : 'พิมพ์ข้อความถึงฟ้า...'}
          style={styles.input(isCheckpoint)}
        />
        <button onClick={handleSend} style={styles.sendBtn(isCheckpoint)}>ส่ง</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatPanel.tsx
git commit -m "refactor: ChatPanel — remove duplicate maps, cap agentLog at 50, extract style objects"
```

---

## Task 15: Refactor `AgentDock.tsx`

**Files:**
- Modify: `client/src/components/AgentDock.tsx`

- [ ] **Step 1: Replace the entire file — remove duplicate constants, import from shared constants**

```tsx
import { useState } from 'react'
import { AGENT_ORDER, AGENT_META, AGENT_NAMES } from '../constants/agents'

export interface AgentState {
  id: string
  name: string
  color: string
  status: string
  statusType: 'idle' | 'thinking' | 'working' | 'waiting' | 'done' | 'cancelled'
  log: { time: string; text: string }[]
  lastTalkedTo?: string
}

const STATUS_LABEL: Record<AgentState['statusType'], string> = {
  idle:      'รอ',
  thinking:  'กำลังคิด',
  working:   'กำลังทำงาน',
  waiting:   'งานเยอะ รอสักครู่',
  done:      'เสร็จแล้ว',
  cancelled: 'ยกเลิก',
}

const cardStyles = {
  btn: (isSelected: boolean, color: string): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '8px 10px',
    background: isSelected ? '#1e293b' : 'transparent',
    border: `1px solid ${isSelected ? color : '#1e293b'}`,
    borderRadius: 10, cursor: 'pointer', minWidth: 90, maxWidth: 110,
    transition: 'all 0.2s',
    transform: isSelected ? 'translateY(-3px)' : 'none',
    boxShadow: isSelected ? `0 4px 16px ${color}40` : 'none',
  }),
  dot: (statusType: AgentState['statusType'], color: string): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: statusType === 'idle' ? '#334155'
      : statusType === 'done' ? '#22c55e'
      : statusType === 'waiting' ? '#f59e0b'
      : statusType === 'cancelled' ? '#ef4444'
      : color,
    boxShadow: statusType === 'thinking' ? `0 0 8px ${color}` : 'none',
    animation: statusType === 'thinking' ? 'agentPulse 1s ease-in-out infinite'
      : statusType === 'waiting' ? 'agentFlicker 0.6s ease-in-out infinite'
      : statusType === 'idle' ? 'agentBreath 3s ease-in-out infinite'
      : 'none',
  }),
  statusText: (statusType: AgentState['statusType']): React.CSSProperties => ({
    fontSize: 9,
    color: statusType === 'idle' ? '#475569'
      : statusType === 'waiting' ? '#f59e0b'
      : statusType === 'done' ? '#22c55e'
      : '#94a3b8',
    textAlign: 'center', lineHeight: 1.3,
    maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }),
}

const detailStyles = {
  container: (color: string, align: 'left' | 'center' | 'right'): React.CSSProperties => ({
    position: 'absolute', bottom: '100%',
    ...(align === 'left' ? { left: 0, transform: 'none' }
      : align === 'right' ? { right: 0, transform: 'none' }
      : { left: '50%', transform: 'translateX(-50%)' }),
    background: '#0f172a', border: `1px solid ${color}`,
    borderRadius: 12, padding: '12px 14px', zIndex: 100,
    minWidth: 260, maxWidth: 320,
    boxShadow: `0 -8px 32px ${color}30`,
    animation: `${align === 'center' ? 'slideUpCenter' : 'slideUpEdge'} 0.2s ease-out`,
  }),
  statusBox: { background: '#1e293b', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#e2e8f0' } as React.CSSProperties,
  logScroll: { maxHeight: 140, overflowY: 'auto' } as React.CSSProperties,
}

function AgentCard({ state, onClick, isSelected }: { state: AgentState; onClick: () => void; isSelected: boolean }) {
  const meta = AGENT_META[state.id as keyof typeof AGENT_META] ?? { color: '#64748b', role: '', emoji: '🤖' }
  const { statusType } = state

  return (
    <button onClick={onClick} style={cardStyles.btn(isSelected, meta.color)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
        <div style={cardStyles.dot(statusType, meta.color)} />
        <span style={{ color: meta.color, fontSize: 11, fontWeight: 'bold', flex: 1, textAlign: 'left' }}>{state.name}</span>
        <span style={{ fontSize: 12 }}>{meta.emoji}</span>
      </div>
      <div style={cardStyles.statusText(statusType)}>
        {statusType === 'thinking' || statusType === 'working'
          ? (state.status || STATUS_LABEL[statusType])
          : STATUS_LABEL[statusType]}
      </div>
    </button>
  )
}

function AgentDetail({ state, onClose, align }: { state: AgentState; onClose: () => void; align: 'left' | 'center' | 'right' }) {
  const meta = AGENT_META[state.id as keyof typeof AGENT_META] ?? { color: '#64748b', role: '', emoji: '🤖' }

  return (
    <div style={detailStyles.container(meta.color, align)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{meta.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: meta.color, fontWeight: 'bold', fontSize: 13 }}>{state.name}</div>
          <div style={{ color: '#64748b', fontSize: 10 }}>{meta.role}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      <div style={detailStyles.statusBox}>
        {state.status || 'ว่างอยู่'}
        {state.lastTalkedTo && (
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>→ คุยกับ {state.lastTalkedTo}</div>
        )}
      </div>

      <div style={detailStyles.logScroll}>
        {state.log.length === 0 && (
          <div style={{ color: '#334155', fontSize: 10, textAlign: 'center', padding: 8 }}>ยังไม่มีกิจกรรม</div>
        )}
        {[...state.log].reverse().map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
            <span style={{ color: '#334155', fontSize: 9, flexShrink: 0, marginTop: 1 }}>{entry.time}</span>
            <span style={{ color: '#64748b', fontSize: 10, lineHeight: 1.4 }}>{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  agentStates: Record<string, AgentState>
}

export function AgentDock({ agentStates }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <>
      <style>{`
        @keyframes agentPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.4)} }
        @keyframes agentFlicker { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes agentBreath { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.15);opacity:.7} }
        @keyframes slideUpCenter { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes slideUpEdge { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 6, padding: '8px 10px', background: '#070b14', borderTop: '1px solid #1e293b', position: 'relative' }}>
        {AGENT_ORDER.map((id, idx) => {
          const state = agentStates[id]
          if (!state) return null
          const total = AGENT_ORDER.length
          const align = idx <= 1 ? 'left' : idx >= total - 2 ? 'right' : 'center'
          return (
            <div key={id} style={{ position: 'relative' }}>
              {selectedId === id && (
                <AgentDetail state={state} onClose={() => setSelectedId(null)} align={align} />
              )}
              <AgentCard state={state} onClick={() => setSelectedId(prev => prev === id ? null : id)} isSelected={selectedId === id} />
            </div>
          )
        })}
      </div>
    </>
  )
}

export function createAgentStates(): Record<string, AgentState> {
  return Object.fromEntries(
    AGENT_ORDER.map(id => [id, {
      id,
      name: AGENT_NAMES[id],
      color: AGENT_META[id].color,
      status: '',
      statusType: 'idle' as const,
      log: [],
    }])
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/AgentDock.tsx
git commit -m "refactor: AgentDock — import from constants/agents, extract style objects"
```

---

## Task 16: Extract Styles from `SessionSidebar.tsx` and `ProjectPicker.tsx`

**Files:**
- Modify: `client/src/components/SessionSidebar.tsx`
- Modify: `client/src/components/ProjectPicker.tsx`

- [ ] **Step 1: Add style objects to `SessionSidebar.tsx`**

After the interface declarations and before the component function, add:

```ts
const styles = {
  root: { width: 200, background: '#070b14', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', fontSize: '11px', flexShrink: 0 } as React.CSSProperties,
  header: { padding: '12px 10px 8px', borderBottom: '1px solid #1e293b' } as React.CSSProperties,
  headerRow: { display: 'flex', alignItems: 'center', marginBottom: 8 } as React.CSSProperties,
  headerLabel: { color: '#475569', fontSize: '10px', flex: 1 } as React.CSSProperties,
  settingsBtn: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '13px', padding: '0 2px' } as React.CSSProperties,
  newBtn: { width: '100%', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontSize: '11px' } as React.CSSProperties,
  list: { flex: 1, overflowY: 'auto' } as React.CSSProperties,
  sessionItem: (isActive: boolean): React.CSSProperties => ({
    padding: '8px 10px', borderBottom: '1px solid #0f172a', cursor: 'pointer',
    background: isActive ? '#1e293b' : 'transparent',
    borderLeft: isActive ? '2px solid #60a5fa' : '2px solid transparent',
    display: 'flex', alignItems: 'flex-start', gap: 4,
  }),
  sessionTitle: (isActive: boolean): React.CSSProperties => ({
    color: isActive ? '#e2e8f0' : '#94a3b8',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2,
  }),
  sessionDate: { color: '#475569', fontSize: '10px' } as React.CSSProperties,
  deleteBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: 1, flexShrink: 0, marginTop: 1 } as React.CSSProperties,
  empty: { padding: 12, color: '#475569', textAlign: 'center' } as React.CSSProperties,
}
```

Then replace each inline style object in the JSX with the corresponding `styles.xxx` reference. For example:

```tsx
// Before
<div style={{ width: 200, background: '#070b14', ... }}>
// After
<div style={styles.root}>
```

Apply this pattern throughout the component for every inline style.

- [ ] **Step 2: Add style objects to `ProjectPicker.tsx`**

After the interface declaration, add:

```ts
const styles = {
  root: { padding: '8px 12px', background: '#0f172a', borderBottom: '1px solid #1e293b', fontSize: '11px' } as React.CSSProperties,
  label: { color: '#64748b', marginBottom: 6 } as React.CSSProperties,
  pathRow: { display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  pathText: { flex: 1, color: '#22d3ee', wordBreak: 'break-all', fontSize: '10px', lineHeight: 1.4 } as React.CSSProperties,
  changeBtn: { background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '10px', flexShrink: 0 } as React.CSSProperties,
  pickBtn: { width: '100%', background: '#1e293b', border: '1px dashed #334155', borderRadius: 6, color: '#64748b', padding: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 } as React.CSSProperties,
  error: { color: '#f87171', marginTop: 4, fontSize: '10px' } as React.CSSProperties,
}
```

Replace inline styles in the JSX with the corresponding `styles.xxx` references.

- [ ] **Step 3: Verify**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/SessionSidebar.tsx client/src/components/ProjectPicker.tsx
git commit -m "refactor: extract inline styles to named objects in SessionSidebar + ProjectPicker"
```

---

## Task 17: Run Final Benchmark + Regression Test

**Files:**
- Modify: `server/src/bench.ts` (update to run after changes)

- [ ] **Step 1: Run the benchmark and compare numbers**

```bash
cd server && npx tsx src/bench.ts
```

Record the output. Compare with Task 1 baseline:

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| `getActiveProvider()` × 100 | _(Task 1 value)_ ms | _(new value)_ ms | < 1 ms total |
| `listSessions()` | _(Task 1 value)_ ms | _(new value)_ ms | < 1 ms |
| Pipeline sleep overhead (non-demo) | 48,000 ms | 1,800 ms | ✅ |

Expected `getActiveProvider() × 100` after: `< 1.0 ms` (no disk reads, pure Map lookup).
Expected `listSessions()` after: `< 1.0 ms` (in-memory map, populated on first call).

- [ ] **Step 2: Run both server and client TypeScript check cleanly**

```bash
cd server && npx tsc --noEmit && echo "server OK"
cd ../client && npx tsc --noEmit && echo "client OK"
```
Expected: `server OK` then `client OK`

- [ ] **Step 3: Start both server and client**

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Open `http://localhost:5173` in the browser.

- [ ] **Step 4: Regression test — golden path**

Run each scenario and confirm it works:

1. **Happy path**: Type a message, press Enter → see secretary_reply ✅
2. **Checkpoint approve**: At checkpoint, type "ต่อ" → pipeline resumes ✅
3. **Checkpoint cancel**: At checkpoint, click ⛔ → pipeline_cancelled event ✅
4. **Demo mode**: Click ⚡ Demo → ON, send message → fast response without LLM ✅
5. **Demo mode off**: Click ⚡ Demo → OFF → confirm LLM is called ✅
6. **Add provider**: Open settings, add a provider, test connection ✅
7. **Activate provider**: Activate a different provider → next LLM call uses it ✅
8. **Session history**: Send a message, refresh page → session still appears in sidebar ✅
9. **Load session**: Click an old session → messages load correctly ✅
10. **New session**: Click "+ แชทใหม่" → clears chat ✅
11. **WS reconnect**: Stop server (`Ctrl+C`), wait 3s, restart server → client reconnects automatically (check browser console shows no dead state) ✅
12. **AgentDock**: Click each agent card → detail popup shows, click again to close ✅

- [ ] **Step 5: Write the benchmark report**

Create `docs/benchmark-results.md` with the before/after numbers from steps 1 above and the regression test results.

```bash
# After filling in actual numbers:
git add docs/benchmark-results.md
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: full overhaul complete — benchmark results in docs/benchmark-results.md"
```

---

## Spec Coverage Check

| Spec Section | Task |
|---|---|
| Shared types `shared/types.ts` | Task 2 |
| tsconfig + vite wiring | Task 2 |
| `secretary.ts` history singleton | Task 4 |
| `demo.ts` dead export | Task 5 |
| `orchestrator.ts` demo duplication | Task 9 |
| OpenAI client cache + `clearClientCache` | Task 6 |
| `providers.ts` in-memory cache | Task 7 |
| `sessions.ts` async I/O + in-memory map | Task 8 |
| `index.ts` async session calls | Task 8 |
| `sleep(8_000)` → `AGENT_SLEEP_MS` | Task 9 |
| Magic numbers → constants | Task 3, 9 |
| Agent factory | Task 10 |
| `client/src/constants/agents.ts` | Task 11 |
| `useAgentStates` stale closure | Task 12 |
| `useSocket` reconnect | Task 2 (bundled with useSocket rewrite) |
| `App.tsx` dynamic URL | Task 13 |
| `ChatPanel.tsx` dedupe + cap log + styles | Task 14 |
| `AgentDock.tsx` dedupe + styles | Task 15 |
| `SessionSidebar` + `ProjectPicker` styles | Task 16 |
| Benchmark baseline | Task 1 |
| Benchmark final + regression | Task 17 |
