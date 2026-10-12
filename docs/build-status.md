# MGRT Creative Table — Build Status

The current state of the redesign. Read this first, every session. Keep it short: Git history is the change log.

---

## 1. Current state

| | |
|---|---|
| **Project** | MGRT Creative Table, replacing the Greek-room homepage |
| **Branch** | `redesign/creative-table` |
| **Branched from** | `main` at `112f5a3` (2026-10-12) |
| **Current phase** | 1 — Foundations |
| **Phase status** | TECHNICALLY COMPLETE, awaiting review |
| **Approved scope** | Phase 1 only. No table contents, detailed modelling, materials, new assets or dependencies. |
| **Next phase** | 2 — Blockout and framing. Not approved to start. |
| **View the new scene** | `npm run dev`, then `http://localhost:5173/?scene=creative-table` |

`main` is production (mgrtmedia.com) and is unchanged.

---

## 2. Phase progress

```text
0  Documentation                        APPROVED (2026-10-12)
1  Foundations                          TECHNICALLY COMPLETE
2  Blockout and framing                 NOT STARTED
3  Visual development (light+material)  NOT STARTED
4  Table population                     NOT STARTED
5  Interaction                          NOT STARTED
6  Loading and startup                  NOT STARTED
7  Performance, Safari, accessibility   NOT STARTED
8  Cutover and cleanup                  NOT STARTED
```

Phase definitions and review gates are in `build-workflow.md` §3.

Status values: NOT STARTED, IN PROGRESS, TECHNICALLY COMPLETE (built and tested, not yet reviewed), APPROVED, BLOCKED, DEFERRED.

---

## 3. Approved decisions

Approved 2026-10-12, at the audit review. These are protected; raise any conflict before changing one.

**Creative**

- Warm cinematic production environment; art-directed and photographed, not procedurally assembled.
- Table layout: Film left, MGRT centre (architectural project sheet, creative sketches, subtle identity card), Digital right. Naturally composed, not symmetrical.
- Physical MGRT MEDIA lettering on the wall behind the table.

**Lettering**

- Custom GLB derived from the exact existing wordmark. Original typography and proportions. No substitute font.
- Shallow extrusion, subtle bevel, brushed dark metal or aged bronze.

**Materials**

- Scanned PBR textures for plaster and walnut tabletop. Believable roughness, normal detail, real scale and variation over exaggerated displacement.
- Existing texture-loading optimisations retained; assets compressed and sized appropriately.

**Sequence**

- Six stages: 0 dim, 1 lettering lit, 2 table revealed, 3 Film, 4 Digital, 5 return to overview.
- Direct navigation between Film, Digital and Overview without replaying the opening (built in phase 5).

**Camera**

- Existing damped rig kept where appropriate.
- No complex paths until room proportions and framing are validated.
- Opening frame shows the wall identity with the table in the foreground. The second reveal moves naturally into an elevated three-quarter view of the whole table.
- Movement restrained, physically motivated, relatively quick.

**Architecture**

- Camera poses, lighting states and transitions configured through central layout and beat definitions.
- Video and project presentation systems preserved, not integrated until the collections are populated.
- Lighting and materials developed as one phase. Dedicated table-population and interaction phases.

---

**Confirmed at the Phase 0 review (2026-10-12)**

- Scenes coexist behind a selector, `?scene=creative-table`. The original stays the default, including on production. Only the selected scene mounts and loads.
- One intentional gesture per stage; scrolling up reverses. The old automatic intro, timed holds, scroll locks and automatic final transition are removed from the new experience only.
- Lighting interpolates smoothly between stages.
- The wall lettering keeps the stacked MGRT / MEDIA arrangement, derived from the existing Cormorant Medium styling and spacing, with shallow depth, realistic bevels and slight separation from the wall.

---

## 4. Open decisions

These need an answer before the phase shown.

| # | Decision | Needed by |
|---|---|---|
| 1 | **The page does not scroll in the new scene.** Stages are driven by wheel, touch and keyboard gestures directly, with no scroll position behind them. See §8, Phase 1. This is a change from the plan in the Phase 0 architecture doc and needs your confirmation. | Phase 2 |
| 2 | **Should the selector work on production builds?** It currently does (it is how the production build was tested). It can be limited to development if you prefer. | Phase 8 at the latest |
| 3 | **Who authors the lettering GLB.** Outlines come from Cormorant Medium (confirmed). It still needs a modelling tool or a one-off script with `--no-save` packages, and the Cormorant font file, which is not in the repository. | Phase 3 |
| 4 | **Texture sources.** Which scanned plaster and walnut sets. Selected in Phase 3; downloading third-party files needs approval per file. | Phase 3 |
| 5 | **Lettering finish.** Brushed dark metal or aged bronze, decided on screen. | Phase 3 |
| 6 | **Table contents.** Source material for the project sheet, sketches, identity card and both collections. | Phase 4 |

---

## 5. Note: the wordmark has no source file

**Resolved 2026-10-12:** derive it from the existing Cormorant Medium styling and spacing (option 2 below). Kept for the detail Phase 3 will need.

The approved direction is a GLB derived from the exact existing wordmark. The audit found:

- There is no SVG, AI, EPS or font file for the wordmark anywhere in the repository or `asset-sources/`.
- The wall wordmark is drawn at runtime as text: **Cormorant, weight 500**, two lines, `MGRT` with 0.22 em tracking and `MEDIA` with 0.36 em tracking (`src/experience/architecture/wallInscription.js`).
- Cormorant is loaded from Google Fonts. No font file is stored locally.

So "the exact wordmark" currently means Cormorant Medium with those tracking and line proportions. Two ways forward:

1. **You supply the brand's vector wordmark** (SVG or AI). This is the reliable route if a designed logo exists outside the codebase.
2. **Derive the outlines from Cormorant Medium** using the existing tracking and proportions. Cormorant is licensed under the SIL Open Font License, which permits this. It reproduces what the site shows today.

Either way the GLB has to be authored in a modelling tool (extrusion and bevel), or generated by a one-off script using `--no-save` pipeline packages. Neither adds an app dependency.

---

## 6. Known issues

| Issue | Severity | Action | Target |
|---|---|---|---|
| Safari cuts the reveal crossfade short, reading as a slight pop | Low | Likely fix: Web Animations API for the fade | Phase 7 |
| No testing on a real iPhone or iPad; mobile figures are Chrome emulation | Medium | Test on devices | Phase 7 |
| `npm audit` moderate advisory in esbuild / Vite dev server (GHSA-67mh-4wv8-2f99) | Low | Needs a Vite major upgrade; dev server only | Deferred |
| `@react-three/drei` is installed but unused | Low | Remove | Phase 8 |
| `/favicon.ico` returns 404 | Low | Add a favicon | Phase 8 |
| 22 source comments cite the archived docs by their old path | Low | Comments only; resolved when Greek-room code is removed | Phase 8 |
| Startup cover images show the Greek room | Expected | Re-capture from the new scene | Phase 6 |
| The new scene still downloads the old opening image (38 to 157 kB, hidden) because it is in the HTML before any script runs | Low | Goes away when the cover is re-captured | Phase 6 |
| New scene is not framed for portrait viewports; the overview crops the table there, and the other stages are not fitted at any aspect | Expected | Per-aspect framing | Phase 2 |
| Wheel-gesture detection is untested on a real trackpad or touch device; only synthetic wheel and keyboard input were used | Medium | Test and tune the 50-unit threshold and 140 ms gap on hardware | Phase 2 |
| A second quick trackpad swipe during the first one's momentum is ignored until the wheel goes quiet | Low | Tune with the above | Phase 2 |
| The scene choice persists across client-side navigation; returning from `/work` keeps the selected scene even though the URL no longer shows the query | Low | Acceptable for a development selector | — |

---

## 7. Active constraints

- `main` is not modified.
- No Greek-room source or asset is deleted before phase 8.
- No new dependencies without a stated reason.
- The existing site keeps working on this branch until the replacement is approved.
- Scroll progress never drives React state. Lights and materials read progress through `contentValue()`.
- The measured rules in `technical-architecture.md` §7 to §10 hold unless a new measurement replaces them.

---

## 8. Phase record

### Phase 0 — Documentation (2026-10-12)

**Changed**

- Moved the five Greek-room documents to `docs/archive/greek-room/` with `git mv`, and added a README there.
- Added a project `CLAUDE.md`.
- Added `docs/creative-table-spec.md`.
- Rewrote `docs/technical-architecture.md` for the new scene, carrying over the measured findings.
- Reset `docs/build-status.md` and `docs/build-workflow.md`.

**Not changed**

Source code, assets, dependencies, `main`.

**Testing**

`npm run build` succeeds (149 modules). No file that affects the build was touched.

### Phase 1 — Foundations (2026-10-12)

**Added**

- `src/sceneSelection.js` and an inline script in `index.html`: the `?scene=creative-table` selector.
- `src/pages/StudioHome.jsx`: the new scene's page and loading gate.
- `src/experience/studio/`: `studioLayout.js`, `stageBeats.js`, `stageSampling.js`, `stageNavigation.js`, `StageInput.jsx`, `StudioExperience.jsx`, `StudioCameraRig.jsx`, `StudioLightingRig.jsx`, `StudioDepthOfField.jsx`, `StudioRoom.jsx`.
- `src/experience/postprocessing/DepthAwareBokehPass.js`: the bokeh pass, moved out of `DepthOfField.jsx` so both scenes share it.

**Changed in existing files (old scene behaviour unchanged)**

- `App.jsx`: lazy-loads the selected scene's page.
- `postprocessing/DepthOfField.jsx`: imports the moved pass and calls its new `setFocus()`. Same numbers, same order.
- `loading/SceneReady.jsx`: the deferred-asset step is now an `afterReady` prop, passed by `CinematicExperience.jsx`.
- `vite.config.js`, `index.html`: preload hints and the opening image stand down when a non-default scene is selected.

**How it works**

- Six stages defined as data in `stageBeats.js`; spatial anchors and light fixtures in `studioLayout.js`.
- One number, the camera's progress in stage units, is animated by a critically damped spring. Camera position, aim, field of view and all three light levels are pure functions of it.
- Input is gesture-driven and the page does not scroll (open decision 1).
- `StudioRoom.jsx` is placeholder geometry only: floor, back wall, a table and a slab where the lettering goes. All poses, dimensions and light values are provisional.
- In development, `window.__stages` exposes `goToStage`, `stepStage` and `state`.

**Why the page does not scroll**

The old scene already intercepts every wheel and touch event and moves a hidden scroll position itself, then needs extra code to stop resizes and refreshes from disturbing that position. With six discrete stops there is nothing for a scroll position to add, so the new scene keeps the stage as state. Cost: no native scrollbar, and the address bar on mobile does not collapse. Benefit: no ScrollTrigger, Lenis or GSAP in the new scene's load, and no resize handling to maintain.

**Testing**

- `npm run build` succeeds (162 modules). The two pages are separate chunks: `Home` 117 kB, `StudioHome` 8 kB.
- Original scene, dev and production build: loads, 40 scene assets, no studio chunk, no console errors. Scroll steps 0 → 0.12 → 0.45 and back to 0.12 as before; the Film video plays in the lens.
- New scene, dev and production build: mounts alone, no console errors. Requests are the app shell, three, the vendor chunk, the studio chunk, fonts and the hidden opening image. No models, textures, environment files, old scene chunk or GSAP.
- Stage progression by wheel: 0 → 5 one stage per gesture, a ten-notch burst still moves one stage, a forward gesture at stage 5 does nothing, backward steps reverse. Keyboard: arrows and Home.
- Camera path sampled at 5,000 points: largest step 4.9 mm in position and 0.07° in aim, every stage hit exactly. Largest light-level step 0.001.
- Reversal mid-move (1 requested, then 5 after 350 ms): progress stayed continuous, largest per-frame change 0.059 of a stage.

**Overview framing (added after review, 2026-10-12)**

Requested: the table overview should fill about 70 to 80% of the viewport width on desktop. Stages 2 and 5 now solve their camera distance and aim height for the live aspect ratio (`OVERVIEW_FRAMING` in `stageBeats.js`, solved in `stageSampling.js`), so the table spans 75% of the width and sits vertically centred. Measured by projecting the table's corners:

```text
aspect        width fill   height used
21:9            64.5%        80.0%   (height limit wins on ultrawide)
16:9            75.0%        73.2%
16:10           75.0%        67.6%
3:2             75.0%        64.3%
4:3             75.0%        57.6%
portrait phone  not fitted; the camera stops at its far limit (Phase 2)
```

A resize re-fits at once, without easing. Verified by measurement only: the preview pane was hidden at the time, which pauses the scene, so no screenshot was taken.

**Not tested**

- Safari.
- Real trackpad, mouse wheel or touch input.
- Reduced motion in the new scene.
- Returning to the new scene from an internal page.

**Remaining for later phases**

- Phase 2: real room proportions, validated poses, per-aspect framing, input tuning on hardware.
- Phase 3: materials, lettering GLB, lighting look, haze and dust, GTAO tuning.
- Phase 5: section indicator and direct navigation between Film, Digital and Overview.
- Phase 6: the new scene's own opening image and asset lists.
