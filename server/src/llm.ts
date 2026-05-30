import OpenAI from 'openai'
import 'dotenv/config'

if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY) {
  throw new Error('Missing required env vars: LLM_BASE_URL, LLM_API_KEY')
}

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
})

const model = process.env.LLM_MODEL ?? 'moonshotai/kimi-k2.6'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function chatWithRetry(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxRetries = 5
): Promise<string> {
  let delay = 15_000 // เริ่มที่ 15 วินาทีเมื่อโดน rate limit

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({ model, messages })
      const content = response.choices[0]?.message.content
      // บางครั้ง Kimi ส่ง content = null กลับมา ให้ retry
      if (!content) {
        console.warn(`[llm] attempt ${attempt + 1}: empty content, retrying...`)
        await sleep(5_000)
        continue
      }
      return content
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit')
      const is5xx = msg.includes('500') || msg.includes('502') || msg.includes('503')

      if ((is429 || is5xx) && attempt < maxRetries) {
        console.warn(`[llm] attempt ${attempt + 1} failed (${is429 ? 'rate limit' : 'server error'}), waiting ${delay / 1000}s...`)
        await sleep(delay)
        delay = Math.min(delay * 1.5, 120_000) // exponential backoff สูงสุด 2 นาที
        continue
      }
      throw err
    }
  }
  throw new Error('LLM: เกิน max retries')
}

export async function chat(
  systemPrompt: string,
  history: ChatMessage[]
): Promise<string> {
  return chatWithRetry([
    { role: 'system', content: systemPrompt },
    ...history,
  ])
}

export async function chatJSON<T>(
  systemPrompt: string,
  history: ChatMessage[]
): Promise<T> {
  const raw = await chat(
    systemPrompt + '\n\nตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น',
    history
  )
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    throw new Error(`Invalid JSON response: ${cleaned.slice(0, 200)}`, { cause: error })
  }
}
