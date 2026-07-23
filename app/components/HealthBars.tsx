"use client";

import Image from "next/image";
import type { Country } from "../data/countries";
import { MAX_HEALTH } from "@/lib/physics";

function Bar({
  country,
  health,
  align,
}: {
  country: Country;
  health: number;
  align: "left" | "right";
}) {
  const pct = Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100));
  const color = `hsl(${country.hue}, 85%, 55%)`;
  const flag = (
    <Image
      src={`/flags/${country.code}.png`}
      alt={country.name}
      width={44}
      height={30}
      className="h-6 w-9 rounded object-cover shadow"
      priority
    />
  );
  return (
    <div className={`flex-1 ${align === "right" ? "items-end text-right" : ""}`}>
      <div
        className={`mb-1.5 flex items-center gap-2 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {flag}
        <span className="truncate text-sm font-semibold sm:text-base">
          {country.name}
        </span>
        <span className="tnum ml-auto text-xs text-white/50">
          {Math.round(pct)}
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label={`${country.name} health`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{
            width: `${pct}%`,
            marginLeft: align === "right" ? "auto" : undefined,
            background: `linear-gradient(90deg, ${color}, hsl(${country.hue}, 90%, 68%))`,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

export default function HealthBars({
  a,
  b,
  healthA,
  healthB,
}: {
  a: Country;
  b: Country;
  healthA: number;
  healthB: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-4 p-4 sm:gap-8 sm:p-6">
      <Bar country={a} health={healthA} align="left" />
      <div className="mt-4 shrink-0 text-lg font-bold text-white/30">VS</div>
      <Bar country={b} health={healthB} align="right" />
    </div>
  );
}
