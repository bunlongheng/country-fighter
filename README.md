# Country Fighter

> Pick any 2 of the world's 194 countries and watch their glossy 3D flag-marbles battle it out in a bouncy arena. A tiny, playful game built for kids.

<p>
  <img alt="CI" src="https://github.com/bunlongheng/country-fighter/actions/workflows/ci.yml/badge.svg" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-brightgreen.svg" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
  <img alt="React Three Fiber" src="https://img.shields.io/badge/react--three--fiber-9-black?logo=three.js&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" />
</p>

**Live:** https://country-fighter-bheng.vercel.app

![Country picker](docs/screenshots/picker.png)

---

## What it does

1. **Pick 2 countries** from all 194 recognized countries (193 UN members + Vatican City), with instant search.
2. **Meet the fighters** - each country becomes a polished, freely-rotatable 3D marble wrapped in its flag. Drag to spin.
3. **Fight!** - both marbles enter a solid-walled arena and charge, bounce, and slam into each other with playful physics.
4. **Crown a champion** - every collision chips a health bar; when one empties, the winner is announced with a confetti victory screen. Start a new battle in one tap.

| Rotatable flag marbles | Live arena battle |
| --- | --- |
| ![Marbles](docs/screenshots/marbles.png) | ![Arena](docs/screenshots/arena.png) |

---

## How the fight works

The whole simulation is a small, **pure, unit-tested physics core** (`lib/physics.ts`) driven by a fixed-timestep loop inside the R3F render frame.

```mermaid
flowchart LR
  A[Charge toward<br/>opponent + jitter] --> B[Integrate + bounce<br/>off square walls]
  B --> C{Marbles<br/>overlap?}
  C -- yes --> D[Inelastic collision<br/>split damage by who<br/>rammed hardest]
  C -- no --> E[Storm backstop<br/>ramps after 9s]
  D --> F{A or B<br/>health = 0?}
  E --> F
  F -- yes --> G[Winner = higher<br/>remaining health]
  F -- no --> A
```

Three ideas keep the battles fun **and** reliable:

- **Asymmetric damage** - you take more damage the harder the *other* marble drove into you, so a clear winner emerges with a visible health gap instead of a coin-flip tie.
- **Real-time storm backstop** - an escalating drain starts after 9 seconds so no match can drag on if the marbles get unlucky and keep missing. It runs on wall-clock time, so a fight always ends in bounded real time even on a slow GPU.
- **Fixed-timestep sim** - collisions are stable and framerate-independent; the match clock never stretches or shortens with the frame rate.

Every one of these lives behind a pure function with tests (`tests/physics.test.ts`).

---

## Architecture

One static route mounts a small client state-machine that hands off between four screens. The heavy WebGL code is code-split so it never loads until a battle needs it, and the only stateful logic lives as pure, tested functions.

| Layer | Role |
| --- | --- |
| `app/page.tsx` + `layout.tsx` | Static server shell, metadata, font, icon |
| `Game.tsx` | Phase state machine: `select -> ready -> fight -> victory` |
| `components/*` | Picker, marble, arena, health bars, victory (one concern each) |
| `Arena.tsx` | The battle: fixed-timestep sim, walls, impact FX |
| `lib/physics.ts` | Pure, dependency-free, unit-tested simulation core |
| `data/countries.ts` | 194 countries (code, name, accent hue) |

The two 3D canvases (`MarblePreview`, `Arena`) are `next/dynamic` with `ssr: false`, so `three` / `drei` stay out of the server bundle and the first paint.

## Design decisions and trade-offs

| Decision | Chosen | Alternative | Why | Cost we accept |
| --- | --- | --- | --- | --- |
| Flags | Self-hosted PNGs | flagcdn / remote CDN | No third-party dependency; CSP stays `'self'` | 816KB committed to the repo |
| Reflections | Procedural in-scene env | HDR environment map | Network-free, CSP-clean glossy look | Slightly simpler reflections |
| Match ending | Real-time storm backstop | Pure collision KO | Every match provably terminates, even on a slow GPU | A late "sudden-death" drain phase |
| Physics engine | Hand-written pure core | rapier / cannon | Fully unit-testable, tiny, tunable for feel | No general rigid-body support |
| Winner rule | Higher remaining health | First to zero | A clear winner with a visible health gap, never a tie | Determinism over realism |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, static prerender) |
| UI runtime | React 19 |
| 3D | react-three-fiber 9 + drei 10 + three 0.185 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Tests | node:test (unit) + Playwright (e2e) |
| Hosting | Vercel |

The 194 flags are **self-hosted PNGs** (`public/flags/`), so the game has no third-party CDN dependency and its Content-Security-Policy stays locked to `'self'`. Marble reflections are generated procedurally in-scene, so no HDR environment map is ever fetched.

---

## Getting started

```bash
git clone https://github.com/bunlongheng/country-fighter.git
cd country-fighter
npm install
npm run dev            # http://localhost:3010
```

No environment variables are required - it is a fully static, self-contained game.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3010 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (typescript-eslint + next core-web-vitals) |
| `npm test` | Unit tests for the physics core + country data |
| `npm run test:e2e` | Playwright end-to-end smoke of the full game flow |

---

## Project structure

```
app/
  page.tsx              server shell
  components/
    Game.tsx            phase state machine: select -> ready -> fight -> victory
    CountryPicker.tsx   searchable 194-country grid
    MarblePreview.tsx   freely-rotatable single marble (R3F canvas)
    Marble.tsx          glossy flag sphere (shared)
    Arena.tsx           the battle: physics loop, walls, impact FX
    HealthBars.tsx      top HUD
    VictoryOverlay.tsx  winner + confetti
    Studio.tsx          lights + procedural reflections
  data/countries.ts     194 countries (code, name, accent hue)
lib/
  physics.ts            pure, tested simulation core
public/flags/           194 self-hosted flag PNGs
tests/                  unit tests (physics + data)
e2e/                    Playwright smoke test
```

---

## Testing

- **19 unit tests** cover the physics core (wall bounce, restitution, asymmetric damage split, storm backstop, speed clamps, winner logic) and the country data (exactly 194 unique codes, every country ships a flag).
- **4 Playwright e2e tests** cover the real user flow: load, search, pick two countries, run a full match to a winner, and restart.
- CI runs the full gate on every push and PR: `typecheck -> lint -> test -> build -> e2e`.

---

## Deploy

Pushing to `main` deploys to Vercel automatically. To deploy from the CLI:

```bash
vercel --prod
```

---

<div align="center">

<a href="https://bunlongheng.com"><img src="https://img.shields.io/badge/-bunlongheng.com-3A3A3C?style=for-the-badge&amp;labelColor=2A2A2C&amp;logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y%2BmAAADAFBMVEXx8vLq6v%2F19fX09PT8%2Ff309PT5%2BfnAwMBMaXHx8vL19fX5%2Bfny8vL09PT39%2Ff6%2Bfn6%2Bvr09PTx8fH4%2BPn%2F8vLy8%2FP09PTz8%2FPy8vL%2F%2F%2F%2Fz9PTz9PP19fby8vP19PXz8%2FT19%2Fb08%2FTx8vLy8vL09vby8%2FL29vf19fTv8PDz9vb7%2Bvn%2F%2Ff%2F9%2Ff3w8vH29fb%2F%2FP339%2Ff5%2Bfn59%2Ff19PT09PR7rao3VF3%2F%2Fv8AKDR6sqsBV1vv8fL4%2BPiux8b8%2Bvq90NDy8%2FR%2BlpppnZyZqrACLTxclZJSkI9en5ssZ2luqaUAeWgqbW4BX1gCfG0%2Fa3QaVG0MN0UKNUKUpKsGpYMAKjoRQ1UDf3AQRloJqIgEm32d0cUBg3ElbnQIln8eVWgrmIdP0KzF5d5s2acdfHwppJCP5MMXl4Tz8%2FLv8%2FP39%2FiewL5%2BqahYf4IrTFZkk5KlxsREiIYAHiqDnKFmnJowc3IdVllvpKK7zc3D2tnk5%2BmuycdwpKKuub2yv8Ly%2B%2FkAMT7z%2Bvjq7e09gH93q6kGdWpGgoJZmJSlw8M7c3WwyceTw76w1M8mYmpFfX8lW2AFOEpGiYhxqqRrqaRb2rdIsZ8AVE91jpU7d3t3saqBoKhako4AWVEcUlg3aWwDupAHb2YwmIkPP1ERSVA7WmZ8tq8HT14oZW%2BYuLsMl3wQT10ROksENUc8Z3MJSGVLh4dqpJ%2BXr7U51awUgHM4v6ad1MkPuJZAiowVd3IEhnZH0aoYrI05p5sDtYwkzZ8EPViYxsRel5USbHAIgmwIM0gQamzU4uF2malQi4oWQFQ1zaYrp4UXlYwfiHoyxqFE1q4qeX4yn5JIxKkdrX1b1rAbWGvd5Oh91sRijpomsJEVc3Ukc34dqIcwuJVKwZIXkoQZcXlNv5g%2BqZUZvpNl2rPG9N0WkIoNqouW4sVPwp%2BM0b6h0ssfq4d%2F1r8hpo%2Fh9e4AamUjnI9avaBixqgklYWSwL4xtItUxplYl5qZ58mq78wMgnYXfnlOmJaR1L%2Bj78ny9fS%2FrXQPAAAAFXRSTlP7Brvx%2FsJhAgD87r4U72C4uGH8vhRDodYHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC6UlEQVQokS2Sd3BUVRSHb0KS3QRCiZw5t%2By9j33zXjZkyUs2uekhEAi9dwRCL4JUEQRFAQUs9A4WOopKU0GpFoqCBZUivaqoFKkWLIS5GX7%2FfnPO78yZj%2Fj8UTViK6HggvNgSGuluEZRKbZqlN9H%2FFWiWUzIFQK5fhjOIRTDoqv4ia86S4q3KSByHdSqIhxofBKr5iNxLMm2bQqWVkorJ%2BAkO46nkQJhceSRmCTDvKJIJBLJzMxMLU6POJ4eBPF1KpNEbdt2Cms4LCcnZ%2FX6D3d%2BsKJJ7VSlNLoqgbjUtmkKKxlVmpf3bsFXW3d1b77gueJAQIPQBCilkMKemNi23Ts9T35%2FaMe2rsvmTypylGUFCSIYWJLXrm2nUwOPfNO5w%2B73Okxnjqe0JigQEL3JizoeONr%2F2u99vju4fd1rdZnyspQmnGvAUBprWNqz348%2FhXN%2F6P1%2By4Uvs%2FJkpRQRwpJBRVn7vf16Dfitz5XevQqWt3yalXtKaRIUQmglWfsu5y7%2BMrDs0TMftWo1ZVy64xioOVpcIdt8%2Fvqvf9%2F859KJsrLmrzA%2BOKC0IkFEtJza7JOfr%2FYd0P9G98tdOxe0Hp9qJrOIBgDuOeEtp%2F%2B4d%2FvWX%2F%2F9u%2B%2FtlaUTmOWZg7SQEEyuFe52%2BML9O3cZO%2F5xl06zn2VcadOJUqJTzt7a82XfP7sx9vmGNm1m1MstV4IHCVAAoTLqL1372ddn%2Fz%2B2v%2FWq12c1fSpsaeQWAZAANntxzuI3e3zbo8XGpm%2FMnNqiXrh%2BljaPd6UUabkjps19tdGnX2zKb9b4pTFDCzOMLmYtpW5h%2BpCRTeYtyV%2BT36zx808OL4xYGoFrkqDTbJpSXLdRgwbPZL%2BQnT129OOPFVEEsAMJpHKdeKMJgJSAiALdjJANQKnRJI4R6boAKEwLCiGoBBegQjBftQo1KQWOlplFKSV9qGaF1NpAE7QQESTlMSy6pp%2F4%2FFFVYxMNRBTaiM0tkImxNaL8vgfDR8gvoYRaxgAAAABJRU5ErkJggg%3D%3D" alt="bunlongheng.com"></a>
<a href="https://www.linkedin.com/in/bunlongheng/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://www.instagram.com/ibunlong/"><img src="https://img.shields.io/badge/Instagram-C13584?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
<a href="mailto:bheng.code@gmail.com"><img src="https://img.shields.io/badge/Email-2E7D32?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"></a>

<br>

Built by **[Bunlong](https://bunlongheng.com)** &nbsp;&middot;&nbsp; [more apps](https://bunlongheng.com/projects)

</div>
