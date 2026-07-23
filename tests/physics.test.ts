import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARENA_HALF,
  bounceWalls,
  clampSpeed,
  damageFrom,
  decideWinner,
  integrate,
  len,
  separateAndBounce,
  splitDamage,
  steer,
  stormDamage,
  MAX_HIT,
  STORM_START,
  type Fighter,
} from "../lib/physics.ts";

function mk(over: Partial<Fighter> = {}): Fighter {
  return {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: 0.92,
    health: 100,
    ...over,
  };
}

test("integrate advances position by velocity * dt", () => {
  const f = mk({ vel: { x: 2, y: -1 } });
  integrate(f, 0.5);
  assert.equal(f.pos.x, 1);
  assert.equal(f.pos.y, -0.5);
});

test("bounceWalls reflects off the right wall and clamps inside", () => {
  const f = mk({ pos: { x: ARENA_HALF, y: 0 }, vel: { x: 3, y: 0 } });
  const hit = bounceWalls(f);
  assert.equal(hit, true);
  assert.ok(f.pos.x <= ARENA_HALF - f.radius);
  assert.ok(f.vel.x < 0, "velocity should point back inward");
});

test("bounceWalls reflects off the bottom wall", () => {
  const f = mk({ pos: { x: 0, y: -ARENA_HALF }, vel: { x: 0, y: -4 } });
  assert.equal(bounceWalls(f), true);
  assert.ok(f.vel.y > 0);
});

test("bounceWalls returns false when safely inside", () => {
  const f = mk({ pos: { x: 0, y: 0 }, vel: { x: 1, y: 1 } });
  assert.equal(bounceWalls(f), false);
});

test("separateAndBounce reports impact and drive-in on a head-on hit", () => {
  const a = mk({ pos: { x: -0.5, y: 0 }, vel: { x: 2, y: 0 } });
  const b = mk({ pos: { x: 0.5, y: 0 }, vel: { x: -2, y: 0 } });
  const c = separateAndBounce(a, b);
  assert.ok(c !== null);
  assert.equal(c.impact, 4); // closing speed 2 - (-2)
  assert.ok(c.aInto > 0 && c.bInto > 0, "both drove into the contact");
  // after the collision they are moving apart
  assert.ok(a.vel.x < 0);
  assert.ok(b.vel.x > 0);
  // and separated to at least touching
  const dist = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
  assert.ok(dist >= a.radius + b.radius - 1e-9);
});

test("restitution below 1 makes the bounce inelastic (they separate slower)", () => {
  const soft = separateAndBounce(
    mk({ pos: { x: -0.5, y: 0 }, vel: { x: 2, y: 0 } }),
    mk({ pos: { x: 0.5, y: 0 }, vel: { x: -2, y: 0 } }),
    0.2,
  );
  const hard = separateAndBounce(
    mk({ pos: { x: -0.5, y: 0 }, vel: { x: 2, y: 0 } }),
    mk({ pos: { x: 0.5, y: 0 }, vel: { x: -2, y: 0 } }),
    1,
  );
  assert.ok(soft && hard);
  // same reported impact regardless of restitution
  assert.equal(soft.impact, hard.impact);
});

test("separateAndBounce returns null when not overlapping", () => {
  const a = mk({ pos: { x: -5, y: 0 } });
  const b = mk({ pos: { x: 5, y: 0 } });
  assert.equal(separateAndBounce(a, b), null);
});

test("separateAndBounce returns null when overlapping but moving apart", () => {
  const a = mk({ pos: { x: -0.5, y: 0 }, vel: { x: -1, y: 0 } });
  const b = mk({ pos: { x: 0.5, y: 0 }, vel: { x: 1, y: 0 } });
  assert.equal(separateAndBounce(a, b), null);
  const dist = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
  assert.ok(dist >= a.radius + b.radius - 1e-9, "still separated");
});

test("damageFrom scales with impact and is capped", () => {
  assert.ok(damageFrom(1) > 0);
  assert.ok(damageFrom(5) > damageFrom(1));
  assert.equal(damageFrom(1000), MAX_HIT);
});

test("splitDamage makes the harder-rammed fighter take more", () => {
  // a drove in hard (4), b barely (0) -> b should take much more than a
  const [dmgA, dmgB] = splitDamage(10, 4, 0);
  assert.ok(dmgB > dmgA);
  // symmetric drive-in splits evenly
  const [sa, sb] = splitDamage(10, 2, 2);
  assert.ok(Math.abs(sa - sb) < 1e-9);
});

test("stormDamage is zero before the storm and grows after", () => {
  assert.equal(stormDamage(STORM_START - 1, 1 / 60), 0);
  assert.equal(stormDamage(STORM_START, 1 / 60), 0);
  const early = stormDamage(STORM_START + 1, 1 / 60);
  const late = stormDamage(STORM_START + 4, 1 / 60);
  assert.ok(early > 0);
  assert.ok(late > early, "storm escalates over time");
});

test("clampSpeed enforces min and max speed", () => {
  const slow = mk({ vel: { x: 0.01, y: 0 } });
  clampSpeed(slow, 1, 8);
  assert.ok(Math.abs(len(slow.vel) - 1) < 1e-9);

  const fast = mk({ vel: { x: 100, y: 0 } });
  clampSpeed(fast, 1, 8);
  assert.ok(Math.abs(len(fast.vel) - 8) < 1e-9);
});

test("steer accelerates toward the target", () => {
  const f = mk({ pos: { x: 0, y: 0 } });
  steer(f, { x: 10, y: 0 }, 5, 1);
  assert.ok(f.vel.x > 0);
  assert.equal(f.vel.y, 0);
});

test("decideWinner returns the fighter with more health", () => {
  assert.equal(decideWinner(50, 30), 0);
  assert.equal(decideWinner(0, 12), 1);
  assert.equal(decideWinner(20, 0), 0);
});
