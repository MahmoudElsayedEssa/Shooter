/**
 * Shared math utilities — single source of truth for common operations
 * used across all game systems.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Unclamped linear interpolation. Use `mix` for clamped [0,1] interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamped linear interpolation (t is clamped to [0,1]). Use `lerp` for unclamped. */
export function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * clamp(amount, 0, 1);
}

export function smoothStep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
