// Tiny Web Audio sound engine. Every effect is synthesised at runtime, so the
// game ships zero audio files - no CDN, no licensing, and the CSP stays locked
// to 'self'. All calls are wrapped so audio can never throw and break the game.

// Pure, testable mapping from a collision's closing speed to its thud's tone:
// harder hits are louder, brighter, and a touch longer.
export function impactToSound(impact: number): {
  freq: number;
  gain: number;
  dur: number;
} {
  const t = Math.max(0, Math.min(1, impact / 12));
  return {
    freq: 90 + t * 170,
    gain: 0.18 + t * 0.5,
    dur: 0.11 + t * 0.14,
  };
}

const STORE_KEY = "cf-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

if (typeof window !== "undefined") {
  muted = window.localStorage?.getItem(STORE_KEY) === "1";
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ctx.destination);
      // A short white-noise buffer reused for percussive hits.
      const len = Math.floor(ctx.sampleRate * 0.3);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// A single enveloped oscillator note.
function tone(o: {
  type: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  delay?: number;
}) {
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.from, t0);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

// A percussive noise burst through a lowpass, plus a sine body - the "thud".
function thud(freq: number, gain: number, dur: number) {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const t0 = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(freq * 6, t0);
  const ng = c.createGain();
  ng.gain.setValueAtTime(gain, t0);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp);
  lp.connect(ng);
  ng.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);

  tone({ type: "sine", from: freq * 1.6, to: freq * 0.6, dur: dur * 0.9, gain: gain * 0.8 });
}

export const sound = {
  // Bright confirming blip when a country is selected.
  pick() {
    tone({ type: "triangle", from: 620, to: 940, dur: 0.09, gain: 0.22 });
  },
  // Lower blip when a country is de-selected.
  deselect() {
    tone({ type: "triangle", from: 520, to: 320, dur: 0.09, gain: 0.18 });
  },
  // Small UI click for buttons / transitions.
  click() {
    tone({ type: "square", from: 440, to: 560, dur: 0.05, gain: 0.12 });
  },
  // Airy sweep when moving into the ready screen.
  whoosh() {
    tone({ type: "sawtooth", from: 220, to: 720, dur: 0.28, gain: 0.12 });
  },
  // Energetic "fight!" sting: a rising sweep plus a kick.
  start() {
    tone({ type: "sawtooth", from: 180, to: 780, dur: 0.34, gain: 0.16 });
    thud(150, 0.5, 0.22);
    tone({ type: "square", from: 880, to: 1200, dur: 0.12, gain: 0.14, delay: 0.22 });
  },
  // Collision, scaled by the closing speed.
  hit(impact: number) {
    const s = impactToSound(impact);
    thud(s.freq, s.gain, s.dur);
  },
  // Soft tick when a marble bounces off a wall.
  bounce() {
    tone({ type: "square", from: 260, to: 180, dur: 0.045, gain: 0.06 });
  },
  // Firing a flare - a quick rising laser blip.
  shoot() {
    tone({ type: "sawtooth", from: 680, to: 1300, dur: 0.12, gain: 0.1 });
  },
  // A flare connecting - a crunchy zap.
  zap() {
    thud(240, 0.32, 0.1);
    tone({ type: "square", from: 900, to: 300, dur: 0.1, gain: 0.12 });
  },
  // Happy little arpeggio on victory.
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) =>
      tone({ type: "triangle", from: f, dur: 0.16, gain: 0.2, delay: i * 0.12 }),
    );
    thud(120, 0.4, 0.3);
  },

  isMuted() {
    return muted;
  },
  setMuted(m: boolean) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.01);
    if (typeof window !== "undefined") window.localStorage?.setItem(STORE_KEY, m ? "1" : "0");
    listeners.forEach((fn) => fn(m));
  },
  toggle() {
    // First toggle also unlocks the audio context inside the user gesture.
    ensure();
    this.setMuted(!muted);
    return muted;
  },
  subscribe(fn: (m: boolean) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
