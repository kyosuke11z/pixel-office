import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import http from 'http'
import { readdirSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { handleUserMessage, resolveCheckpoint } from './orchestrator.js'
import { setProjectRoot, getProjectRoot } from './project.js'
import { createSession, listSessions, getSession, appendMessage } from './sessions.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
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
app.get('/api/sessions', (_req, res) => {
  res.json(listSessions())
})

app.post('/api/sessions', (_req, res) => {
  res.json(createSession())
})

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'ไม่พบ session' })
    return
  }
  res.json(session)
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  console.log('[ws] client connected')
  let currentSessionId: string | null = null

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as { content: string; sessionId?: string }
      const { content, sessionId } = parsed

      if (!content || typeof content !== 'string') {
        ws.send(JSON.stringify({ type: 'error', content: 'Invalid message format' }))
        return
      }

      // ถ้ามี checkpoint รอคำตอบ — route ไปที่นั้นก่อน
      if (resolveCheckpoint(ws, content)) return

      // ตั้ง session
      if (sessionId && getSession(sessionId)) {
        currentSessionId = sessionId
      }
      if (!currentSessionId) {
        const newSession = createSession()
        currentSessionId = newSession.id
        ws.send(JSON.stringify({ type: 'session_created', sessionId: currentSessionId }))
      }

      // บันทึก user message
      appendMessage(currentSessionId, {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      })

      // intercept send เพื่อ auto-save secretary_reply
      const sid = currentSessionId
      const origSend = ws.send.bind(ws)
      const patchedWs = Object.create(ws) as typeof ws
      patchedWs.send = (eventData: string) => {
        origSend(eventData)
        try {
          const evt = JSON.parse(eventData) as { type: string; content?: string }
          if (evt.type === 'secretary_reply' && evt.content) {
            appendMessage(sid, {
              role: 'assistant',
              content: evt.content,
              timestamp: new Date().toISOString(),
            })
          }
        } catch { /* ignore */ }
      }

      await handleUserMessage(content, patchedWs)
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', content: String(err) }))
    }
  })

  ws.on('close', () => console.log('[ws] client disconnected'))
})

const PORT = Number(process.env.PORT ?? 3001)
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
