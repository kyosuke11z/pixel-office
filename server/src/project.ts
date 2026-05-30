import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

let projectRoot: string | null = null

export function getProjectRoot(): string | null {
  return projectRoot
}

export function setProjectRoot(rawPath: string): { ok: boolean; error?: string } {
  const absPath = resolve(rawPath)
  if (!existsSync(absPath)) return { ok: false, error: `Path ไม่มีอยู่: ${absPath}` }
  if (!statSync(absPath).isDirectory()) return { ok: false, error: `ไม่ใช่ directory: ${absPath}` }
  projectRoot = absPath
  return { ok: true }
}
