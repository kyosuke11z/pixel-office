# Full Overhaul — Clean Code, Performance & Maintainability

**Date:** 2026-05-30
**Scope:** Server + Client + Shared types
**Approach:** C — Full Overhaul

---

## Goals

1. Fix all correctness bugs (history singleton, stale closure)
2. Measurable performance improvement (pipeline time, disk I/O, WS reconnect)
3. Single source of truth for shared constants and types
4. Agent factory pattern to eliminate duplicated agent boilerplate
5. Inline styles remain but extracted into named style objects per component

---

## Architecture

```
pixel-office/
├── shared/
│   └── types.ts              NEW — WsEvent, AgentId, WsEventType
├── server/src/
│   ├── agents/
│   │   ├── factory.ts        NEW — createSimpleAgent()
│   │   ├── characters.ts     unchanged
│   │   ├── secretary.ts      fix history singleton
│   │   ├── pm.ts             → config object only
│   │   ├── techlead.ts       → config object only
│   │   ├── designer.ts       → config object only
│   │   ├── qa.ts             → config object only
│   │   └── tester.ts         → config object only
│   ├── cache.ts              NEW — in-memory cache module
│   ├── constants.ts          NEW — AGENT_SLEEP_MS, RETRY_BASE_DELAY_MS
│   ├── llm.ts                add OpenAI client lazy singleton
│   ├── providers.ts          use in-memory cache
│   ├── sessions.ts           async I/O + in-memory map
│   ├── orchestrator.ts       remove sleep(8_000), unify demo logic
│   └── demo.ts               remove unused mockAgentCall
└── client/src/
    ├── constants/
    │   └── agents.ts         NEW — THINKING_MAP, AGENT_META, AGENT_ORDER
    ├── ws/
    │   └── useSocket.ts      add exponential backoff reconnect
    ├── hooks/
    │   └── useAgentStates.ts fix stale closure, use functional updates
    └── components/
        ├── AgentDock.tsx     remove duplicated constants, extract styles
        ├── ChatPanel.tsx     remove duplicated THINKING_MAP, cap agentLog
        ├── SessionSidebar.tsx extract styles
        ├── ProjectPicker.tsx  extract styles
        └── App.tsx           dynamic WS URL
```

---

## Section 1 — Shared Types (`shared/types.ts`)

Single source of truth for types used by both server and client.

**Contents:**
- `AgentId` union type
- `WsEventType` union type
- `WsEvent` interface

**tsconfig wiring:**
- `server/tsconfig.json` → `paths: { "shared/*": ["../../shared/*"] }`
- `client/tsconfig.app.json` → `paths: { "shared/*": ["../../shared/*"] }`
- `client/vite.config.ts` → `resolve.alias: { shared: path.resolve('../shared') }`

**Impact:** Eliminates duplicate `WsEvent` definitions in `client/src/ws/useSocket.ts` and `server/src/agents/types.ts`.

---

## Section 2 — Server Bug Fixes

### 2.1 `secretary.ts` — history singleton

**Problem:** `const history: ChatMessage[] = []` declared at module scope. Accumulates messages across every user across every session forever. Memory leak + wrong conversation context for second user.

**Fix:** Move `history` inside `secretaryDecide()`. Secretary starts each pipeline with a fresh context. The summarize call does not need history continuity.

```ts
// Before
const history: ChatMessage[] = []
export async function secretaryDecide(msg: string) {
  history.push(...)
}

// After
export async function secretaryDecide(msg: string) {
  const history: ChatMessage[] = [{ role: 'user', content: msg }]
  return chatJSON<AgentDecision>(DECIDE_SYSTEM, history)
}
```

### 2.2 `demo.ts` — dead export

**Problem:** `mockAgentCall` is exported but never imported anywhere. `orchestrator.ts` handles demo inline.

**Fix:** Delete `mockAgentCall`. Keep `isDemoMode`, `setDemoMode`, `MOCK_RESPONSES`.

### 2.3 `orchestrator.ts` — duplicated demo logic

**Problem:** `secretary_decide` handled with inline demo check in `handleUserMessage`, while all other agents use `withStatus`. Two different code paths.

**Fix:** Route `secretary_decide` through `withStatus` like every other agent.

---

## Section 3 — Server Performance

### 3.1 `orchestrator.ts` — remove `sleep(8_000)`

**Problem:** `sleep(isDemoMode() ? 500 : 8_000)` runs after every agent in non-demo mode. With 6 agent transitions, pipeline waits **48 seconds** purely on sleeps before any LLM work.

**Fix:** Replace with `sleep(AGENT_SLEEP_MS)` where `AGENT_SLEEP_MS = 300`. This gives the UI just enough time to render the status update.

**Expected improvement:** Pipeline overhead: 48s → ~2s.

### 3.2 `llm.ts` — OpenAI client cache

**Problem:** `getClient()` creates `new OpenAI({ baseURL, apiKey })` on every LLM call.

**Fix:** Lazy singleton. Cache the client keyed by `${baseURL}:${apiKey}`. Invalidate when active provider changes.

```ts
const clientCache = new Map<string, OpenAI>()

function getClient() {
  const p = getActiveProvider()
  const key = `${p.baseURL}:${p.apiKey}`
  if (!clientCache.has(key)) {
    clientCache.set(key, new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey }))
  }
  return { client: clientCache.get(key)!, model: p.model }
}
```

### 3.3 `providers.ts` — in-memory cache

**Problem:** Every call to `listProviders()`, `getActiveProvider()`, `addProvider()`, etc. calls `load()` which calls `readFileSync`. Under concurrent requests this means repeated synchronous disk reads.

**Fix:** Module-level `let _cache: Provider[] | null = null`. `load()` returns `_cache` if set. All mutating functions update `_cache` before writing to disk.

**Cross-module dependency:** `activateProvider()` must also call `clearClientCache()` exported from `llm.ts` so the next LLM call picks up the new active provider's credentials. `llm.ts` exports `export function clearClientCache() { clientCache.clear() }`.

### 3.4 `sessions.ts` — async I/O + in-memory map

**Problem:** `readFileSync`/`writeFileSync` blocks the event loop. `listSessions()` reads every `.json` file on every HTTP call.

**Fix:**
- Replace all sync I/O with `fs/promises` (`readFile`, `writeFile`)
- Module-level `Map<string, Session>` populated on first `listSessions()` call (lazy load all sessions once)
- `appendMessage`, `createSession`, `deleteSession` update the map first, then write to disk async (write-behind). Write errors are `console.error` only — they do not fail the in-memory operation.
- `listSessions()` reads from memory map, O(1)
- All public functions become `async` — callers in `index.ts` need `await`

---

## Section 4 — Server Maintainability

### 4.1 Agent factory (`agents/factory.ts`)

**Problem:** `pm.ts`, `techlead.ts`, `designer.ts`, `qa.ts`, `tester.ts` all follow the exact same pattern: define a SYSTEM prompt string, call `chatJSON<AgentResponse>`, return the result.

**Fix:** `createSimpleAgent(config)` factory.

```ts
interface SimpleAgentConfig {
  characterId: string
  systemBody: string   // the prompt content before characterPrompt
}

export function createSimpleAgent(config: SimpleAgentConfig) {
  const system = `${config.systemBody}\n\n${characterPrompt(config.characterId)}\n\nตอบ JSON...`
  return async function process(message: string): Promise<AgentResponse> {
    return chatJSON<AgentResponse>(system, [{ role: 'user', content: message }])
  }
}
```

Each agent file becomes:
```ts
// pm.ts — 8 lines instead of 27
import { createSimpleAgent } from './factory.js'
export const pmProcess = createSimpleAgent({ characterId: 'pm', systemBody: `...` })
```

**Note:** `dev.ts` is excluded from the factory — it has a 5-iteration tool-calling loop that doesn't fit `createSimpleAgent`. It stays as its own file unchanged.

### 4.2 `server/src/constants.ts`

Extract all magic numbers:
```ts
export const AGENT_SLEEP_MS = 300
export const DEMO_SLEEP_MS = 500
export const RETRY_BASE_DELAY_MS = 15_000
export const RETRY_MAX_DELAY_MS = 120_000
export const MAX_RETRIES = 5
export const AGENT_MESSAGE_PREVIEW_LEN = 200
```

---

## Section 5 — Client Bug Fixes

### 5.1 `useAgentStates.ts` — stale closure

**Problem:** `handleEvent` closes over `states` in its dependency array. When the callback fires, it reads from the captured (potentially stale) snapshot of `states`. Log entries can be dropped.

**Fix:** All state reads inside `handleEvent` must use functional `setStates(prev => ...)` form. Remove `states` from the `useCallback` dependency array entirely.

```ts
// Before — reads stale states[agent]
update(agent, {
  log: addLog(states[agent]?.log ?? [], 'เริ่มคิด...')
})

// After — reads fresh prev inside functional update
setStates(prev => {
  const agent_state = prev[agent]
  if (!agent_state) return prev
  return { ...prev, [agent]: { ...agent_state, statusType: 'thinking', log: addLog(agent_state.log, 'เริ่มคิด...') } }
})
```

### 5.2 `App.tsx` — dynamic WS URL

**Problem:** `ws://localhost:3001/ws` hardcoded — breaks in any non-local environment.

**Fix:**
```ts
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001/ws`
```

---

## Section 6 — Client Performance

### 6.1 `useSocket.ts` — exponential backoff reconnect

**Problem:** No reconnect logic. Server restart = dead client until page reload.

**Fix:** On `ws.onclose`, schedule reconnect with exponential backoff: 1s → 2s → 4s → 8s → ... → max 30s. Reset delay on successful open.

```ts
let retryDelay = 1000
function connect() {
  const ws = new WebSocket(url)
  ws.onopen = () => { retryDelay = 1000; setConnected(true) }
  ws.onclose = () => { setConnected(false); setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30_000) }
}
```

### 6.2 `ChatPanel.tsx` — cap agentLog

**Problem:** `agentLog` array grows unbounded for the lifetime of the tab.

**Fix:** `setAgentLog(prev => [...prev, entry].slice(-50))`

---

## Section 7 — Client Maintainability

### 7.1 `client/src/constants/agents.ts` — single source of truth

All agent metadata in one file. Remove duplicates from every component.

```ts
export const AGENT_IDS = ['secretary','pm','techlead','designer','dev','qa','tester'] as const
export type AgentId = typeof AGENT_IDS[number]

export const AGENT_NAMES: Record<AgentId, string> = {
  secretary:'ฟ้า', pm:'อิง', techlead:'ต้น',
  designer:'แนน', dev:'เปา', qa:'มิ้น', tester:'โบ้ท',
}

export const AGENT_META: Record<AgentId, { color: string; role: string; emoji: string }> = { ... }

export const AGENT_COLORS: Record<string, string> = { ... }
```

Files that currently duplicate this: `ChatPanel.tsx` (THINKING_MAP + AGENT_COLORS), `useAgentStates.ts` (THINKING_MAP), `AgentDock.tsx` (AGENT_META + AGENT_ORDER + name map in createAgentStates).

### 7.2 Extract inline styles per component

Each component file gets a `const styles = { ... }` object at the top. JSX references `styles.xxx` instead of object literals inline.

Example — `ChatPanel.tsx`:
```ts
const styles = {
  root: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f23', ... },
  header: { padding: '10px 14px', borderBottom: '1px solid #2d2d4e', ... },
  messageList: { flex: 1, overflowY: 'auto', padding: 12, ... },
} satisfies Record<string, React.CSSProperties>
```

---

## Section 8 — Benchmark & Testing Plan

### Before Measurement (run before any changes)

Add a timing script `server/src/bench.ts`:
- Pipeline time: run `handleUserMessage` in demo mode, measure ms from call to `secretary_reply` event
- Provider load: call `getActiveProvider()` 100×, measure total ms
- Session list: call `listSessions()` with 10 sessions present, measure ms

Record results as "Before" baseline.

### After Measurement (run after all changes)

Run same script. Report:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Pipeline time (demo, full run) | ~48,000ms | < 5,000ms | −90%+ |
| `getActiveProvider()` × 100 | ~100 disk reads | 0 disk reads | −100% |
| `listSessions()` (10 sessions) | 10 disk reads | 0 disk reads | −100% |
| WS reconnect after restart | ❌ dead | ✅ < 5s | fixed |
| Stale log entries | occasional drops | never drops | fixed |

### Regression Test Checklist

Run the live app and verify each scenario:

1. Send message → `secretary_reply` received ✅
2. Checkpoint → type "ต่อ" → pipeline resumes ✅
3. Checkpoint → click ⛔ → pipeline cancels ✅
4. Demo mode ON → pipeline runs fast without LLM ✅
5. Demo mode OFF → LLM called normally ✅
6. Add provider → test connection → activate ✅
7. Delete active provider → fallback activates ✅
8. Select old session → messages load ✅
9. New session → clears messages ✅
10. Kill server → restart → client reconnects auto ✅
11. Send message after reconnect → works ✅

---

## Out of Scope

- CSS modules / Tailwind (inline style approach kept per decision)
- Changing game engine (Phaser layer untouched)
- Changing agent pipeline order or checkpoints
- Database migration (file-based sessions kept)
