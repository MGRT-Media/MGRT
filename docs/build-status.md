# MGRT Creative Table — Build Status

The current state of the redesign. Read this first, every session. Keep it short: Git history is the change log.

---

## 1. Current state

| | |
|---|---|
| **Project** | MGRT Creative Table, replacing the Greek-room homepage |
| **Branch** | `redesign/creative-table` |
| **Branched from** | `main` at `112f5a3` (2026-10-12) |
| **Current phase** | 2 — Room blockout and camera framing |
| **Phase status** | TECHNICALLY COMPLETE, awaiting review |
| **Approved scope** | Phase 2 only. No detailed lighting, photoreal materials or table population. |
| **Next phase** | 3 — Visual development. Not approved to start. |
| **Review screenshots** | `docs/review/phase-2-refined/` (six viewports, all six stages). `docs/review/phase-2/` is the first pass and is superseded. |
| **View the new scene** | `npm run dev`, then `http://localhost:5173/?scene=creative-table` |

`main` is production (mgrtmedia.com) and is unchanged.

---

## 2. Phase progress

```text
0  Documentation                        APPROVED (2026-10-12)
1  Foundations                          APPROVED (2026-10-12)
2  Blockout and framing                 TECHNICALLY COMPLETE
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

**Confirmed at the Phase 1 review (2026-10-12)**

- Stage-based navigation without native page scrolling stays. It is not to be replaced with ScrollTrigger.
- `?scene=creative-table` stays available in preview and production builds during development. The original remains the default.
- Trackpad momentum, touch, reduced motion and accessibility must be validated before launch (see §6).

---

**Decided after the Phase 2 review (2026-10-13)**

- Portrait keeps the desktop's elevated three-quarter angle, with Film left, MGRT centre and Digital right. The end-on portrait views are removed.
- On portrait the table is deliberately cropped, not forced into frame.

---

## 4. Open decisions

These need an answer before the phase shown.

| # | Decision | Needed by |
|---|---|---|
| 1 | **Who authors the lettering GLB.** Outlines come from Cormorant Medium (confirmed). It still needs a modelling tool or a one-off script with `--no-save` packages, and the Cormorant font file, which is not in the repository. | Phase 3 |
| 2 | **Texture sources.** Which scanned plaster and walnut sets. Selected in Phase 3; downloading third-party files needs approval per file. | Phase 3 |
| 3 | **Lettering finish.** Brushed dark metal or aged bronze, decided on screen. | Phase 3 |
| 4 | **Table contents.** Source material for the project sheet, sketches, identity card and both collections. | Phase 4 |

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
| **Before launch:** wheel-gesture detection is untested on a real trackpad; only synthetic wheel and keyboard input have been used | Medium | Test and tune the 50-unit threshold and 140 ms gap on hardware | Phase 7 |
| **Before launch:** a second quick trackpad swipe during the first one's momentum is ignored until the wheel goes quiet | Low | Tune with the above | Phase 7 |
| **Before launch:** touch input is untested on a real device | Medium | Test on iOS and Android | Phase 7 |
| **Before launch:** reduced motion in the new scene is implemented (instant stage changes) but untested | Medium | Test with the system setting on | Phase 7 |
| **Before launch:** the stages have no on-screen control or screen-reader announcement; keyboard works but nothing says which stage is current | Medium | Section indicator and live region | Phase 5 |
| A resize re-fits the camera at once, without easing | Low | Ease if it reads as a jump on real devices | Phase 7 |
| The zone guides are not blurred by depth of field correctly (they do not write depth) | Low | Temporary; removed with the guides | Phase 4 |
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

### Phase 2 — Room blockout and camera framing (2026-10-12)

**Built**

- `studioLayout.js`: room 9 × 7 × 4 m; table 3.6 × 1.8 × 0.78 m with 1.4 m clear to the rear wall; lettering 1.8 m wide, centred 2.5 m up; three zones on the tabletop, each 1.1 × 1.5 m.
- `StudioRoom.jsx`: floor, ceiling, rear wall and both side walls in flat neutral greys, plus the table. No front wall; the camera never looks back at it.
- `WallLettering.jsx`: the stacked MGRT / MEDIA wordmark drawn flat in Cormorant Medium with the established line proportions and tracking, standing 20 mm off the wall. Flat placeholder; extrusion is Phase 3.
- `ZoneGuides.jsx`: temporary dashed outlines labelled FILM, MGRT, DIGITAL. Removed by deleting one line in `StudioRoom.jsx`.
- `stageFraming.js`: a per-viewport solver for "fitted" stages. A stage says what it must show and from which direction; the solver finds the distance, centres the subject, keeps the camera inside the room, and widens the lens only if the room is too small.
- `stageBeats.js`: all six stages refined (below).

**The six stages, desktop (1440 × 900)**

| # | Stage | Camera | Lens | Result |
|---|---|---|---|---|
| 0 | Initial | Low and square-on, 6.6 m from the wall | 40° | Lettering 23% of width; table a silhouette across the lower quarter |
| 1 | Wall reveal | 0.6 m push | 40° | Lettering 26%; table's near edge still in frame |
| 2 | Table reveal | Up to 2.5 m, elevated three-quarter | 45° | Whole table, 75% of width; rear wall in the top of the frame |
| 3 | Film | In over the left end | 45° | Film area centred at 45% of width, MGRT area alongside |
| 4 | Digital | Across to the right end, same height | 45° | Mirror of Film |
| 5 | Final overview | 3.75 m up, nearly overhead | 52° | Whole table, 80% of width, slight keystone |

Stage 5's lens is wider than 45° because the 4 m ceiling stops the camera rising far enough; on 16:9 it is 47.6°.

**Framing by viewport** (subject's share of width; "whole table" for stages 2 and 5)

| Viewport | Stage 2 | Stage 5 | Notes |
|---|---|---|---|
| 1920 × 1080 | 75%, whole table | 80%, whole table, 47.6° | |
| 1440 × 900 | 75%, whole table | 80%, whole table, 52.2° | |
| 1366 × 768 | 75%, whole table | 80%, whole table, 47.6° | |
| 1024 × 768 | 75%, whole table | 85%, whole table, 58° | lens at its limit |

Portrait framing in this table was replaced on 2026-10-13; see "Portrait framing refinement" below.

**Unresolved visual issues**

- The lettering is small in the opening on desktop (23% of width). That follows from a 1.8 m wordmark in a 9 m room; a longer lens or a closer start would enlarge it at the cost of the table foreground.
- The table reveal does not show the lettering; the wall above the table is in frame but the wordmark is above the top edge.
- In stages 0 and 1 the tabletop is seen almost edge-on, so it reads as a thin band with legs.
- The lighting is provisional and harsh (hard table shadow, dark side walls). It is not a Phase 2 deliverable.
- Film and Digital are exact mirrors. They may want to differ once real objects are placed.

**Testing**

- `npm run build` succeeds. `StudioHome` is 13 kB; `Home` is unchanged at 117 kB.
- All six stages captured at desktop, tablet portrait and phone with headless Chrome: `docs/review/phase-2/`.
- Camera path walked at 2,000 points for each of six viewports: never outside the room, never within 0.25 m above or 0.15 m beside the table, no abrupt rotations.
- Wheel input: forward 0 → 5 then back 5 → 0, one stage per gesture. A straight run from 5 to 0 was monotonic.
- New scene requests no old-scene models, textures, environment files, timeline code, GSAP or Lenis.
- Original scene: no file outside `src/experience/studio/` changed in this phase. Loads, steps forward 0 → 0.12 → 0.45 → 0.6 and back, no console errors.

**Not tested**

- Safari; real trackpad, touch or mobile devices; reduced motion.
- Screenshots are from headless Chrome, not a visible browser window.

### Phase 2 refinement — portrait framing and no ceiling in frame (2026-10-13)

Three review passes on the same day. This is the resulting state; desktop table scale and the portrait deliberate crop are as approved.

**Rules now enforced**

- **The ceiling is never in frame.** No sight line may land on a wall within 0.15 m of the ceiling (`FRAMING.ceilingClearance`), and no light fixture's position may be in frame. This holds at every point along the path, not only at the resting stages: `stageFraming.js` tilts any shot down, by lowering its aim, until it complies, and the sampler applies the same guard every frame. Stages that already comply are untouched. The ceiling geometry is still there; nothing is hidden.
- **Lettering is complete or absent** at every resting stage.
- **Portrait keeps the desktop viewing angle**, Film left and Digital right, and crops the table deliberately.

**How it is configured** (all in `stageBeats.js`)

- A stage's `portrait` object replaces fields of its camera below an aspect ratio of 0.9.
- A fitted shot's `bounds` may be a list of boxes framed together; `centerY` sets the subject lower in the frame.
- Stages 0 and 1 aim lower than before (1.4 m and 1.6 m up the wall, from 1.75 m and 1.9 m): at the old aim the top of the frame reached the ceiling. On portrait the camera is also 17 cm lower.
- Portrait stages 2 and 5 frame the whole wordmark together with the table, so a tall frame's spare height goes to the wall, not the floor.
- Portrait stage 5 is fitted top to bottom, wordmark to the table's near edge, from the ceiling limit on a wide lens.

**Compositions**

| # | Stage | Desktop 1440 × 900 | Phone 390 × 844 / 430 × 932 | Tablet 768 × 1024 |
|---|---|---|---|---|
| 0 | Initial | Lettering complete; whole table as foreground; 40° | Lettering 81% of width; 1.4 m of table; 40° | 2.3 m of table |
| 1 | Wall reveal | Lettering complete; table's near edge in frame; 40° | Lettering 89% of width; 1.2 m of table | 2.0 m of table |
| 2 | Table reveal | Whole table at 75% of width; lettering outside; 45° | Wordmark above, MGRT area prominent, 1.8 m of table; tabletop 25% of height, 9% floor below; 45° | Wordmark above; 2.2 m of table; 45° |
| 3 | Film | Film area centred, 2.7 m of table; 45° | 1.5 m of table; tabletop 36% of height, 19% floor; 45° | 1.6 m; tabletop 54% |
| 4 | Digital | Mirror of Film | Mirror of Film | Mirror of Film |
| 5 | Final overview | Whole table at 80%, nearly overhead; 52° | Wordmark above; steeper, from the ceiling limit; 1.8 m of table; tabletop 39% of height, 2% floor; 58° | Wordmark above; 3.0 m of table; tabletop 39%; 58° |

Landscape tablet (1024 × 768) matches desktop, with the final overview at 58°. 1920 × 1080 and 1366 × 768 match the approved Phase 2 figures for stages 2 to 5.

**Whole-path audit** (3,000 points per viewport; the path is the same in both directions)

| Viewport | Highest wall point ever in frame | Fastest turn | Fastest lens change | Path |
|---|---|---|---|---|
| 1920 × 1080 | 3.85 m | 58° per stage | 5° per stage | 10.6 m |
| 1440 × 900 | 3.85 m | 56° | 7° | 10.9 m |
| 1366 × 768 | 3.85 m | 58° | 5° | 10.6 m |
| 1024 × 768 | 3.85 m | 55° | 13° | 11.9 m |
| 768 × 1024 | 3.85 m | 30° | 13° | 9.4 m |
| 430 × 932 | 3.85 m | 27° | 13° | 10.4 m |
| 390 × 844 | 3.85 m | 27° | 13° | 10.4 m |

The ceiling is at 4.00 m. At every viewport: no ceiling, no fixture position in frame, the camera at least 0.2 m inside the room, and clear of the table.

**Remaining compromises**

- **The lettering crosses the frame edge during a move**, never at rest: between the wall reveal and table reveal on desktop, and between the table shots and Film or Digital on portrait. A shot that holds the wordmark and the next that excludes it cannot avoid this.
- **On a phone the final overview shows no more table than the table reveal** (1.8 m each). It is distinct by angle and scale instead: steeper, the tabletop 39% of the screen against 25%, almost no floor. With no ceiling in frame, no surplus floor and a lens of at most 58°, about 1.9 m is the most table a 390-wide screen can show from inside this room. More would need a wider room, a higher ceiling or a wider lens.
- **The portrait final overview is at the 58° lens limit**, on phones and tablets.
- **Phone stages 0 and 1 have a dark band below the table** (about a fifth of the frame): the floor and the table's legs in the dim opening light. Raising the aim would bring the ceiling in, and a longer lens would push the lettering past the screen's edges.
- **Phone Film and Digital have 19% floor below the table.**
- **A lowered aim can make a move's rotation slightly uneven** where the guard starts or stops acting mid-move. The audit's turn rates include it.
- Portrait framing is "slightly asymmetric": the camera is 0.13 to 0.46 m right of the room's centre line in the table shots.

**Testing**

- `npm run build` succeeds.
- All six stages captured at 1920 × 1080, 1440 × 900, 1024 × 768, 768 × 1024, 430 × 932 and 390 × 844: `docs/review/phase-2-refined/`.
- Whole-path audit above, at seven viewports.
- Wheel navigation at all six captured sizes: back 5 → 0 one stage per gesture, a further back gesture stays at 0, then forward again.
- New scene requests no old-scene assets or scroll libraries at any size. No console errors.
- Original scene: only four files under `src/experience/studio/` changed. Loads, steps 0 → 0.12 → 0.45 → 0.6 and back to 0.45, no console errors.

**Not tested**

- Mid-move frames were audited by calculation through the same sampler the renderer uses, not captured as images.
- Real phones or tablets, Safari, touch input, reduced motion. Captures are from headless Chrome.

**Remaining for later phases**

- Phase 3: materials, lettering GLB, lighting look, haze and dust, GTAO tuning.
- Phase 5: section indicator and direct navigation between Film, Digital and Overview.
- Phase 6: the new scene's own opening image and asset lists.
- Phase 7: input, reduced-motion and accessibility validation on real hardware.
