import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'

let sceneRef: OfficeScene | null = null

export function getScene(): OfficeScene | null {
  return sceneRef
}

export function startGame(parent: HTMLElement): Phaser.Game {
  sceneRef = new OfficeScene()

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: parent.clientWidth || 640,
    height: parent.clientHeight || 480,
    parent,
    backgroundColor: '#0f0f1e',
    scene: sceneRef,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}
