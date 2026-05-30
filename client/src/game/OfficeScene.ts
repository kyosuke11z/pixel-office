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
    const cy = H / 2

    // Dark fallback background (always visible)
    this.add.rectangle(cx, cy, W, H, 0x2c1f14).setDepth(0)

    // Floor: tileSprite tiles frame 34 (row 2, col 0 in 17-wide sheet = wood floor)
    // Adjust FLOOR_FRAME if wrong tile shows up
    const FLOOR_FRAME = 34
    this.add.tileSprite(cx, cy, W - 64, H - 64, 'tileset-room', FLOOR_FRAME)
      .setDepth(1)

    // Walls: tileSprite along each edge (frame 0 = top-left tile = outer wall piece)
    const WALL_FRAME = 0
    const WS = 32 // wall thickness
    this.add.tileSprite(cx, WS / 2,     W, WS, 'tileset-room', WALL_FRAME).setDepth(2) // top
    this.add.tileSprite(cx, H - WS / 2, W, WS, 'tileset-room', WALL_FRAME).setDepth(2) // bottom
    this.add.tileSprite(WS / 2,     cy, WS, H, 'tileset-room', WALL_FRAME).setDepth(2) // left
    this.add.tileSprite(W - WS / 2, cy, WS, H, 'tileset-room', WALL_FRAME).setDepth(2) // right

    // Title bar
    this.add.rectangle(cx, 16, W, 32, 0x0a0a1a, 0.88).setDepth(3)
    this.add.text(cx, 16, '🏢 PIXEL OFFICE', {
      fontSize: '11px', color: '#a78bfa', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4)
  }

  private createFurniture() {
    const W = this.scale.width
    const H = this.scale.height
    const scaleX = W / 640
    const scaleY = H / 480

    // Interiors_free_32x32.png is 16 tiles wide
    // frame = row * 16 + col
    // Adjust DESK_* and CHAIR_* frame numbers to match actual tileset content
    const DESK_L  = 64  // row 4, col 0  — left half of desk
    const DESK_R  = 65  // row 4, col 1  — right half of desk
    const CHAIR   = 80  // row 5, col 0  — chair

    const positions = [
      { x: 320, y: 130 }, // ฟ้า
      { x: 160, y: 265 }, // เปา
      { x: 480, y: 265 }, // มิ้น
      { x: 320, y: 385 }, // โบ้ท
    ]

    positions.forEach(pos => {
      const dx = Math.round(pos.x * scaleX)
      const dy = Math.round(pos.y * scaleY)

      // Desk: 2 tiles wide
      this.add.image(dx - 16, dy, 'tileset-interior', DESK_L).setDepth(3)
      this.add.image(dx + 16, dy, 'tileset-interior', DESK_R).setDepth(3)
      // Chair below desk
      this.add.image(dx, dy + 32, 'tileset-interior', CHAIR).setDepth(3)
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
