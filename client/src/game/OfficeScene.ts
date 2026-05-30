import Phaser from 'phaser'
import { AgentSprite, type AgentConfig } from './AgentSprite'
import { SpeechBubble } from './SpeechBubble'

const AGENT_CONFIGS: AgentConfig[] = [
  { id: 'secretary', name: 'ฟ้า', textureKey: 'char-secretary', x: 320, y: 110 },
  { id: 'dev',       name: 'เปา', textureKey: 'char-dev',       x: 160, y: 240 },
  { id: 'qa',        name: 'มิ้น', textureKey: 'char-qa',       x: 480, y: 240 },
  { id: 'tester',    name: 'โบ้ท', textureKey: 'char-tester',   x: 320, y: 360 },
]

const CHAR_KEYS = [
  'char-secretary',
  'char-dev',
  'char-qa',
  'char-tester',
] as const

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, AgentSprite> = new Map()
  private bubble!: SpeechBubble

  constructor() {
    super({ key: 'OfficeScene' })
  }

  preload() {
    // Character spritesheets (PIPOYA 32x32, 96x128 per file = 3 cols × 4 rows)
    this.load.spritesheet('char-secretary', '/assets/characters/Female/Female 01-1.png', { frameWidth: 32, frameHeight: 32 })
    this.load.spritesheet('char-dev',       '/assets/characters/Male/Male 01-1.png',     { frameWidth: 32, frameHeight: 32 })
    this.load.spritesheet('char-qa',        '/assets/characters/Female/Female 02-1.png', { frameWidth: 32, frameHeight: 32 })
    this.load.spritesheet('char-tester',    '/assets/characters/Male/Male 02-1.png',     { frameWidth: 32, frameHeight: 32 })

    // Tilesets as spritesheets so individual frames are accessible
    // Room_Builder: 544×736 = 17 tiles wide × 23 tiles tall
    this.load.spritesheet('tileset-room', '/assets/tileset/Interiors_free/32x32/Room_Builder_free_32x32.png', { frameWidth: 32, frameHeight: 32 })
    // Interiors: 512×2848 = 16 tiles wide × 89 tiles tall
    this.load.spritesheet('tileset-interior', '/assets/tileset/Interiors_free/32x32/Interiors_free_32x32.png', { frameWidth: 32, frameHeight: 32 })
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
      // PIPOYA format: 3 cols × 4 rows, each 32×32
      // Row 0=down(0-2), Row 1=left(3-5), Row 2=right(6-8), Row 3=up(9-11)
      this.anims.create({ key: `${key}-idle`,       frames: [{ key, frame: 1 }],                                         frameRate: 1,  repeat: -1 })
      this.anims.create({ key: `${key}-walk-down`,  frames: this.anims.generateFrameNumbers(key, { start: 0, end: 2 }),  frameRate: 8,  repeat: -1 })
      this.anims.create({ key: `${key}-walk-left`,  frames: this.anims.generateFrameNumbers(key, { start: 3, end: 5 }),  frameRate: 8,  repeat: -1 })
      this.anims.create({ key: `${key}-walk-right`, frames: this.anims.generateFrameNumbers(key, { start: 6, end: 8 }),  frameRate: 8,  repeat: -1 })
      this.anims.create({ key: `${key}-walk-up`,    frames: this.anims.generateFrameNumbers(key, { start: 9, end: 11 }), frameRate: 8,  repeat: -1 })
    })
  }

  private createRoom() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    const B = 32 // border thickness

    // Wood floor — alternating planks
    const floor = this.add.graphics().setDepth(0)
    const plankH = 32
    for (let y = B; y < H - B; y += plankH) {
      const even = Math.floor((y - B) / plankH) % 2 === 0
      floor.fillStyle(even ? 0x7a5c3a : 0x6b4e2e, 1)
      floor.fillRect(B, y, W - B * 2, Math.min(plankH, H - B - y))
    }
    // Subtle plank lines
    floor.lineStyle(1, 0x5a3d21, 0.4)
    for (let y = B + plankH; y < H - B; y += plankH) {
      floor.lineBetween(B, y, W - B, y)
    }

    // Walls
    const walls = this.add.graphics().setDepth(1)
    walls.fillStyle(0x4a3520, 1)
    walls.fillRect(0, 0, W, B)              // top
    walls.fillRect(0, H - B, W, B)         // bottom
    walls.fillRect(0, 0, B, H)             // left
    walls.fillRect(W - B, 0, B, H)         // right

    // Wall top highlight strip
    walls.fillStyle(0x8b6845, 1)
    walls.fillRect(B, B - 4, W - B * 2, 4)

    // Corner accents
    walls.fillStyle(0x3a2810, 1)
    walls.fillRect(0, 0, B, B)
    walls.fillRect(W - B, 0, B, B)
    walls.fillRect(0, H - B, B, B)
    walls.fillRect(W - B, H - B, B, B)

    // Title bar
    this.add.rectangle(cx, 16, W, 32, 0x0a0a1a, 0.88).setDepth(2)
    this.add.text(cx, 16, '🏢 PIXEL OFFICE', {
      fontSize: '11px', color: '#a78bfa', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3)
  }

  private createFurniture() {
    const W = this.scale.width
    const H = this.scale.height
    const scaleX = W / 640
    const scaleY = H / 480

    // Interiors_free_32x32.png — 16 tiles wide, frame = row*16 + col
    // These are starting guesses — tell me which frames look wrong to adjust
    const DESK_L = 128   // row 8, col 0
    const DESK_R = 129   // row 8, col 1
    const DESK_M = 130   // row 8, col 2
    const CHAIR  = 144   // row 9, col 0

    const positions = [
      { x: 320, y: 130 }, // ฟ้า
      { x: 160, y: 265 }, // เปา
      { x: 480, y: 265 }, // มิ้น
      { x: 320, y: 385 }, // โบ้ท
    ]

    positions.forEach(pos => {
      const dx = Math.round(pos.x * scaleX)
      const dy = Math.round(pos.y * scaleY)

      // Desk: 3 tiles wide, centered on agent position
      this.add.image(dx - 32, dy, 'tileset-interior', DESK_L).setDepth(3)
      this.add.image(dx,      dy, 'tileset-interior', DESK_M).setDepth(3)
      this.add.image(dx + 32, dy, 'tileset-interior', DESK_R).setDepth(3)
      // Chair below
      this.add.image(dx, dy + 36, 'tileset-interior', CHAIR).setDepth(3)
    })
  }

  private createAgents() {
    const W = this.scale.width
    const H = this.scale.height
    const scaleX = W / 640
    const scaleY = H / 480

    for (const cfg of AGENT_CONFIGS) {
      const scaledConfig: AgentConfig = {
        ...cfg,
        x: Math.round(cfg.x * scaleX),
        y: Math.round(cfg.y * scaleY),
      }
      this.agents.set(cfg.id, new AgentSprite(this, scaledConfig))
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
          this.bubble.showThinking(agent.homeX, agent.homeY)
        }
        break
      }
      case 'agent_move': {
        const fromAgent = this.agents.get(event.from ?? '')
        const toAgent = this.agents.get(event.to ?? '')
        if (fromAgent && toAgent) {
          this.bubble.hide()
          fromAgent.moveTo(toAgent.homeX - 40, toAgent.homeY, () => {
            this.bubble.show(toAgent.homeX, toAgent.homeY, '📨 ส่งงานแล้ว')
            this.time.delayedCall(1500, () => {
              fromAgent.returnHome()
              this.bubble.hide()
            })
          })
        }
        break
      }
      case 'agent_message': {
        const toAgent = this.agents.get(event.to ?? '')
        if (toAgent && event.content) {
          this.bubble.show(toAgent.homeX, toAgent.homeY, event.content)
          this.time.delayedCall(3000, () => this.bubble.hide())
        }
        break
      }
      case 'secretary_reply': {
        const secretary = this.agents.get('secretary')
        if (secretary) {
          this.bubble.show(secretary.homeX, secretary.homeY, '✅ เสร็จแล้วค่ะ!')
          this.time.delayedCall(2500, () => this.bubble.hide())
        }
        break
      }
    }
  }
}
