/**
 * NetRipple — Bold, visible net deformation effect when the ball hits the goal net.
 *
 * Renders a grid of net threads that visibly bulge and ripple outward from
 * the ball impact point, with a bright impact flash, filled depth shading,
 * and thick glowing threads. Designed to be unmissable.
 */

export interface NetRippleConfig {
  readonly goalLeftX: number;
  readonly goalRightX: number;
  readonly goalTopY: number;
  readonly goalBottomY: number;
  readonly gridCols: number;
  readonly gridRows: number;
  readonly maxBulgePx: number;
  readonly durationMs: number;
}

export const DEFAULT_NET_RIPPLE_CONFIG: NetRippleConfig = {
  goalLeftX: 55,
  goalRightX: 485,
  goalTopY: 165,
  goalBottomY: 390,
  gridCols: 12,
  gridRows: 7,
  maxBulgePx: 45,
  durationMs: 1400,
};

interface GridNode {
  rx: number;
  ry: number;
  distFromImpact: number;
}

export class NetRippleEffect {
  private gfx: Phaser.GameObjects.Graphics;
  private glowGfx: Phaser.GameObjects.Graphics;
  private grid: GridNode[][] = [];
  private impactX = 0;
  private impactY = 0;
  private elapsedMs = 0;
  private active = false;
  private config: NetRippleConfig;
  private shotForce = 0.7;
  private maxNodeDist = 1;

  constructor(scene: Phaser.Scene, config: NetRippleConfig = DEFAULT_NET_RIPPLE_CONFIG) {
    // Glow layer renders behind the mesh lines
    this.glowGfx = scene.add.graphics();
    this.gfx = scene.add.graphics();
    this.config = config;
    this.buildGrid();
  }

  private buildGrid(): void {
    const { goalLeftX, goalRightX, goalTopY, goalBottomY, gridCols, gridRows } = this.config;
    const inset = 6;
    const left = goalLeftX + inset;
    const right = goalRightX - inset;
    const top = goalTopY + inset;
    const bottom = goalBottomY - inset;
    const cellW = (right - left) / gridCols;
    const cellH = (bottom - top) / gridRows;

    this.grid = [];
    for (let row = 0; row <= gridRows; row++) {
      const rowNodes: GridNode[] = [];
      for (let col = 0; col <= gridCols; col++) {
        rowNodes.push({
          rx: left + col * cellW,
          ry: top + row * cellH,
          distFromImpact: 0,
        });
      }
      this.grid.push(rowNodes);
    }
  }

  trigger(impactX: number, impactY: number, force: number = 0.7): void {
    this.impactX = impactX;
    this.impactY = impactY;
    this.shotForce = Math.min(1.35, Math.max(0.4, force));
    this.elapsedMs = 0;
    this.active = true;

    let maxDist = 0;
    for (const row of this.grid) {
      for (const node of row) {
        node.distFromImpact = Math.hypot(node.rx - impactX, node.ry - impactY);
        if (node.distFromImpact > maxDist) maxDist = node.distFromImpact;
      }
    }
    this.maxNodeDist = Math.max(1, maxDist);
  }

  update(deltaMs: number): boolean {
    if (!this.active) return false;

    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.config.durationMs) {
      this.active = false;
      this.gfx.clear();
      this.glowGfx.clear();
      return false;
    }

    this.render();
    return true;
  }

  private getNodeOffset(node: GridNode): { dx: number; dy: number; strength: number } {
    const { maxBulgePx, durationMs } = this.config;
    const t = this.elapsedMs / durationMs; // 0 → 1

    // Proximity to impact: 1 at epicenter, 0 at farthest node
    const proximity = 1 - (node.distFromImpact / this.maxNodeDist);

    // Force: stronger kicks = bigger deformation
    const forceMul = 0.6 + (this.shotForce / 1.35) * 0.6;

    // ── Initial bulge: strong outward push that decays ──
    // Rapid rise (first 15% of duration) then smooth exponential decay
    const riseT = Math.min(1, this.elapsedMs / (durationMs * 0.15));
    const rise = Math.sin(riseT * Math.PI * 0.5); // 0→1 ease-out
    const decay = Math.exp(-t * 3.2); // exponential fade
    const bulgeEnvelope = rise * decay;

    // ── Wave ripple: oscillating ring that travels outward ──
    const waveSpeed = 400; // px/sec
    const waveFront = (this.elapsedMs / 1000) * waveSpeed;
    const distBehindWave = waveFront - node.distFromImpact;
    let waveComponent = 0;
    if (distBehindWave > 0) {
      // Damped sine wave — 2 oscillation cycles visible
      const wavePhase = distBehindWave * 0.04;
      waveComponent = Math.sin(wavePhase * Math.PI * 2) *
        Math.exp(-wavePhase * 1.5) *
        Math.exp(-t * 2);
    }

    // Combined displacement: strong central bulge + outward traveling wave
    const rawStrength = (proximity * proximity * bulgeEnvelope * 0.7 + waveComponent * 0.5) * forceMul;
    const clampedStrength = Math.max(-1, Math.min(1, rawStrength));
    const displacement = clampedStrength * maxBulgePx;

    // Direction: nodes push away from impact point
    const dx2 = node.rx - this.impactX;
    const dy2 = node.ry - this.impactY;
    const dist = Math.max(1, Math.hypot(dx2, dy2));
    const ndx = dx2 / dist;
    const ndy = dy2 / dist;

    return {
      dx: ndx * displacement * 0.55,
      dy: ndy * displacement * 0.55 - Math.abs(displacement) * 0.35, // bias upward/backward
      strength: Math.abs(clampedStrength),
    };
  }

  private render(): void {
    this.gfx.clear();
    this.glowGfx.clear();

    const { gridRows, gridCols, durationMs } = this.config;
    const t = this.elapsedMs / durationMs;

    // Global fade — stays fully visible until 50%, then fades
    const globalAlpha = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) * 2);
    if (globalAlpha <= 0.01) return;

    // ── Build displaced grid ──
    const nodes: Array<Array<{ x: number; y: number; s: number }>> = [];
    for (let row = 0; row <= gridRows; row++) {
      const rowArr: Array<{ x: number; y: number; s: number }> = [];
      for (let col = 0; col <= gridCols; col++) {
        const gn = this.grid[row][col];
        const off = this.getNodeOffset(gn);
        rowArr.push({ x: gn.rx + off.dx, y: gn.ry + off.dy, s: off.strength });
      }
      nodes.push(rowArr);
    }

    // ── Layer 1: Filled depth cells — dark cells where the net is pushed ──
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const tl = nodes[row][col];
        const tr = nodes[row][col + 1];
        const bl = nodes[row + 1][col];
        const br = nodes[row + 1][col + 1];
        const avgS = (tl.s + tr.s + bl.s + br.s) * 0.25;
        if (avgS > 0.05) {
          // Dark fill for depth
          this.glowGfx.fillStyle(0x000000, avgS * 0.45 * globalAlpha);
          this.glowGfx.beginPath();
          this.glowGfx.moveTo(tl.x, tl.y);
          this.glowGfx.lineTo(tr.x, tr.y);
          this.glowGfx.lineTo(br.x, br.y);
          this.glowGfx.lineTo(bl.x, bl.y);
          this.glowGfx.closePath();
          this.glowGfx.fillPath();
        }
      }
    }

    // ── Layer 2: Impact glow — bright radial flash at impact point ──
    const glowFade = Math.max(0, 1 - t * 1.8);
    if (glowFade > 0.01) {
      const glowR = 30 + this.shotForce * 25 + t * 40;
      // Outer soft glow
      this.glowGfx.fillStyle(0xffffff, 0.12 * glowFade * globalAlpha);
      this.glowGfx.fillCircle(this.impactX, this.impactY, glowR);
      // Mid glow
      this.glowGfx.fillStyle(0xffffff, 0.2 * glowFade * globalAlpha);
      this.glowGfx.fillCircle(this.impactX, this.impactY, glowR * 0.55);
      // Inner bright core
      this.glowGfx.fillStyle(0xffffff, 0.35 * glowFade * globalAlpha);
      this.glowGfx.fillCircle(this.impactX, this.impactY, glowR * 0.25);
    }

    // ── Layer 3: Horizontal net threads ──
    for (let row = 0; row <= gridRows; row++) {
      const rd = nodes[row];
      // Per-row max strength drives visibility
      let rowMaxS = 0;
      for (let c = 0; c <= gridCols; c++) {
        if (rd[c].s > rowMaxS) rowMaxS = rd[c].s;
      }
      // Base visibility even at rest, boosted when deformed
      const baseAlpha = 0.15;
      const alpha = Math.min(0.9, baseAlpha + rowMaxS * 0.75) * globalAlpha;
      const lw = 1.0 + rowMaxS * 2.5;

      // Glow pass (thicker, semi-transparent)
      if (rowMaxS > 0.08) {
        this.glowGfx.lineStyle(lw + 4, 0xffffff, rowMaxS * 0.15 * globalAlpha);
        this.glowGfx.beginPath();
        this.glowGfx.moveTo(rd[0].x, rd[0].y);
        for (let c = 1; c <= gridCols; c++) this.glowGfx.lineTo(rd[c].x, rd[c].y);
        this.glowGfx.strokePath();
      }

      // Main thread
      this.gfx.lineStyle(lw, 0xe8e8ec, alpha);
      this.gfx.beginPath();
      this.gfx.moveTo(rd[0].x, rd[0].y);
      for (let c = 1; c <= gridCols; c++) this.gfx.lineTo(rd[c].x, rd[c].y);
      this.gfx.strokePath();
    }

    // ── Layer 4: Vertical net threads ──
    for (let col = 0; col <= gridCols; col++) {
      let colMaxS = 0;
      for (let r = 0; r <= gridRows; r++) {
        if (nodes[r][col].s > colMaxS) colMaxS = nodes[r][col].s;
      }
      const baseAlpha = 0.12;
      const alpha = Math.min(0.85, baseAlpha + colMaxS * 0.7) * globalAlpha;
      const lw = 0.8 + colMaxS * 2.0;

      // Glow pass
      if (colMaxS > 0.08) {
        this.glowGfx.lineStyle(lw + 3, 0xffffff, colMaxS * 0.12 * globalAlpha);
        this.glowGfx.beginPath();
        this.glowGfx.moveTo(nodes[0][col].x, nodes[0][col].y);
        for (let r = 1; r <= gridRows; r++) this.glowGfx.lineTo(nodes[r][col].x, nodes[r][col].y);
        this.glowGfx.strokePath();
      }

      // Main thread
      this.gfx.lineStyle(lw, 0xe0e0e4, alpha);
      this.gfx.beginPath();
      this.gfx.moveTo(nodes[0][col].x, nodes[0][col].y);
      for (let r = 1; r <= gridRows; r++) this.gfx.lineTo(nodes[r][col].x, nodes[r][col].y);
      this.gfx.strokePath();
    }

    // ── Layer 5: Bright highlight on deformed threads near impact ──
    for (let row = 0; row <= gridRows; row++) {
      for (let col = 0; col <= gridCols; col++) {
        const n = nodes[row][col];
        if (n.s > 0.25) {
          const dotAlpha = (n.s - 0.25) * 1.3 * globalAlpha;
          const dotR = 1.5 + n.s * 2.5;
          this.gfx.fillStyle(0xffffff, Math.min(0.8, dotAlpha));
          this.gfx.fillCircle(n.x, n.y, dotR);
        }
      }
    }

    // ── Layer 6: Expanding ripple ring (concentric wave visual) ──
    const ringSpeed = 350; // px/sec
    const ringDist = (this.elapsedMs / 1000) * ringSpeed;
    const ringFade = Math.max(0, 1 - t * 2.2);
    if (ringFade > 0.02 && ringDist > 5) {
      this.gfx.lineStyle(2, 0xffffff, 0.25 * ringFade * globalAlpha);
      this.gfx.strokeCircle(this.impactX, this.impactY, ringDist);
      if (ringDist > 30) {
        this.gfx.lineStyle(1.5, 0xffffff, 0.15 * ringFade * globalAlpha);
        this.gfx.strokeCircle(this.impactX, this.impactY, ringDist * 0.55);
      }
    }
  }

  addToContainer(container: { add(child: Phaser.GameObjects.GameObject): unknown }): void {
    container.add(this.glowGfx);
    container.add(this.gfx);
  }

  clear(): void {
    this.active = false;
    this.gfx.clear();
    this.glowGfx.clear();
  }

  get isActive(): boolean {
    return this.active;
  }

  destroy(): void {
    this.gfx.destroy();
    this.glowGfx.destroy();
  }
}
