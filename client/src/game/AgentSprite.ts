import Phaser from 'phaser'

export interface AgentConfig {
  id: string
  name: string
  color: number
  x: number
  y: number
}

export class AgentSprite {
  scene: Phaser.Scene
  config: AgentConfig
  body: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
  homeX: number
  homeY: number
  isMoving = false

  constructor(scene: Phaser.Scene, config: AgentConfig) {
    this.scene = scene
    this.config = config
    this.homeX = config.x
    this.homeY = config.y

    // Desk
    scene.add.rectangle(config.x, config.y + 20, 48, 28, 0x4a4a6a)

    // Character body
    this.body = scene.add.rectangle(config.x, config.y - 8, 20, 24, config.color)
      .setDepth(2)

    // Name label
    this.nameText = scene.add.text(config.x, config.y + 38, config.name, {
      fontSize: '10px',
      color: '#e2e8f0',
      backgroundColor: '#0f0f23aa',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(3)

    // Idle animation
    scene.tweens.add({
      targets: this.body,
      scaleY: 0.95,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  moveTo(targetX: number, targetY: number, onComplete?: () => void) {
    this.isMoving = true
    this.scene.tweens.add({
      targets: this.body,
      x: targetX,
      y: targetY - 8,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.isMoving = false
        onComplete?.()
      },
    })
    this.scene.tweens.add({
      targets: this.nameText,
      x: targetX,
      y: targetY + 38,
      duration: 600,
      ease: 'Power2',
    })
  }

  returnHome(onComplete?: () => void) {
    this.moveTo(this.homeX, this.homeY, onComplete)
  }

  flash() {
    this.scene.tweens.add({
      targets: this.body,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: 3,
    })
  }
}
