import Phaser from 'phaser'

export class SpeechBubble {
  scene: Phaser.Scene
  bg: Phaser.GameObjects.Rectangle
  text: Phaser.GameObjects.Text
  container: Phaser.GameObjects.Container
  private thinkingTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    this.bg = scene.add.rectangle(0, 0, 140, 36, 0xffffff, 0.95)
      .setStrokeStyle(1, 0x7c3aed)

    this.text = scene.add.text(0, 0, '', {
      fontSize: '9px',
      color: '#1a1a2e',
      wordWrap: { width: 128 },
      align: 'center',
    }).setOrigin(0.5)

    this.container = scene.add.container(0, 0, [this.bg, this.text])
      .setDepth(10)
      .setAlpha(0)
  }

  show(x: number, y: number, message: string) {
    this.stopThinkingTween()
    this.text.setAlpha(1)

    const lines = message.length > 60 ? message.slice(0, 60) + '...' : message
    this.text.setText(lines)

    const h = Math.max(36, this.text.height + 16)
    this.bg.setSize(140, h)

    this.container.setPosition(x, y - 50)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
    })
  }

  showThinking(x: number, y: number) {
    this.stopThinkingTween()
    this.text.setText('...')
    this.bg.setSize(60, 28)
    this.container.setPosition(x, y - 50)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
    })
    this.thinkingTween = this.scene.tweens.add({
      targets: this.text,
      alpha: 0.2,
      duration: 400,
      yoyo: true,
      repeat: -1,
    })
  }

  hide() {
    this.stopThinkingTween()
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
    })
  }

  private stopThinkingTween() {
    if (this.thinkingTween) {
      this.thinkingTween.stop()
      this.thinkingTween = null
    }
    this.text.setAlpha(1)
  }
}
