// server/src/llm.ts
import OpenAI from 'openai'
import 'dotenv/config'

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL!,
  apiKey: process.env.LLM_API_KEY!,
})

const model = process.env.LLM_MODEL ?? 'moonshotai/kimi-k2.6'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(
  systemPrompt: string,
  history: ChatMessage[]
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
    ],
  })
  return response.choices[0].message.content ?? ''
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
  return JSON.parse(cleaned) as T
}
