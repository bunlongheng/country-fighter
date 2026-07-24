"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { MAX_HEALTH } from "@/lib/physics";
import { sound } from "@/lib/sound";
import { COUNTRIES, type Country } from "../data/countries";
import CountryPicker from "./CountryPicker";
import HealthBars from "./HealthBars";
import SoundToggle from "./SoundToggle";
import VictoryOverlay from "./VictoryOverlay";

// The 3D canvases are client-only (WebGL) and heavy, so they never render on the
// server and only load once the player needs them.
const MarblePreview = dynamic(() => import("./MarblePreview"), { ssr: false });
const Arena = dynamic(() => import("./Arena"), { ssr: false });

type Phase = "select" | "ready" | "fight" | "victory";

export default function Game() {
  const [phase, setPhase] = useState<Phase>("select");
  const [picks, setPicks] = useState<Country[]>([]);
  const [health, setHealth] = useState<[number, number]>([MAX_HEALTH, MAX_HEALTH]);
  const [winnerIdx, setWinnerIdx] = useState<0 | 1>(0);

  const toggle = useCallback((c: Country) => {
    setPicks((prev) => {
      if (prev.some((p) => p.code === c.code)) {
        sound.deselect();
        return prev.filter((p) => p.code !== c.code);
      }
      if (prev.length >= 2) return prev;
      sound.pick();
      return [...prev, c];
    });
  }, []);

  const randomize = useCallback(() => {
    const i = Math.floor(Math.random() * COUNTRIES.length);
    let j = Math.floor(Math.random() * COUNTRIES.length);
    while (j === i) j = Math.floor(Math.random() * COUNTRIES.length);
    sound.pick();
    setPicks([COUNTRIES[i], COUNTRIES[j]]);
  }, []);

  const onHealth = useCallback((ha: number, hb: number) => setHealth([ha, hb]), []);
  const onEnd = useCallback((w: 0 | 1) => {
    setWinnerIdx(w);
    setPhase("victory");
    sound.win();
  }, []);

  const startFight = () => {
    setHealth([MAX_HEALTH, MAX_HEALTH]);
    setPhase("fight");
    sound.start();
  };

  const reset = () => {
    sound.click();
    setPicks([]);
    setHealth([MAX_HEALTH, MAX_HEALTH]);
    setPhase("select");
  };

  const [a, b] = picks;

  return (
    <main className="relative mx-auto h-[100dvh] w-full max-w-5xl overflow-hidden">
      {phase === "select" && (
        <div className="flex h-full flex-col">
          <CountryPicker picks={picks} onToggle={toggle} onRandom={randomize} />
          {picks.length === 2 && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-black via-black/90 to-transparent p-5">
              <button
                onClick={() => {
                  sound.whoosh();
                  setPhase("ready");
                }}
                className="rise rounded-full bg-white px-10 py-3.5 text-base font-bold text-black transition hover:scale-105 active:scale-95"
              >
                {a.name} vs {b.name} →
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "ready" && a && b && (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-5">
          <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
            {[a, b].map((c, i) => (
              <div key={c.code} className="flex flex-col items-center">
                <div className="aspect-square w-full max-w-[220px]">
                  <MarblePreview code={c.code} hue={c.hue} />
                </div>
                <p className="mt-1 text-lg font-bold">{c.name}</p>
                <p className="text-xs text-white/40">
                  {i === 0 ? "Fighter 1" : "Fighter 2"}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40">Drag a marble to spin it</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                sound.click();
                setPhase("select");
              }}
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Change
            </button>
            <button
              onClick={startFight}
              className="rounded-full bg-white px-10 py-3 text-base font-bold text-black transition hover:scale-105 active:scale-95"
            >
              Fight!
            </button>
          </div>
        </div>
      )}

      {(phase === "fight" || phase === "victory") && a && b && (
        <div className="relative h-full w-full">
          <HealthBars a={a} b={b} healthA={health[0]} healthB={health[1]} />
          <Arena
            a={a}
            b={b}
            running={phase === "fight"}
            onHealth={onHealth}
            onEnd={onEnd}
          />
          {phase === "victory" && (
            <VictoryOverlay winner={picks[winnerIdx]} onRestart={reset} />
          )}
        </div>
      )}

      <SoundToggle />
    </main>
  );
}
