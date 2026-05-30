import { WebSocket } from 'ws'

const TASK = 'อยากได้หน้า to-do list ธรรมดา เป็น HTML + JavaScript อย่างเดียว ไม่ต้อง framework เก็บข้อมูลใน localStorage ได้ ดีไซน์สวยนิดนึงก็ดี'

// checkpoint 1 (หลัง PM) → ต่อ
// checkpoint 2 (หลัง TL+Designer) → แก้ไข feedback
// checkpoint 3 (หลัง Dev) → ต่อ
const CHECKPOINT_REPLIES = [
  'ต่อ',
  'ขอให้มีปุ่มลบแต่ละ item และ filter กรองดูเฉพาะ done หรือ pending ด้วยนะ',
  'ต่อ',
]
let checkpointCount = 0

const log = []
const startTime = Date.now()

function ts() { return `+${((Date.now() - startTime) / 1000).toFixed(1)}s` }

const ws = new WebSocket('ws://localhost:3001/ws')

ws.on('open', () => {
  console.log(`[${ts()}] 🔌 connected — ส่ง task`)
  ws.send(JSON.stringify({ content: TASK }))
})

ws.on('message', (raw) => {
  const evt = JSON.parse(raw.toString())
  const t = ts()

  switch (evt.type) {
    case 'session_created':
      console.log(`[${t}] 📋 session: ${evt.sessionId}`)
      break

    case 'agent_thinking':
      log.push({ t, type: 'thinking', agent: evt.agent })
      process.stdout.write(`[${t}] 🤔 ${evt.agent} คิดอยู่...\n`)
      break

    case 'agent_move':
      log.push({ t, type: 'move', from: evt.from, to: evt.to })
      console.log(`[${t}] 🚶 ${evt.from} → ${evt.to}`)
      break

    case 'agent_message':
      log.push({ t, type: 'message', from: evt.from, to: evt.to })
      console.log(`[${t}] 💬 [${evt.from} → ${evt.to}]: ${(evt.content||'').slice(0,120)}...`)
      break

    case 'pipeline_resumed':
      console.log(`[${t}] ▶️  pipeline ต่อ`)
      break

    case 'user_checkpoint': {
      checkpointCount++
      const reply = CHECKPOINT_REPLIES[checkpointCount - 1] ?? 'ต่อ'
      log.push({ t, type: 'checkpoint', n: checkpointCount, reply })
      console.log(`\n[${t}] 🔔 ─── CHECKPOINT ${checkpointCount} ───`)
      console.log(`  สรุป: ${(evt.content||'').slice(0,200)}`)
      console.log(`  → ตอบ: "${reply}"\n`)
      setTimeout(() => {
        ws.send(JSON.stringify({ content: reply }))
      }, 500)
      break
    }

    case 'secretary_reply':
      log.push({ t, type: 'final_reply' })
      console.log(`\n[${t}] ✅ ─── ฟ้าสรุปผล ───`)
      console.log(evt.content)
      ws.close()
      break

    case 'error':
      console.error(`[${t}] ❌ error:`, evt.content)
      break
  }
})

ws.on('close', () => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`⏱  เวลารวม: ${elapsed}s`)

  // Parallel detection
  const thinkingEvents = log.filter(e => e.type === 'thinking')
  const agentTimes = {}
  thinkingEvents.forEach(e => { agentTimes[e.agent] = e.t })

  // ดู checkpoint ที่ใช้จริง
  console.log(`\n📋 Checkpoints: ${checkpointCount} ครั้ง`)
  log.filter(e => e.type === 'checkpoint').forEach(e => {
    console.log(`  CK${e.n}: "${e.reply.slice(0,60)}"`)
  })

  process.exit(0)
})

ws.on('error', (err) => {
  console.error('WS error:', err.message)
  process.exit(1)
})

// timeout 10 นาที — pipeline ทั้งหมดอาจนาน
setTimeout(() => {
  console.log('\n⏰ TIMEOUT 10 นาที')
  ws.close()
  process.exit(1)
}, 600_000)
