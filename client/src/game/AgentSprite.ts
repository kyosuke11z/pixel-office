import Phaser from 'phaser'

export interface AgentConfig {
  id: string
  name: string
  textureKey: string
  x: number
  y: number
}

export class AgentSprite {
  scene: Phaser.Scene
  config: AgentConfig
  sprite: Phaser.GameObjects.Sprite
  nameText: Phaser.GameObjects.Text
  homeX: number
  homeY: number
  isMoving = false

  constructor(scene: Phaser.Scene, config: AgentConfig) {
    this.scene = scene
    this.config = config
    this.homeX = config.x
    this.homeY = config.y

    this.sprite = scene.add.sprite(config.x, config.y, config.textureKey)
      .setScale(1.5)
      .setDepth(5)

    this.nameText = scene.add.text(config.x, config.y + 30, config.name, {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(6)

    this.sprite.play(`${config.textureKey}-idle`)
  }

  moveTo(targetX: number, targetY: number, onComplete?: () => void) {
    this.isMoving = true
    const dx = targetX - this.sprite.x
    const anim = dx > 0 ? `${this.config.textureKey}-walk-right` : `${this.config.textureKey}-walk-left`
    this.sprite.play(anim)

    this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: targetY,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.isMoving = false
        this.sprite.play(`${this.config.textureKey}-idle`)
        onComplete?.()
      },
    })
    this.scene.tweens.add({
      targets: this.nameText,
      x: targetX,
      y: targetY + 30,
      duration: 600,
      ease: 'Power2',
    })
  }

  returnHome(onComplete?: () => void) {
    this.moveTo(this.homeX, this.homeY, onComplete)
  }

  flash() {
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: 3,
    })
  }
}
