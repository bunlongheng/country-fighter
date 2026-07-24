"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import Marble from "./Marble";
import Studio from "./Studio";
import {
  ARENA_HALF,
  HIT_THRESHOLD,
  MARBLE_RADIUS,
  MAX_HEALTH,
  PROJECTILE_DAMAGE,
  PROJECTILE_LIFE,
  PROJECTILE_RADIUS,
  PROJECTILE_SPEED,
  SHOOT_COOLDOWN,
  aimVelocity,
  bounceWalls,
  clampSpeed,
  damageFrom,
  decideWinner,
  integrate,
  projectileHits,
  separateAndBounce,
  splitDamage,
  steer,
  stormDamage,
  type Fighter,
} from "@/lib/physics";
import { sound } from "@/lib/sound";
import type { Country } from "../data/countries";

const MIN_SPEED = 3.5; // faster, more aggressive floor speed
const MAX_SPEED = 9.5;
const CHARGE = 28; // acceleration toward the opponent (harder charging)
const JITTER = 5; // random wander so paths vary and a winner always emerges
const HIT_COOLDOWN = 0.14; // min seconds between scored hits
const WALL_H = 1.2;
const RINGS = 8; // impact-ring pool size
const PROJECTILES = 14; // flare pool size
const PROJ_Y = 0.9; // height flares travel at
const STEP = 1 / 60; // fixed physics timestep (seconds)
const MAX_STEPS = 6; // cap substeps per frame so a stall can't spiral

type Impact = { x: number; z: number; life: number; hue: number };
type Flare = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  from: 0 | 1;
  life: number;
  hue: number;
};

// Random launch direction so neither side has a systematic edge.
function makeFighter(x: number): Fighter {
  const a = Math.random() * Math.PI * 2;
  return {
    pos: { x, y: 0 },
    vel: { x: Math.cos(a) * 3, y: Math.sin(a) * 3 },
    radius: MARBLE_RADIUS,
    health: MAX_HEALTH,
  };
}

function Scene({
  a,
  b,
  running,
  onHealth,
  onEnd,
}: {
  a: Country;
  b: Country;
  running: boolean;
  onHealth: (ha: number, hb: number) => void;
  onEnd: (winnerIndex: 0 | 1) => void;
}) {
  const meshA = useRef<THREE.Mesh>(null);
  const meshB = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const projRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flashRef = useRef<THREE.PointLight>(null);
  const shakeGroup = useRef<THREE.Group>(null);

  // Simulation state lives in refs so the physics loop never triggers a render.
  const sim = useRef({
    fa: makeFighter(-2.6),
    fb: makeFighter(2.6),
    punchA: 0,
    punchB: 0,
    shake: 0,
    flash: 0,
    acc: 0,
    elapsed: 0,
    cool: 0,
    bounceCool: 0,
    shootA: 0.9,
    shootB: 0.9,
    impacts: [] as Impact[],
    flares: [] as Flare[],
    ended: false,
  });

  // Keep the latest callbacks without re-subscribing the frame loop.
  const cbs = useRef({ onHealth, onEnd });
  cbs.current = { onHealth, onEnd };

  useEffect(() => {
    // Fresh match whenever the fighters change.
    sim.current.fa = makeFighter(-2.6);
    sim.current.fb = makeFighter(2.6);
    sim.current.impacts = [];
    sim.current.flares = [];
    sim.current.acc = 0;
    sim.current.elapsed = 0;
    sim.current.cool = 0;
    sim.current.bounceCool = 0;
    sim.current.shootA = 0.9;
    sim.current.shootB = 0.9;
    sim.current.ended = false;
    cbs.current.onHealth(MAX_HEALTH, MAX_HEALTH);
  }, [a.code, b.code]);

  useFrame((_, rawDelta) => {
    const s = sim.current;
    const dt = Math.min(rawDelta, 1 / 30);
    const { fa, fb } = s;

    // The physics runs on a fixed-timestep accumulator (stable collisions), but
    // the match clock and the storm backstop run on *real* wall-clock time. That
    // guarantees a fight always ends in bounded real time even if the GPU is so
    // starved it barely renders a frame - the storm can't stall behind the sim.
    if (running && !s.ended) {
      // Bound generously so the match clock still tracks real wall-clock time
      // under a very low frame rate (e.g. software-GL CI), while a huge
      // tab-switch delta still converges over a couple of frames.
      const realDt = Math.min(rawDelta, 2);
      s.elapsed += realDt;

      let dmgA = 0;
      let dmgB = 0;

      s.acc += Math.min(rawDelta, 0.25);
      let steps = 0;
      while (s.acc >= STEP && steps < MAX_STEPS) {
        s.acc -= STEP;
        steps++;
        s.cool -= STEP;
        s.bounceCool -= STEP;

        // Charge at each other with a splash of random wander.
        steer(fa, fb.pos, CHARGE, STEP);
        steer(fb, fa.pos, CHARGE, STEP);
        fa.vel.x += (Math.random() - 0.5) * JITTER * STEP;
        fa.vel.y += (Math.random() - 0.5) * JITTER * STEP;
        fb.vel.x += (Math.random() - 0.5) * JITTER * STEP;
        fb.vel.y += (Math.random() - 0.5) * JITTER * STEP;

        integrate(fa, STEP);
        integrate(fb, STEP);
        const wallA = bounceWalls(fa);
        const wallB = bounceWalls(fb);
        if ((wallA || wallB) && s.bounceCool <= 0) {
          s.bounceCool = 0.09;
          sound.bounce();
        }
        clampSpeed(fa, MIN_SPEED, MAX_SPEED);
        clampSpeed(fb, MIN_SPEED, MAX_SPEED);

        const hit = separateAndBounce(fa, fb);
        if (hit !== null && hit.impact > HIT_THRESHOLD && s.cool <= 0) {
          s.cool = HIT_COOLDOWN;
          const [dA, dB] = splitDamage(damageFrom(hit.impact), hit.aInto, hit.bInto);
          dmgA += dA;
          dmgB += dB;

          const cx = (fa.pos.x + fb.pos.x) / 2;
          const cz = (fa.pos.y + fb.pos.y) / 2;
          s.impacts.push({ x: cx, z: cz, life: 1, hue: dA > dB ? a.hue : b.hue });
          if (s.impacts.length > RINGS) s.impacts.shift();
          s.punchA = s.punchB = 1;
          s.shake = Math.min(0.5, hit.impact * 0.05);
          s.flash = 1;
          sound.hit(hit.impact);
        }

        // Fire flares at each other on a cooldown.
        s.shootA -= STEP;
        s.shootB -= STEP;
        if (s.shootA <= 0) {
          s.shootA = SHOOT_COOLDOWN;
          const v = aimVelocity(fa.pos, fb.pos, PROJECTILE_SPEED);
          s.flares.push({ x: fa.pos.x, y: fa.pos.y, vx: v.x, vy: v.y, from: 0, life: PROJECTILE_LIFE, hue: a.hue });
          sound.shoot();
        }
        if (s.shootB <= 0) {
          s.shootB = SHOOT_COOLDOWN;
          const v = aimVelocity(fb.pos, fa.pos, PROJECTILE_SPEED);
          s.flares.push({ x: fb.pos.x, y: fb.pos.y, vx: v.x, vy: v.y, from: 1, life: PROJECTILE_LIFE, hue: b.hue });
          sound.shoot();
        }

        // Advance flares; a hit chips the target and spawns a spark.
        for (const p of s.flares) {
          if (p.life <= 0) continue;
          p.x += p.vx * STEP;
          p.y += p.vy * STEP;
          p.life -= STEP;
          const target = p.from === 0 ? fb : fa;
          if (projectileHits(p.x, p.y, PROJECTILE_RADIUS, target)) {
            p.life = 0;
            if (p.from === 0) dmgB += PROJECTILE_DAMAGE;
            else dmgA += PROJECTILE_DAMAGE;
            s.impacts.push({ x: p.x, z: p.y, life: 1, hue: p.hue });
            if (s.impacts.length > RINGS) s.impacts.shift();
            s.flash = Math.max(s.flash, 0.6);
            sound.zap();
          } else if (Math.abs(p.x) > ARENA_HALF + 0.3 || Math.abs(p.y) > ARENA_HALF + 0.3) {
            p.life = 0;
          }
        }
        if (s.flares.length > PROJECTILES) s.flares = s.flares.slice(-PROJECTILES);
      }
      if (steps >= MAX_STEPS) s.acc = 0; // drop backlog after a long stall
      s.flares = s.flares.filter((p) => p.life > 0);

      // Storm backstop, on real time so it fires even when frames are scarce.
      const storm = stormDamage(s.elapsed, realDt);
      dmgA += storm;
      dmgB += storm;

      if (dmgA > 0 || dmgB > 0) {
        const preA = fa.health - dmgA;
        const preB = fb.health - dmgB;
        fa.health = Math.max(0, preA);
        fb.health = Math.max(0, preB);
        cbs.current.onHealth(Math.round(fa.health), Math.round(fb.health));

        if (fa.health <= 0 || fb.health <= 0) {
          s.ended = true;
          cbs.current.onEnd(decideWinner(preA, preB));
        }
      }
    }

    // Sync marble positions (physics y maps to world z; marbles rest on floor).
    if (meshA.current) {
      meshA.current.position.set(fa.pos.x, MARBLE_RADIUS, fa.pos.y);
      const p = 1 + s.punchA * 0.25;
      meshA.current.scale.setScalar(THREE.MathUtils.lerp(meshA.current.scale.x, p, 0.4));
      meshA.current.rotation.y += dt * 2;
    }
    if (meshB.current) {
      meshB.current.position.set(fb.pos.x, MARBLE_RADIUS, fb.pos.y);
      const p = 1 + s.punchB * 0.25;
      meshB.current.scale.setScalar(THREE.MathUtils.lerp(meshB.current.scale.x, p, 0.4));
      meshB.current.rotation.y -= dt * 2;
    }
    s.punchA = Math.max(0, s.punchA - dt * 4);
    s.punchB = Math.max(0, s.punchB - dt * 4);

    // Impact rings: grow + fade.
    for (let i = 0; i < RINGS; i++) {
      const ring = ringRefs.current[i];
      const imp = s.impacts[i];
      if (!ring) continue;
      if (imp && imp.life > 0) {
        imp.life -= dt * 2.2;
        const t = 1 - Math.max(0, imp.life);
        ring.visible = true;
        ring.position.set(imp.x, 0.05, imp.z);
        ring.scale.setScalar(0.3 + t * 3.2);
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, imp.life) * 0.7;
        mat.color.setHSL(imp.hue / 360, 0.9, 0.6);
      } else {
        ring.visible = false;
      }
    }

    // Flares: glowing spheres flying between the marbles.
    for (let i = 0; i < PROJECTILES; i++) {
      const mesh = projRefs.current[i];
      const p = s.flares[i];
      if (!mesh) continue;
      if (p && p.life > 0) {
        mesh.visible = true;
        mesh.position.set(p.x, PROJ_Y, p.y);
        const pulse = 0.8 + 0.3 * Math.sin(p.life * 30);
        mesh.scale.setScalar(pulse);
        (mesh.material as THREE.MeshBasicMaterial).color.setHSL(p.hue / 360, 0.95, 0.62);
      } else {
        mesh.visible = false;
      }
    }

    // Flash light on impact.
    if (flashRef.current) {
      flashRef.current.intensity = s.flash * 40;
      const c = fa.health < fb.health ? b.hue : a.hue;
      flashRef.current.color.setHSL(c / 360, 0.9, 0.6);
    }
    s.flash = Math.max(0, s.flash - dt * 5);

    // Impact shake jitters the arena group (not the camera) so it never fights
    // the player's orbit control of the view.
    if (shakeGroup.current) {
      shakeGroup.current.position.set(
        (Math.random() - 0.5) * s.shake,
        0,
        (Math.random() - 0.5) * s.shake,
      );
    }
    s.shake = Math.max(0, s.shake - dt * 2);
  });

  const wallMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#12151c",
        roughness: 0.25,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        emissive: new THREE.Color("#1b2130"),
        emissiveIntensity: 0.4,
      }),
    [],
  );

  const walls = ARENA_HALF + 0.15;
  return (
    <>
      <Studio />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={9}
        maxDistance={24}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.15}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0.4, 0]}
      />

      <group ref={shakeGroup}>
      <pointLight ref={flashRef} position={[0, 2, 0]} intensity={0} distance={16} />

      {/* Arena floor */}
      <RoundedBox
        args={[ARENA_HALF * 2 + 0.6, 0.4, ARENA_HALF * 2 + 0.6]}
        radius={0.18}
        smoothness={4}
        position={[0, -0.2, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#0a0c11" roughness={0.9} metalness={0.1} />
      </RoundedBox>
      {/* Inner floor glow tile */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[ARENA_HALF * 2, ARENA_HALF * 2]} />
        <meshBasicMaterial color="#0d1017" />
      </mesh>

      {/* Solid boundary walls */}
      {[
        { p: [0, WALL_H / 2 - 0.2, walls] as const, s: [ARENA_HALF * 2 + 0.6, WALL_H, 0.3] as const },
        { p: [0, WALL_H / 2 - 0.2, -walls] as const, s: [ARENA_HALF * 2 + 0.6, WALL_H, 0.3] as const },
        { p: [walls, WALL_H / 2 - 0.2, 0] as const, s: [0.3, WALL_H, ARENA_HALF * 2 + 0.6] as const },
        { p: [-walls, WALL_H / 2 - 0.2, 0] as const, s: [0.3, WALL_H, ARENA_HALF * 2 + 0.6] as const },
      ].map((w, i) => (
        <mesh key={i} position={w.p} material={wallMat} castShadow receiveShadow>
          <boxGeometry args={w.s} />
        </mesh>
      ))}

      {/* Impact ring pool */}
      {Array.from({ length: RINGS }).map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            ringRefs.current[i] = m;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.55, 0.75, 48]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Flare (projectile) pool - bright additive glowing orbs */}
      {Array.from({ length: PROJECTILES }).map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            projRefs.current[i] = m;
          }}
          visible={false}
        >
          <sphereGeometry args={[PROJECTILE_RADIUS, 16, 16]} />
          <meshBasicMaterial
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      <Suspense fallback={null}>
        <Marble ref={meshA} code={a.code} hue={a.hue} />
        <Marble ref={meshB} code={b.code} hue={b.hue} />
      </Suspense>
      </group>
    </>
  );
}

export default function Arena(props: {
  a: Country;
  b: Country;
  running: boolean;
  onHealth: (ha: number, hb: number) => void;
  onEnd: (winnerIndex: 0 | 1) => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 12.5, 6.5], fov: 45 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#000000"]} />
      <Scene {...props} />
    </Canvas>
  );
}
