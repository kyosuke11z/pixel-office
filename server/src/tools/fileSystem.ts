import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'
import { getProjectRoot } from '../project.js'

function safe(rawPath: string): string {
  const root = getProjectRoot()
  if (!root) throw new Error('ยังไม่ได้ตั้ง project directory')
  const abs = resolve(root, rawPath)
  if (!abs.startsWith(root)) throw new Error(`Path ${rawPath} อยู่นอก project directory`)
  return abs
}

export interface FileEntry { name: string; type: 'file' | 'dir'; path: string }

export function listFiles(dir = '.', maxDepth = 2): FileEntry[] {
  function walk(absDir: string, depth: number): FileEntry[] {
    if (depth > maxDepth) return []
    const root = getProjectRoot()!
    return readdirSync(absDir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .flatMap(e => {
        const rel = relative(root, join(absDir, e.name))
        const entry: FileEntry = { name: e.name, type: e.isDirectory() ? 'dir' : 'file', path: rel }
        return e.isDirectory() ? [entry, ...walk(join(absDir, e.name), depth + 1)] : [entry]
      })
  }
  return walk(safe(dir), 0)
}

export function readFile(filePath: string): string {
  const abs = safe(filePath)
  const size = statSync(abs).size
  if (size > 100_000) throw new Error(`ไฟล์ใหญ่เกิน 100KB: ${filePath}`)
  return readFileSync(abs, 'utf8')
}

export function writeFile(filePath: string, content: string): void {
  const abs = safe(filePath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}
