/**
 * GameParticles — Lightweight particle effects for the penalty shooter.
 * Handles: grass kick spray, ball flight trail, goal confetti, flash overlays.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;     // 0→1 countdown
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
  gravity: number;
  rotation: number;
  rotationSpeed: number;
}

export class ParticleEmitter {
  private particles: Particle[] = [];
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, depth: number = 100) {
    this.gfx = scene.add.graphics().setDepth(depth);
  }

  /** Emit grass particles from kick point */
  emitGrassKick(x: number, y: number, directionX: number): void {
    const count = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 80 + Math.random() * 160;
      // Bias particles toward shot direction
      const biasX = directionX * 0.3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()) + biasX * speed,
        vy: Math.sin(angle) * speed * (0.8 + Math.random() * 0.4),
        life: 1,
        maxLife: 0.3 + Math.random() * 0.25,
        size: 1.5 + Math.random() * 2.5,
        color: [0x4ade80, 0x22c55e, 0x16a34a, 0x2d5016, 0x3b7a1a][Math.floor(Math.random() * 5)],
        alpha: 0.7 + Math.random() * 0.3,
        gravity: 350 + Math.random() * 150,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 8
      });
    }
  }

  /** Emit confetti burst at position */
  emitConfetti(x: number, y: number, count: number = 40): void {
    const colors = [0xfacc15, 0xf97316, 0x22d3ee, 0xa78bfa, 0xf43f5e, 0x34d399, 0xffffff];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 250;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150, // upward bias
        life: 1,
        maxLife: 0.8 + Math.random() * 0.6,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.9,
        gravity: 200 + Math.random() * 100,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 12
      });
    }
  }

  /** Emit ball flight sparkle trail */
  emitFlightSparkle(x: number, y: number, force: number, color: number): void {
    const count = Math.floor(1 + force * 2);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        life: 1,
        maxLife: 0.15 + Math.random() * 0.15,
        size: 1 + Math.random() * 2 * force,
        color,
        alpha: 0.5 + force * 0.3,
        gravity: 0,
        rotation: 0,
        rotationSpeed: 0
      });
    }
  }

  /** Update all particles. Call every frame with delta in seconds. */
  update(deltaSec: number): void {
    this.gfx.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaSec / p.maxLife;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.vy += p.gravity * deltaSec;
      p.x += p.vx * deltaSec;
      p.y += p.vy * deltaSec;
      p.rotation += p.rotationSpeed * deltaSec;

      // Fade out
      const alpha = p.alpha * Math.min(1, p.life * 3);
      const size = p.size * (0.5 + p.life * 0.5);

      // Draw
      this.gfx.fillStyle(p.color, alpha);
      if (size > 2.5) {
        // Confetti: draw small rectangles
        this.gfx.save();
        this.gfx.fillRect(
          p.x - size * 0.5 * Math.cos(p.rotation),
          p.y - size * 0.5 * Math.sin(p.rotation),
          size * 1.5,
          size * 0.8
        );
        this.gfx.restore();
      } else {
        // Small particles: circles
        this.gfx.fillCircle(p.x, p.y, size);
      }
    }
  }

  /** Add this graphics to a Phaser container/layer */
  addToContainer(container: { add(child: Phaser.GameObjects.GameObject): unknown }): void {
    container.add(this.gfx);
  }

  get active(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles = [];
    this.gfx.clear();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
