import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
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

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function sessionPath(id: string) {
  return join(DATA_DIR, `${id}.json`)
}

export function createSession(): Session {
  ensureDir()
  const now = new Date().toISOString()
  const session: Session = {
    id: randomUUID(),
    title: 'แชทใหม่',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
  writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf8')
  return session
}

export function listSessions(): Omit<Session, 'messages'>[] {
  ensureDir()
  return readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const s: Session = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'))
      const { messages: _m, ...meta } = s
      return meta
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getSession(id: string): Session | null {
  const p = sessionPath(id)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

export function appendMessage(id: string, msg: SessionMessage): void {
  const session = getSession(id)
  if (!session) return
  session.messages.push(msg)
  session.updatedAt = new Date().toISOString()
  if (session.title === 'แชทใหม่' && msg.role === 'user') {
    session.title = msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : '')
  }
  writeFileSync(sessionPath(id), JSON.stringify(session, null, 2), 'utf8')
}
