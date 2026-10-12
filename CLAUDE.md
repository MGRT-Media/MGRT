# MGRT Media — Project Instructions

The MGRT Media website: a scroll-driven, cinematic Three.js homepage plus plain internal pages (`/work`, `/about`, `/contact`).

## Current work: the Creative Table redesign

The branch `redesign/creative-table` replaces the Greek-room journey with **MGRT Creative Table**, a photoreal warm studio with a walnut table and physical MGRT MEDIA wall lettering.

- **`main` is production and must not be modified.** All redesign work happens on `redesign/creative-table`. Confirm the branch before editing.
- The existing Greek-room experience must keep working on this branch until the replacement scene is approved. Do not delete its source or assets before the cutover phase.
- Work one approved phase at a time and stop for review at the end of each. See `docs/build-workflow.md`.

## Read before implementing

1. `docs/build-status.md` — current phase, approved scope, open decisions
2. `docs/creative-table-spec.md` — creative direction and the six-stage sequence (source of truth for what the visitor sees)
3. `docs/technical-architecture.md` — how it is built, and the measured findings that must not be re-learned
4. `docs/build-workflow.md` — phases, review gates, testing

`docs/archive/greek-room/` is the previous experience's documentation. It is history and a source of detailed measurements, not instructions.

## Commands

```bash
npm run dev       # Vite dev server, port 5173
npm run build     # production build into dist/
npm run preview   # serve the production build
```

There is no test runner or linter. Verification is the build, the browser console, and visual checks in the running scene (`.claude/launch.json` defines `mgrt-dev` and `mgrt-preview`).

## Stack

Vite 5, React 18, react-three-fiber 8, three 0.169, GSAP ScrollTrigger, Lenis. Plain CSS with custom properties in `src/styles/global.css`. Deployed on Vercel.

Do not add dependencies without a stated reason. Asset-pipeline tools (`sharp`, `@gltf-transform/*`) are installed with `--no-save` when a script in `scripts/` needs them; they do not belong in `package.json`.

## Rules that are easy to break

- **Scroll progress never goes through React state.** It lives in mutable module objects (`timeline/journeyProgress.js`) and is read inside `useFrame`.
- **Lights and materials read progress through `contentValue()`** (`timeline/contentProgress.js`), so they blend correctly during direct navigation.
- **No per-frame allocation.** Reuse module-level scratch vectors and quaternions.
- **Camera poses, light levels and stage positions are data**, defined in the central layout and beat modules, never as literals inside components.
- **Everything homepage-only stays behind the lazy `Home` import**, so internal pages never download Three.js.
- **The preload hints (`loading/heroAssets.js`) and the preflight (`loading/criticalAssets.js`) must list the same files.** A dev-only console warning reports any mismatch.
- **Re-run `scripts/capture-opening.mjs` whenever the opening frame changes**, or the startup cover will not match the live scene.
- **Never fill an empty texture slot, change `scene.environment`'s identity, or upload several textures in one frame after the reveal.** Each causes a measured frame stall; see the architecture doc.
