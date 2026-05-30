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
