import OpenAI from 'openai'
import 'dotenv/config'
import { getActiveProvider } from './providers.js'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type StatusFn = (msg: string) => void
let _statusFn: StatusFn | null = null
export function setStatusEmitter(fn: StatusFn | null) { _statusFn = fn }
function emitStatus(msg: string) { _statusFn?.(msg) }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function getClient(): { client: OpenAI; model: string } {
  const p = getActiveProvider()
  if (p?.apiKey) {
    return {
      client: new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey }),
      model: p.model,
    }
  }
  // fallback to env
  const baseURL = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL ?? 'moonshotai/kimi-k2.6'
  if (!baseURL || !apiKey) throw new Error('ไม่มี LLM provider ที่พร้อมใช้งาน')
  return { client: new OpenAI({ baseURL, apiKey }), model }
}

async function chatWithRetry(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxRetries = 5
): Promise<string> {
  let delay = 15_000

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
        delay = Math.min(delay * 1.5, 120_000)
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

// ทดสอบ connection
export async function testProvider(baseURL: string, apiKey: string, model: string): Promise<string> {
  const client = new OpenAI({ baseURL, apiKey })
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'ตอบว่า "ok" เท่านั้น' }],
    max_tokens: 10,
  })
  return res.choices[0]?.message.content ?? '(ไม่มีคำตอบ)'
}
