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
app.get('/api/sessions', (_req, res) => {
  res.json(listSessions())
})

app.post('/api/sessions', (_req, res) => {
  res.json(createSession())
})

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id)
  if (!session) { res.status(404).json({ error: 'ไม่พบ session' }); return }
  res.json(session)
})

app.delete('/api/sessions/:id', (req, res) => {
  const ok = deleteSession(req.params.id)
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

      // handle cancel message ก่อน
      if (parsed.type === 'cancel') {
        cancelPipeline(ws)
        return
      }

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

      // register hook เพื่อ auto-save secretary_reply (ใช้ ws จริง ไม่ใช่ patchedWs)
      const sid = currentSessionId
      registerReplyHook(ws, (replyContent) => {
        appendMessage(sid, {
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
