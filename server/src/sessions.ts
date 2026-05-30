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
