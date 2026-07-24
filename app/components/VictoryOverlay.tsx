"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { Country } from "../data/countries";

// Deterministic-ish confetti: positions come from the index so we never need a
// hydration-sensitive random on first paint.
const CONFETTI = Array.from({ length: 42 }, (_, i) => i);

export default function VictoryOverlay({
  winner,
  onRestart,
}: {
  winner: Country;
  onRestart: () => void;
}) {
  // Gold confetti: vary lightness/saturation around a warm gold hue only.
  const pieces = useMemo(
    () =>
      CONFETTI.map((i) => ({
        left: (i * 61) % 100,
        delay: (i % 12) * 0.12,
        color: `hsl(${44 + (i % 5) * 4}, ${75 + (i % 4) * 6}%, ${52 + (i % 6) * 6}%)`,
        dur: 1.8 + (i % 5) * 0.35,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute top-[-10%] block h-2.5 w-2.5 rounded-sm"
            style={{
              left: `${p.left}%`,
              background: p.color,
              animation: `confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(0.3,0.1,0.3,1) infinite`,
            }}
          />
        ))}
      </div>

      <div className="pop flex flex-col items-center">
        <div
          className="relative rounded-2xl p-2"
          style={{ boxShadow: `0 0 60px hsl(${winner.hue},85%,50%)` }}
        >
          <Image
            src={`/flags/${winner.code}.png`}
            alt={winner.name}
            width={160}
            height={106}
            className="floaty h-24 w-36 rounded-xl object-cover sm:h-28 sm:w-44"
            priority
          />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
          Winner
        </p>
        <h2 className="mt-1 text-4xl font-bold sm:text-5xl">{winner.name}</h2>
        <button
          onClick={onRestart}
          className="mt-8 rounded-full bg-white px-8 py-3 text-base font-bold text-black transition hover:scale-105 active:scale-95"
        >
          New Battle
        </button>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          .absolute span { animation: none !important; display: none; }
        }
      `}</style>
    </div>
  );
}
