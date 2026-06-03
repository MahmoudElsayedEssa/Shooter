import type Phaser from "phaser";

/** Set image display size by height, preserving aspect ratio. */
export function setImageDisplayHeight(image: Phaser.GameObjects.Image, height: number): void {
  const width = (image.frame.width / image.frame.height) * height;
  image.setDisplaySize(width, height);
}
