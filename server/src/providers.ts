import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { clearClientCache } from './llm.js'

const DATA_DIR = join(process.cwd(), 'data')
const FILE = join(DATA_DIR, 'providers.json')

export interface Provider {
  id: string
  name: string
  baseURL: string
  apiKey: string
  model: string
  isActive: boolean
}

let _cache: Provider[] | null = null

function load(): Provider[] {
  if (_cache) return _cache
  if (!existsSync(FILE)) { _cache = defaultProviders(); return _cache }
  try {
    _cache = JSON.parse(readFileSync(FILE, 'utf8')) as Provider[]
    return _cache
  } catch {
    _cache = defaultProviders()
    return _cache
  }
}

function save(providers: Provider[]) {
  _cache = providers
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(providers, null, 2), 'utf8')
}

function defaultProviders(): Provider[] {
  const list: Provider[] = [
    {
      id: randomUUID(),
      name: 'Kimi K2.6 (maxplus)',
      baseURL: process.env.LLM_BASE_URL ?? 'https://api.maxplus-ai.cc/kimi/v1',
      apiKey: process.env.LLM_API_KEY ?? '',
      model: 'moonshotai/kimi-k2.6',
      isActive: true,
    },
    {
      id: randomUUID(),
      name: 'Moonshot Official',
      baseURL: 'https://api.moonshot.cn/v1',
      apiKey: '',
      model: 'moonshot-v1-8k',
      isActive: false,
    },
    {
      id: randomUUID(),
      name: 'Groq (llama-3.3-70b)',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: '',
      model: 'llama-3.3-70b-versatile',
      isActive: false,
    },
    {
      id: randomUUID(),
      name: 'DeepSeek Chat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
      isActive: false,
    },
  ]
  save(list)
  return list
}

export function listProviders(): Provider[] {
  return load()
}

export function getActiveProvider(): Provider | null {
  return load().find(p => p.isActive) ?? null
}

export function addProvider(data: Omit<Provider, 'id' | 'isActive'>): Provider {
  const providers = load()
  const p: Provider = { ...data, id: randomUUID(), isActive: false }
  providers.push(p)
  save(providers)
  return p
}

export function activateProvider(id: string): Provider | null {
  const providers = load()
  const target = providers.find(p => p.id === id)
  if (!target) return null
  providers.forEach(p => { p.isActive = p.id === id })
  save(providers)
  clearClientCache()
  return target
}

export function deleteProvider(id: string): boolean {
  const providers = load()
  const idx = providers.findIndex(p => p.id === id)
  if (idx === -1) return false
  providers.splice(idx, 1)
  if (providers.length > 0 && !providers.some(p => p.isActive)) {
    providers[0].isActive = true
  }
  save(providers)
  clearClientCache()
  return true
}

export function updateProvider(id: string, data: Partial<Omit<Provider, 'id' | 'isActive'>>): Provider | null {
  const providers = load()
  const p = providers.find(p => p.id === id)
  if (!p) return null
  Object.assign(p, data)
  save(providers)
  clearClientCache()
  return p
}
