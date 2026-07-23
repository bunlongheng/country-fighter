"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { COUNTRIES, type Country } from "../data/countries";

export default function CountryPicker({
  picks,
  onToggle,
}: {
  picks: Country[];
  onToggle: (c: Country) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(s));
  }, [q]);

  const pickedCodes = new Set(picks.map((p) => p.code));

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Country Fighter
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {picks.length === 0
            ? "Pick 2 countries to battle"
            : picks.length === 1
              ? "Pick 1 more"
              : "Ready to fight!"}
        </p>
      </div>

      <div className="px-5 pt-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 194 countries…"
          aria-label="Search countries"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none transition focus:border-white/30"
        />
      </div>

      <div className="mt-4 grid flex-1 grid-cols-3 content-start gap-2.5 overflow-y-auto px-5 pb-28 sm:grid-cols-4 md:grid-cols-6">
        {filtered.map((c) => {
          const active = pickedCodes.has(c.code);
          return (
            <button
              key={c.code}
              onClick={() => onToggle(c)}
              aria-pressed={active}
              className={`group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition ${
                active
                  ? "border-white/60 bg-white/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
              }`}
              style={
                active
                  ? { boxShadow: `0 0 0 1px hsl(${c.hue},85%,55%), 0 0 18px hsl(${c.hue},85%,45%)` }
                  : undefined
              }
            >
              <Image
                src={`/flags/${c.code}.png`}
                alt={c.name}
                width={64}
                height={42}
                className="h-9 w-full rounded-md object-cover"
                loading="lazy"
              />
              <span className="line-clamp-1 text-center text-[11px] leading-tight text-white/70">
                {c.name}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-white/40">
            No country matches “{q}”.
          </p>
        )}
      </div>
    </div>
  );
}
