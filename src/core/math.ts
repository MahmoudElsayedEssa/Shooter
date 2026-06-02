/**
 * Shared math utilities — single source of truth for common operations
 * used across all game systems.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * clamp(amount, 0, 1);
}

export function smoothStep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
