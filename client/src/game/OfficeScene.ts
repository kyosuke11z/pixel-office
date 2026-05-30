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
    this.load.spritesheet(
      'tileset-interior',
      '/assets/tileset/Interiors_free/32x32/Interiors_free_32x32.png',
      { frameWidth: 32, frameHeight: 32 }
    )
  }

  create() {
    this.createAnimations()
    this.createRoom()
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
    const B = 24

    // Wood floor — alternating planks
    const floor = this.add.graphics().setDepth(0)
    const plankH = 32
    for (let y = B; y < H - B; y += plankH) {
      const even = Math.floor((y - B) / plankH) % 2 === 0
      floor.fillStyle(even ? 0x7a5c3a : 0x6b4e2e, 1)
      floor.fillRect(B, y, W - B * 2, Math.min(plankH, H - B - y))
    }
    floor.lineStyle(1, 0x5a3d21, 0.4)
    for (let y = B + plankH; y < H - B; y += plankH) {
      floor.lineBetween(B, y, W - B, y)
    }

    // Walls
    const walls = this.add.graphics().setDepth(1)
    walls.fillStyle(0x4a3520, 1)
    walls.fillRect(0, 0, W, B)
    walls.fillRect(0, H - B, W, B)
    walls.fillRect(0, 0, B, H)
    walls.fillRect(W - B, 0, B, H)
    walls.fillStyle(0x8b6845, 1)
    walls.fillRect(B, B - 4, W - B * 2, 4)
    walls.fillStyle(0x3a2810, 1)
    walls.fillRect(0, 0, B, B)
    walls.fillRect(W - B, 0, B, B)
    walls.fillRect(0, H - B, B, B)
    walls.fillRect(W - B, H - B, B, B)

    // Zone dividers — แบ่ง management / engineering zone
    const divider = this.add.graphics().setDepth(1)
    divider.lineStyle(1, 0x5a3d21, 0.5)
    divider.lineBetween(B + 10, 250, W - B - 10, 250)

    // Zone labels
    this.add.text(W / 2, 140, 'Management', {
      fontSize: '8px', color: '#5a3d21', alpha: 0.6,
    }).setOrigin(0.5).setDepth(2)
    this.add.text(W / 2, 280, 'Engineering', {
      fontSize: '8px', color: '#5a3d21', alpha: 0.6,
    }).setOrigin(0.5).setDepth(2)

    // Desk sprites for each agent position
    const scaleX = W / 640
    const scaleY = H / 480
    const DESK = 130 // frame index — adjust if wrong
    AGENT_CONFIGS.forEach(cfg => {
      const dx = Math.round(cfg.x * scaleX)
      const dy = Math.round(cfg.y * scaleY) + 20
      this.add.image(dx, dy, 'tileset-interior', DESK).setDepth(2).setScale(0.9)
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
          fromAgent.moveTo(toAgent.homeX - 36, toAgent.homeY, () => {
            this.bubble.show(toAgent.homeX, toAgent.homeY - 20, '📨 ส่งงานแล้ว')
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
          this.bubble.show(toAgent.homeX, toAgent.homeY - 20, event.content.slice(0, 60))
          this.time.delayedCall(3000, () => this.bubble.hide())
        }
        break
      }
      case 'user_checkpoint': {
        // ฟ้า flash + bubble checkpoint
        const secretary = this.agents.get('secretary')
        if (secretary) {
          secretary.flash()
          this.bubble.show(secretary.homeX, secretary.homeY - 20, '🔔 รอ approval จากหัวหน้า')
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
          this.bubble.show(secretary.homeX, secretary.homeY - 20, '✅ เสร็จแล้วค่ะ!')
          this.time.delayedCall(2500, () => this.bubble.hide())
        }
        break
      }
    }
  }
}
