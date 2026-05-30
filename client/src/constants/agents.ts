// client/src/constants/agents.ts
export const AGENT_ORDER = ['secretary', 'pm', 'techlead', 'designer', 'dev', 'qa', 'tester'] as const
export type AgentKey = typeof AGENT_ORDER[number]

export const AGENT_NAMES: Record<AgentKey, string> = {
  secretary: 'ฟ้า',
  pm:        'อิง',
  techlead:  'ต้น',
  designer:  'แนน',
  dev:       'เปา',
  qa:        'มิ้น',
  tester:    'โบ้ท',
}

export const AGENT_META: Record<AgentKey, { color: string; role: string; emoji: string }> = {
  secretary: { color: '#7c3aed', role: 'Secretary',   emoji: '📋' },
  pm:        { color: '#be185d', role: 'PM',           emoji: '📊' },
  techlead:  { color: '#1d4ed8', role: 'Tech Lead',    emoji: '🏗️' },
  designer:  { color: '#b91c1c', role: 'Designer',     emoji: '🎨' },
  dev:       { color: '#1d4ed8', role: 'Developer',    emoji: '💻' },
  qa:        { color: '#065f46', role: 'QA Engineer',  emoji: '🔍' },
  tester:    { color: '#c2410c', role: 'Tester',       emoji: '🧪' },
}

export const AGENT_COLORS: Record<string, string> = {
  ฟ้า: '#a78bfa',
  อิง: '#f472b6',
  ต้น: '#38bdf8',
  แนน: '#fb7185',
  เปา: '#60a5fa',
  มิ้น: '#34d399',
  โบ้ท: '#fb923c',
  คุณ: '#f9fafb',
}

export function agentIdToName(id: string): string {
  return AGENT_NAMES[id as AgentKey] ?? id
}
