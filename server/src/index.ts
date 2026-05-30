import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import http from 'http'
import { handleUserMessage } from './orchestrator.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  console.log('[ws] client connected')

  ws.on('message', async (data) => {
    try {
      const { content } = JSON.parse(data.toString()) as { content: string }
      if (!content || typeof content !== 'string') {
        ws.send(JSON.stringify({ type: 'error', content: 'Invalid message format' }))
        return
      }
      await handleUserMessage(content, ws)
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', content: String(err) }))
    }
  })

  ws.on('close', () => console.log('[ws] client disconnected'))
})

const PORT = Number(process.env.PORT ?? 3001)
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
