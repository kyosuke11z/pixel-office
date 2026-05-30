import Phaser from 'phaser'
import { AgentSprite, type AgentConfig } from './AgentSprite'
import { SpeechBubble } from './SpeechBubble'

// 7 agents — positions in 640×480 reference space
const AGENT_CONFIGS: AgentConfig[] = [
  { id: 'secretary', name: 'ฟ้า',  textureKey: 'char-secretary', x: 320, y: 75  },
  { id: 'pm',        name: 'อิง',  textureKey: 'char-pm',        x: 120, y: 185 },
  { id: 'techlead',  name: 'ต้น',  textureKey: 'char-techlead',  x: 320, y: 185 },
  { id: 'designer',  name: 'แนน',  textureKey: 'char-designer',  x: 520, y: 185 },
  { id: 'dev',       name: 'เปา',  textureKey: 'char-dev',       x: 120, y: 320 },
  { id: 'qa',        name: 'มิ้น', textureKey: 'char-qa',        x: 520, y: 320 },
  { id: 'tester',    name: 'โบ้ท', textureKey: 'char-tester',    x: 320, y: 400 },
]

const CHAR_KEYS = AGENT_CONFIGS.map(c => c.textureKey)

const CHAR_FILES: Record<string, string> = {
  'char-secretary': '/assets/characters/Female/Female 01-1.png',
  'char-pm':        '/assets/characters/Female/Female 03-1.png',
  'char-techlead':  '/assets/characters/Male/Male 03-1.png',
  'char-designer':  '/assets/characters/Female/Female 04-1.png',
  'char-dev':       '/assets/characters/Male/Male 01-1.png',
  'char-qa':        '/assets/characters/Female/Female 02-1.png',
  'char-tester':    '/assets/characters/Male/Male 02-1.png',
}

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, AgentSprite> = new Map()
  private bubble!: SpeechBubble

  constructor() {
    super({ key: 'OfficeScene' })
  }

  preload() {
    CHAR_KEYS.forEach(key => {
      this.load.spritesheet(key, CHAR_FILES[key], { frameWidth: 32, frameHeight: 32 })
    })
    // tileset-interior ไม่ใช้แล้ว — ใช้ Phaser Graphics แทน
  }

  create() {
    this.createAnimations()
    this.createRoom()
    this.createFurniture()
    this.createAgents()
    this.bubble = new SpeechBubble(this)
  }

  private createAnimations() {
    CHAR_KEYS.forEach(key => {
      if (this.anims.exists(`${key}-idle`)) return
      this.anims.create({ key: `${key}-idle`,       frames: [{ key, frame: 1 }],                                        frameRate: 1, repeat: -1 })
      this.anims.create({ key: `${key}-walk-down`,  frames: this.anims.generateFrameNumbers(key, { start: 0, end: 2 }), frameRate: 8, repeat: -1 })
      this.anims.create({ key: `${key}-walk-left`,  frames: this.anims.generateFrameNumbers(key, { start: 3, end: 5 }), frameRate: 8, repeat: -1 })
      this.anims.create({ key: `${key}-walk-right`, frames: this.anims.generateFrameNumbers(key, { start: 6, end: 8 }), frameRate: 8, repeat: -1 })
      this.anims.create({ key: `${key}-walk-up`,    frames: this.anims.generateFrameNumbers(key, { start: 9, end: 11}), frameRate: 8, repeat: -1 })
    })
  }

  private createRoom() {
    const W = this.scale.width
    const H = this.scale.height
    const WALL = 28

    // ── พื้น ──────────────────────────────────────────────────────────────────
    const floor = this.add.graphics().setDepth(0)
    const PLANK = 36
    for (let y = WALL; y < H - WALL; y += PLANK) {
      const even = Math.floor((y - WALL) / PLANK) % 2 === 0
      floor.fillStyle(even ? 0x8a6640 : 0x7a5835, 1)
      floor.fillRect(WALL, y, W - WALL * 2, Math.min(PLANK, H - WALL - y))
    }
    // เส้นแบ่ง plank
    floor.lineStyle(1, 0x5c3d20, 0.35)
    for (let y = WALL + PLANK; y < H - WALL; y += PLANK) {
      floor.lineBetween(WALL, y, W - WALL, y)
    }
    // เส้นตาม (ทุก 80px)
    for (let x = WALL + 80; x < W - WALL; x += 80) {
      floor.lineBetween(x, WALL, x, H - WALL)
    }

    // ── กำแพง ────────────────────────────────────────────────────────────────
    const walls = this.add.graphics().setDepth(1)
    walls.fillStyle(0x2d1f0e, 1)
    walls.fillRect(0, 0, W, WALL)         // บน
    walls.fillRect(0, H - WALL, W, WALL)  // ล่าง
    walls.fillRect(0, 0, WALL, H)         // ซ้าย
    walls.fillRect(W - WALL, 0, WALL, H)  // ขวา
    // highlight บนกำแพง
    walls.fillStyle(0xb08050, 1)
    walls.fillRect(WALL, WALL - 5, W - WALL * 2, 5)
    // มุม
    walls.fillStyle(0x1a0f05, 1)
    for (const [x, y] of [[0,0],[W-WALL,0],[0,H-WALL],[W-WALL,H-WALL]] as [number,number][]) {
      walls.fillRect(x, y, WALL, WALL)
    }

    // ── เส้นแบ่ง zone ────────────────────────────────────────────────────────
    const divider = this.add.graphics().setDepth(2)
    divider.lineStyle(1, 0x4a3020, 0.6)
    divider.lineBetween(WALL + 20, 248, W - WALL - 20, 248)

    // Zone labels
    this.add.text(W / 2, 140, 'Management', {
      fontSize: '9px', color: '#6b4a2a',
    }).setOrigin(0.5).setDepth(2)
    this.add.text(W / 2, 285, 'Engineering', {
      fontSize: '9px', color: '#6b4a2a',
    }).setOrigin(0.5).setDepth(2)
  }

  private createFurniture() {
    const W = this.scale.width
    const H = this.scale.height
    const scaleX = W / 640
    const scaleY = H / 480

    // positions ใน reference space 640x480:
    const AGENT_POSITIONS = [
      { id: 'secretary', x: 320, y: 75,  color: 0x4c1d95 }, // ม่วง
      { id: 'pm',        x: 120, y: 185, color: 0x831843 }, // ชมพูเข้ม
      { id: 'techlead',  x: 320, y: 185, color: 0x1e3a5f }, // น้ำเงินเข้ม
      { id: 'designer',  x: 520, y: 185, color: 0x7f1d1d }, // แดงเข้ม
      { id: 'dev',       x: 120, y: 320, color: 0x1e3a5f }, // น้ำเงิน
      { id: 'qa',        x: 520, y: 320, color: 0x064e3b }, // เขียวเข้ม
      { id: 'tester',    x: 320, y: 400, color: 0x7c2d12 }, // ส้มเข้ม
    ]

    const gfx = this.add.graphics().setDepth(2)

    AGENT_POSITIONS.forEach(({ x, y, color }) => {
      const dx = Math.round(x * scaleX)
      const dy = Math.round(y * scaleY)
      const dw = 72  // ความกว้างโต๊ะ
      const dh = 20  // ความสูงโต๊ะ

      // เงาโต๊ะ
      gfx.fillStyle(0x000000, 0.25)
      gfx.fillRoundedRect(dx - dw/2 + 2, dy + 14, dw, dh, 3)

      // โต๊ะ
      gfx.fillStyle(color, 0.85)
      gfx.fillRoundedRect(dx - dw/2, dy + 12, dw, dh, 3)

      // highlight บนโต๊ะ
      gfx.fillStyle(0xffffff, 0.08)
      gfx.fillRoundedRect(dx - dw/2 + 2, dy + 12, dw - 4, 4, 2)

      // จอคอม (สี่เหลี่ยมเล็กบนโต๊ะ)
      gfx.fillStyle(0x0f172a, 0.9)
      gfx.fillRoundedRect(dx - 12, dy - 4, 24, 16, 2)
      gfx.fillStyle(0x1d4ed8, 0.6)
      gfx.fillRect(dx - 10, dy - 2, 20, 11)

      // ขาโต๊ะ
      gfx.fillStyle(color, 0.6)
      gfx.fillRect(dx - dw/2 + 8, dy + 32, 4, 6)
      gfx.fillRect(dx + dw/2 - 12, dy + 32, 4, 6)
    })
  }

  private createAgents() {
    const W = this.scale.width
    const H = this.scale.height
    const scaleX = W / 640
    const scaleY = H / 480

    for (const cfg of AGENT_CONFIGS) {
      const scaled: AgentConfig = {
        ...cfg,
        x: Math.round(cfg.x * scaleX),
        y: Math.round(cfg.y * scaleY),
      }
      this.agents.set(cfg.id, new AgentSprite(this, scaled))
    }
  }

  handleEvent(event: {
    type: string
    agent?: string
    from?: string
    to?: string
    content?: string
  }) {
    switch (event.type) {
      case 'agent_thinking': {
        const agent = this.agents.get(event.agent ?? '')
        if (agent) {
          agent.flash()
          this.bubble.showThinking(agent.homeX, agent.homeY - 20)
        }
        break
      }
      case 'agent_move': {
        const fromAgent = this.agents.get(event.from ?? '')
        const toAgent = this.agents.get(event.to ?? '')
        if (fromAgent && toAgent) {
          this.bubble.hide()
          const fromName = fromAgent.config.name
          fromAgent.moveTo(toAgent.homeX - 36, toAgent.homeY, () => {
            this.bubble.show(toAgent.homeX, toAgent.homeY - 20, `📨 ${fromName} ส่งงานมา`)
            this.time.delayedCall(1200, () => {
              fromAgent.returnHome()
              this.bubble.hide()
            })
          })
        }
        break
      }
      case 'agent_message': {
        const fromAgent = this.agents.get(event.from ?? '')
        const toAgent = this.agents.get(event.to ?? '')
        if (fromAgent && event.content) {
          // แสดง excerpt จริงของงานที่ส่ง
          const excerpt = event.content.replace(/#+\s*/g, '').replace(/\*+/g, '').trim().slice(0, 55)
          const target = toAgent ?? fromAgent
          this.bubble.show(target.homeX, target.homeY - 20, excerpt + (event.content.length > 55 ? '…' : ''))
          this.time.delayedCall(3500, () => this.bubble.hide())
        }
        break
      }
      case 'agent_status': {
        const agent = this.agents.get(event.agent ?? '')
        if (agent && event.content && !event.content.includes('เสร็จแล้ว')) {
          agent.flash()
        }
        break
      }
      case 'user_checkpoint': {
        const secretary = this.agents.get('secretary')
        if (secretary) {
          secretary.flash()
          this.bubble.show(secretary.homeX, secretary.homeY - 20, '🔔 รอ approval คุณหัวหน้า')
        }
        break
      }
      case 'pipeline_cancelled': {
        this.bubble.hide()
        const secretary = this.agents.get('secretary')
        if (secretary) {
          this.bubble.show(secretary.homeX, secretary.homeY - 20, '⛔ ยกเลิกแล้วค่ะ')
          this.time.delayedCall(2000, () => this.bubble.hide())
        }
        break
      }
      case 'pipeline_resumed': {
        this.bubble.hide()
        break
      }
      case 'secretary_reply': {
        const secretary = this.agents.get('secretary')
        if (secretary) {
          this.bubble.show(secretary.homeX, secretary.homeY - 20, '✅ สรุปให้หัวหน้าแล้วค่ะ')
          this.time.delayedCall(3000, () => this.bubble.hide())
        }
        break
      }
    }
  }
}
