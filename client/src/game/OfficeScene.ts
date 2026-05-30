import Phaser from 'phaser'
import { AgentSprite } from './AgentSprite'
import { SpeechBubble } from './SpeechBubble'

const AGENT_CONFIGS = [
  { id: 'secretary', name: 'ฟ้า', color: 0xa78bfa, x: 320, y: 110 },
  { id: 'dev',       name: 'เปา', color: 0x60a5fa, x: 160, y: 240 },
  { id: 'qa',        name: 'มิ้น', color: 0x34d399, x: 480, y: 240 },
  { id: 'tester',    name: 'โบ้ท', color: 0xfb923c, x: 320, y: 360 },
]

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, AgentSprite> = new Map()
  private bubble!: SpeechBubble

  constructor() {
    super({ key: 'OfficeScene' })
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    const cy = H / 2

    // Floor
    this.add.rectangle(cx, cy, W - 40, H - 40, 0x1e1e35)
    // Top accent bar
    this.add.rectangle(cx, 22, W, 4, 0x7c3aed)

    // Title
    this.add.text(cx, 12, '🏢 PIXEL OFFICE', {
      fontSize: '11px',
      color: '#a78bfa',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Plant decorations
    this.add.text(50, 70, '🪴', { fontSize: '18px' })
    this.add.text(W - 50, 70, '🪴', { fontSize: '18px' })
    this.add.text(50, H - 60, '🪴', { fontSize: '18px' })
    this.add.text(W - 50, H - 60, '🪴', { fontSize: '18px' })

    // Scale positions based on canvas size
    const scaleX = W / 640
    const scaleY = H / 480

    for (const cfg of AGENT_CONFIGS) {
      const scaledConfig = {
        ...cfg,
        x: Math.round(cfg.x * scaleX),
        y: Math.round(cfg.y * scaleY),
      }
      this.agents.set(cfg.id, new AgentSprite(this, scaledConfig))
    }

    this.bubble = new SpeechBubble(this)
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
          fromAgent.moveTo(toAgent.homeX - 32, toAgent.homeY, () => {
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
