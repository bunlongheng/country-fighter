// Pure, deterministic physics for the Country Fighter arena.
// No randomness or Date lives in here so every function is unit-testable;
// the render loop injects any jitter it wants from the outside.

export type Vec = { x: number; y: number };
export type Fighter = {
  pos: Vec;
  vel: Vec;
  radius: number;
  health: number; // 0..MAX_HEALTH
};

export const ARENA_HALF = 5; // arena spans [-ARENA_HALF, +ARENA_HALF] on each axis
export const MARBLE_RADIUS = 0.92;
export const MAX_HEALTH = 100;

// Collisions are slightly inelastic so the marbles stay engaged and grind at
// each other instead of flinging into long, boring orbits.
export const RESTITUTION = 0.6;

// A collision at closing speed `impact` deals up to MAX_HIT damage, split
// asymmetrically: you take more the harder the *other* marble drove into you.
export const DAMAGE_K = 4.2;
export const MAX_HIT = 17;
export const HIT_THRESHOLD = 0.7; // ignore feather-light grazes

// "Storm" backstop: after STORM_START seconds an escalating drain hits both
// fighters so no match can drag on when the marbles get unlucky and keep
// missing. The fighter already ahead on health stays ahead, so it never
// decides the winner on its own - it just guarantees a prompt, clean finish.
export const STORM_START = 9;
export const STORM_RATE = 7;

export type Collision = { impact: number; aInto: number; bInto: number };

export function len(v: Vec): number {
  return Math.hypot(v.x, v.y);
}

// Integrate position by velocity over dt (mutates the fighter).
export function integrate(f: Fighter, dt: number): void {
  f.pos.x += f.vel.x * dt;
  f.pos.y += f.vel.y * dt;
}

// Reflect off the square walls and clamp inside. Returns true if a wall was hit.
export function bounceWalls(f: Fighter, half: number = ARENA_HALF): boolean {
  const limit = half - f.radius;
  let hit = false;
  if (f.pos.x > limit) {
    f.pos.x = limit;
    f.vel.x = -Math.abs(f.vel.x);
    hit = true;
  } else if (f.pos.x < -limit) {
    f.pos.x = -limit;
    f.vel.x = Math.abs(f.vel.x);
    hit = true;
  }
  if (f.pos.y > limit) {
    f.pos.y = limit;
    f.vel.y = -Math.abs(f.vel.y);
    hit = true;
  } else if (f.pos.y < -limit) {
    f.pos.y = -limit;
    f.vel.y = Math.abs(f.vel.y);
    hit = true;
  }
  return hit;
}

// Equal-mass collision with restitution `e`. If the fighters overlap, push them
// apart and resolve the normal velocity component. Returns the closing speed
// plus how hard each fighter drove into the contact (`aInto`/`bInto`, used to
// split damage), or null when they are not approaching.
export function separateAndBounce(
  a: Fighter,
  b: Fighter,
  e: number = RESTITUTION,
): Collision | null {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist >= minDist) return null;

  // Normal from a -> b. Guard the degenerate exact-overlap case.
  const nx = dist > 1e-6 ? dx / dist : 1;
  const ny = dist > 1e-6 ? dy / dist : 0;

  // Positional separation, split evenly.
  const overlap = minDist - dist;
  a.pos.x -= (nx * overlap) / 2;
  a.pos.y -= (ny * overlap) / 2;
  b.pos.x += (nx * overlap) / 2;
  b.pos.y += (ny * overlap) / 2;

  const aN = a.vel.x * nx + a.vel.y * ny;
  const bN = b.vel.x * nx + b.vel.y * ny;
  const closing = aN - bN; // >0 means they are approaching
  if (closing <= 0) return null;

  // Equal-mass restitution response on the normal component.
  const aNp = ((1 - e) / 2) * aN + ((1 + e) / 2) * bN;
  const bNp = ((1 + e) / 2) * aN + ((1 - e) / 2) * bN;
  a.vel.x += (aNp - aN) * nx;
  a.vel.y += (aNp - aN) * ny;
  b.vel.x += (bNp - bN) * nx;
  b.vel.y += (bNp - bN) * ny;

  return { impact: closing, aInto: Math.max(0, aN), bInto: Math.max(0, -bN) };
}

// Base health lost by a collision of the given impact speed (capped).
export function damageFrom(impact: number): number {
  return Math.min(MAX_HIT, DAMAGE_K * impact);
}

// Split a collision's damage between the two fighters. You take more damage the
// harder the *other* marble drove into you, with a small floor so both feel the
// hit. Returns [damageToA, damageToB].
export function splitDamage(
  base: number,
  aInto: number,
  bInto: number,
): [number, number] {
  const total = aInto + bInto || 1;
  const dmgA = base * (0.1 + 0.9 * (bInto / total));
  const dmgB = base * (0.1 + 0.9 * (aInto / total));
  return [dmgA, dmgB];
}

// Per-step storm drain applied to each fighter once the match runs long.
export function stormDamage(elapsed: number, dt: number): number {
  if (elapsed <= STORM_START) return 0;
  return STORM_RATE * (elapsed - STORM_START) * dt;
}

// Keep the marbles lively: never let them crawl or fly off into hyperspace.
export function clampSpeed(f: Fighter, min: number, max: number): void {
  const s = len(f.vel);
  if (s < 1e-6) return;
  const clamped = Math.max(min, Math.min(max, s));
  if (clamped !== s) {
    f.vel.x = (f.vel.x / s) * clamped;
    f.vel.y = (f.vel.y / s) * clamped;
  }
}

// Nudge a fighter toward a target point (the playful "charge" behaviour).
export function steer(f: Fighter, target: Vec, accel: number, dt: number): void {
  const dx = target.x - f.pos.x;
  const dy = target.y - f.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  f.vel.x += (dx / d) * accel * dt;
  f.vel.y += (dy / d) * accel * dt;
}

// The higher (pre-clamp) health wins. Ties resolve to fighter 0; with float
// health after asymmetric combat an exact tie is effectively impossible.
export function decideWinner(healthA: number, healthB: number): 0 | 1 {
  return healthA >= healthB ? 0 : 1;
}
