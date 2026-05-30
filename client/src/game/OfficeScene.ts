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
    // Character spritesheets (PIPOYA 32x32, 96x128 per file)
    this.load.spritesheet('char-secretary', '/assets/characters/Female/Female 01-1.png', { frameWidth: 32, frameHeight: 32 })
    this.load.spritesheet('char-dev',       '/assets/characters/Male/Male 01-1.png',     { frameWidth: 32, frameHeight: 32 })
    this.load.spritesheet('char-qa',        '/assets/characters/Female/Female 02-1.png', { frameWidth: 32, frameHeight: 32 })
    this.load.spritesheet('char-tester',    '/assets/characters/Male/Male 02-1.png',     { frameWidth: 32, frameHeight: 32 })

    // Tilesets
    this.load.image('tileset-room',     '/assets/tileset/Interiors_free/32x32/Room_Builder_free_32x32.png')
    this.load.image('tileset-interior', '/assets/tileset/Interiors_free/32x32/Interiors_free_32x32.png')
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
    const tilesW = Math.ceil(W / 32) + 1
    const tilesH = Math.ceil(H / 32) + 1

    const map = this.make.tilemap({ tileWidth: 32, tileHeight: 32, width: tilesW, height: tilesH })
    const roomset = map.addTilesetImage('room', 'tileset-room')!

    // Floor (tile index 1 = basic floor in Room_Builder_free)
    const floorLayer = map.createBlankLayer('floor', roomset, 0, 0)!
    floorLayer.fill(1)

    // Top wall row
    const wallLayer = map.createBlankLayer('walls', roomset, 0, 0)!
    wallLayer.fill(0, 0, 0, tilesW, 1)          // top wall
    wallLayer.fill(0, 0, tilesH - 1, tilesW, 1) // bottom wall
    wallLayer.fill(0, 0, 0, 1, tilesH)          // left wall
    wallLayer.fill(0, tilesW - 1, 0, 1, tilesH) // right wall

    // Title bar overlay
    this.add.rectangle(W / 2, 16, W, 32, 0x0f0f23, 0.85).setDepth(1)
    this.add.text(W / 2, 16, '🏢 PIXEL OFFICE', {
      fontSize: '11px', color: '#a78bfa', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2)
  }

  private createFurniture() {
    const W = this.scale.width
    const H = this.scale.height
    const scaleX = W / 640
    const scaleY = H / 480

    // Desk positions matching agent home positions
    // Each desk = 2×1 tiles from interior tileset at known furniture row
    // Using tile crops from Interiors_free_32x32.png
    const deskPositions = [
      { x: 320, y: 130 }, // ฟ้า desk
      { x: 160, y: 265 }, // เปา desk
      { x: 480, y: 265 }, // มิ้น desk
      { x: 320, y: 385 }, // โบ้ท desk
    ]

    deskPositions.forEach(pos => {
      const dx = Math.round(pos.x * scaleX)
      const dy = Math.round(pos.y * scaleY)

      // Desk top from interior tileset
      // Tile row 8, col 0 in Interiors_free_32x32 = desk top (64×32 crop)
      this.add.image(dx, dy, 'tileset-interior')
        .setCrop(0, 256, 64, 32)
        .setDepth(3)
        .setOrigin(0.5)

      // Chair below desk (32×32 crop)
      this.add.image(dx, dy + 36, 'tileset-interior')
        .setCrop(0, 288, 32, 32)
        .setDepth(3)
        .setOrigin(0.5)
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
