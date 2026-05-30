import { chatJSON, type ChatMessage } from '../llm.js'
import type { AgentResponse } from './types.js'
import { listFiles, readFile, writeFile } from '../tools/fileSystem.js'
import { getProjectRoot } from '../project.js'

interface DevRawResponse {
  content: string
  tool_call?: { name: 'list_files' | 'read_file' | 'write_file'; args: Record<string, string> } | null
  next?: { to: string; message: string; type: string } | null
  done?: boolean
}

function buildSystem(fileList: string): string {
  return `คุณชื่อ เปา เป็น senior developer ของบริษัท
เชี่ยวชาญการเขียนโค้ด วางแผน architecture และแก้ปัญหาทางเทคนิค

${fileList ? `Project ปัจจุบัน:\n${fileList}\n` : 'ยังไม่ได้กำหนด project directory\n'}

Tools ที่ใช้ได้:
- list_files: { "path": "subdir" } — ดูไฟล์ใน directory
- read_file: { "path": "relative/path" } — อ่านไฟล์
- write_file: { "path": "relative/path", "content": "..." } — เขียนไฟล์

ตอบ JSON รูปแบบใดรูปแบบหนึ่ง:

ขอข้อมูลก่อน:
{ "content": "กำลังดูโครงสร้างโปรเจค...", "tool_call": { "name": "list_files", "args": { "path": "." } } }

เสร็จแล้ว ส่ง QA:
{ "content": "โค้ดหรือ plan ที่ทำ", "tool_call": null, "next": { "to": "qa", "message": "อธิบายให้ QA", "type": "handoff" }, "done": false }

หรือ done:
{ "content": "โค้ดหรือ plan", "tool_call": null, "next": null, "done": true }`
}

export async function devProcess(taskMessage: string): Promise<AgentResponse> {
  const root = getProjectRoot()
  let fileList = ''
  if (root) {
    try {
      const files = listFiles('.', 1)
      fileList = files.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`).join('\n')
    } catch { /* ignore */ }
  }

  const history: ChatMessage[] = [{ role: 'user', content: taskMessage }]

  for (let i = 0; i < 5; i++) {
    const raw = await chatJSON<DevRawResponse>(buildSystem(fileList), history)

    if (!raw.tool_call) {
      return {
        content: raw.content,
        next: raw.next as AgentResponse['next'],
        done: raw.done,
      }
    }

    let toolResult: string
    try {
      const { name, args } = raw.tool_call
      if (name === 'list_files') {
        const files = listFiles(args.path ?? '.', 2)
        toolResult = files.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`).join('\n')
      } else if (name === 'read_file') {
        toolResult = readFile(args.path)
      } else if (name === 'write_file') {
        writeFile(args.path, args.content)
        toolResult = `เขียนไฟล์ ${args.path} สำเร็จ`
      } else {
        toolResult = 'Unknown tool'
      }
    } catch (e: unknown) {
      toolResult = `Error: ${e instanceof Error ? e.message : String(e)}`
    }

    history.push({ role: 'assistant', content: JSON.stringify(raw) })
    history.push({ role: 'user', content: `Tool result:\n${toolResult}` })
  }

  return { content: 'หมด iteration ของ tool calls แล้ว', done: true }
}
