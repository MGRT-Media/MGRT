# MGRT Creative Table — Build Status

The current state of the redesign. Read this first, every session. Keep it short: Git history is the change log.

---

## 1. Current state

| | |
|---|---|
| **Project** | MGRT Creative Table, replacing the Greek-room homepage |
| **Branch** | `redesign/creative-table` |
| **Branched from** | `main` at `112f5a3` (2026-10-12) |
| **Current phase** | 3 — Visual development |
| **Phase status** | TECHNICALLY COMPLETE, awaiting review |
| **Approved scope** | Phase 3: coordinated materials, physical lettering, lighting, shadows and restrained atmosphere. No table population. |
| **Next phase** | 4 — Table population. Not approved to start. |
| **Review screenshots** | `docs/review/phase-3/` (1440 × 900, 1024 × 768, 768 × 1024, 390 × 844; all six stages, zone guides hidden). Junction before and after: `docs/review/phase-3-cove/`. Plaster repetition before and after: `docs/review/phase-3-tiling/`. Add `&guides` to the URL to show the guides. |
| **View the new scene** | `npm run dev`, then `http://localhost:5173/?scene=creative-table` |

`main` is production (mgrtmedia.com) and is unchanged.

---

## 2. Phase progress

```text
0  Documentation                        APPROVED (2026-10-12)
1  Foundations                          APPROVED (2026-10-12)
2  Blockout and framing                 APPROVED (2026-10-13)
3  Visual development (light+material)  TECHNICALLY COMPLETE
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

- Scanned PBR textures for plaster and the tabletop (stone since 2026-10-22; walnut before). Believable roughness, normal detail, real scale and variation over exaggerated displacement.
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
| 1 | **Stone colour and sheen.** The tabletop and pedestals are ambientCG Marble 024, honed, tinted warm grey (`LOOK.stone`). Confirm the tone, or ask for it darker toward charcoal. | Phase 4 |
| 2 | **Lettering finish.** Aged bronze is in place as the provisional finish. Approve it, or ask for brushed dark metal. | Phase 4 |
| 3 | **Table edges.** The top has square edges. A small eased edge and an apron rail under the top would make it read as more solid, at the cost of a slightly heavier silhouette. | Phase 4 |
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
| Table shadow on the floor has a soft edge now but is still close to black inside | Low | A baked contact shadow, if it reads as a hole once the table is dressed | Phase 4 |
| `materials/stoneMacroVariation.js` and `architecture/stoneNoise.js` are used by the new scene and must survive the cutover | Low | Move them when the Greek-room code is removed | Phase 8 |
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

### Phase 3 — Visual development (2026-10-13)

**Assets** (sources and licences: `asset-sources/README.md`)

| Shipped file | Built from | Size |
|---|---|---|
| `textures/studio/plaster/` albedo, normal, orm | Poly Haven Plaster Grey 04 (CC0) | 208 + 269 + 25 kB |
| `textures/studio/walnut/` albedo, normal, orm | Poly Haven European Walnut Veneer 05 (CC0) | 600 + 28 + 54 kB |
| `models/studio/wall-lettering.glb` | Cormorant at weight 500 (SIL OFL) | 475 kB |
| `textures/floors/` (existing) | the original scene's scanned concrete | 83 + 143 + 133 kB |

- Nothing was downloaded or installed. `sharp` was already in `node_modules`; the font was instanced with CoreText through a Swift script, so no font tooling was needed.
- **The font is variable and its default instance is Light (300).** `scripts/extract-wordmark-outlines.swift` asks for weight 500 and fails if it was not applied; CoreText reports the result as weight 500.
- The lettering model's footprint is 1.588 × 0.515 m inside the approved 1.8 × 0.585 m block, set from the same `LETTERING` definition as the Phase 2 placeholder.

**Built** (details in `technical-architecture.md` §5 and §6)

- `studioLook.js`: every finish and atmosphere setting in one place.
- Plaster walls with a baked, wall-sized drift in tone; dark concrete floor; a walnut table built from eight boards with staggered joints; bronze lettering 30 mm deep with a 1.4 mm chamfer, 20 mm off the wall.
- Four lights (lettering spot, table key, a bounce fill, a dim ambient), all present from the first frame and driven by per-stage levels. Two frozen 2048 shadow maps.
- Reflections on bronze and walnut that rise and fall with their light.
- Thin fog, and 320 dust motes visible only inside the two beams.
- `studioAssets.js`: the scene's files are fetched and decoded before it mounts, as the original scene's are.
- Zone guides are off unless the URL has `guides`.

**Stage lighting** (levels of each fixture)

| # | Stage | Ambient | Lettering | Table key | Fill | Reads as |
|---|---|---|---|---|---|---|
| 0 | Initial | 0.8 | 0.12 | 0 | 0 | Dim room, faint wordmark, table a silhouette against the faintly lit wall |
| 1 | Wall reveal | 0.8 | 1 | 0 | 0.25 | Warm pool on the plaster; bronze letters with short shadows |
| 2 | Table reveal | 1 | 0.85 | 1 | 1 | Key light on the walnut; wall still lit behind |
| 3 | Film | 1 | 0.6 | 1 | 1 | Table holds; wall recedes |
| 4 | Digital | 1 | 0.6 | 1 | 1 | Same |
| 5 | Final overview | 1.2 | 0.7 | 1 | 1.3 | A little more return light, for a clear overview |

Levels interpolate linearly: over one thousandth of a stage no level changes by more than 0.001.

**Validation**

- `npm run build` succeeds. `StudioHome` chunk 21.5 kB (8.4 kB gzip); `Home` 110 kB.
- **Framing intact:** every resting camera at seven viewports is identical to the approved Phase 2 audit, and the whole-path audit still finds no ceiling, no fixture position and no clipping. The lettering light moved, and the audit was re-run because fixture positions feed the framing guard.
- **Captures:** all six stages at 1440 × 900, 390 × 844, 768 × 1024 and 1024 × 768, in `docs/review/phase-3/`.
- **Navigation:** wheel back 5 → 0 and forward again at all four sizes, one stage per gesture. No console errors.
- **Independent loading** (production build): the new scene requests 10 scene files and no original-scene models, wall, column or brass textures, sky, video, GSAP or Lenis. The original scene requests no studio file. Both: no console errors.
- **Original scene:** loads and steps 0 → 0.12 → 0.45 → 0.6 and back.

**Payload** (production build, local server, Chrome)

| | New scene | Original scene | Documented baseline |
|---|---|---|---|
| Scene assets before the reveal | 2,018 kB in 10 files | 6,781 kB in 40 files (includes deferred upgrades fetched in the first 2.5 s) | — |
| Everything requested | 2,466 kB in 20 requests | 7,307 kB in 50 requests | 4,251 kB in 24 transfers (original scene, production, brotli) |
| Time to reveal, uncached, local | 0.83 s | 1.48 s | 0.72 s (original scene, cold, unthrottled) |

The local server does not compress. Production serves GLB files compressed; gzip alone takes the lettering model from 475 kB to 160 kB.

**Rendering** (headless Chrome, M-series Mac, 1440 × 900 at the 1.75 pixel-ratio cap)

- Ten stage moves, 960 frames: mean 16.67 ms, 95th percentile 16.7 ms, worst 16.8 ms, none over 33 ms. The recorded baseline is 16.6 ms mean with none over 33 ms. The display's 60 Hz was the limit, so this shows no regression but not how much headroom there is.
- Draw calls in the room: 5 for the walls, floor and ceiling, 1 table, 1 lettering, 1 dust.

**Not tested**

- **Safari.** Not run. Safari's automation is off on this machine and was left off, as in earlier phases.
- Real phones or tablets, a real trackpad, touch input, reduced motion.
- Throttled network profiles (Fast 4G, Slow 4G): the scene has no startup image of its own yet, so these belong with Phase 6.
- Frame time on low-power hardware, and above 60 Hz.
- Captures are from headless Chrome.

**Remaining visual issues**

- **Walnut colour** is a tint over a grey scan and reads warm red-brown; the grain is fine and straight, with no figure. See open decision 1.
- **The table's shadow on the floor is hard-edged and fully black.** The shadow filter gives no real penumbra for a source this far away; a soft-shadow method or a baked contact shadow would fix it.
- **Table edges are square**, and the board joints are barely visible at the current tone range.
- **Plaster mottling is strong inside the lettering pool**; it is the scan's own. It could be calmed by a lighter tint or a larger tile.
- **Bronze has no surface texture**, so it is clean rather than aged up close.
- **Stage 0 is very dark** outside the faint pool, by design; the side walls are not readable.
- **Dust is sparse and static in feel**; it reads as specks in stills.
- The startup cover is still plain black for this scene (Phase 6).

### Phase 3 refinement — stone table form (2026-10-22)

From review: the stone table read as blocky.

**Note on the material.** The request called the approved texture "Grey Cartago"; the table actually uses **ambientCG Marble 024**, chosen after Grey Cartago 03 was found to be a tile mosaic (record below). The material and its mapping are unchanged here.

**Changed** (Creative Table scene only; `TABLE.stone` in `studioLayout.js`, `buildStoneTable` in `studioGeometry.js`)

- **Slab:** 50 mm thick (was 60). Corners rounded 45 mm in plan (was 14). The upper edge is a 9 mm round, the lower a 5 mm round (both were 4 mm), so the edge catches the key light as a soft line. Built as a sweep of that profile round the outline, with the true normal at every point: the rounds shade smoothly, the top stays perfectly flat up to where its round begins, and the flat faces carry no extra vertices. The stone's texture still wraps over the edge.
- **Supports:** the steel legs and apron are replaced by **two stone pedestals**, 140 mm thick and 1.0 m deep, standing across the table 0.6 m in from each end (under the Film and Digital areas), every edge rounded 25 mm. The slab overhangs them on all sides; the space under the middle of the table is open.
- **Joint:** a recessed blackened-steel plate, 14 mm high and set in 22 mm, between each pedestal and the slab: a shadow gap, so the stones never meet in a hard line.
- **Footprint, height, placement and usable top unchanged.** The top surface is still flat and continuous across Film, MGRT and Digital.
- **Cost:** two meshes as before (all stone in one, the two steel plates in the other); 3,788 triangles.
- **Development only:** `window.__reviewShot = { position, lookAt, fov }` holds the camera on a fixed review shot. It is stripped from production builds.

**Testing**

- Before and after, desktop and phone: a low angle and a close corner (review shots), and the table reveal, Film, Digital and final overview: `docs/review/phase-3-stone-form/` (`-before`, `-after`).
- Geometry checked in Node: footprint exactly 3.6 × 1.8 m, top at 0.78 m, every triangle facing the way its normals say.
- Framing: all 42 resting cameras identical to the approved Phase 2 code; across the whole path at seven viewports the highest wall point in frame is 3.85 m of 4.00 m, no fixture in frame.
- Navigation forward and back at 1440 × 900 and 390 × 844; no console errors. `npm run build` succeeds.
- Not tested: Safari, real devices.

**Remaining**

- The pedestals sit in the slab's shadow from the key light, so in the stage views they read mostly as dark shapes; their form shows in the low and close review shots.
- The pedestals use the same stone as the slab with a different stretch of it; at their rounded vertical edges the texture changes direction along a line.
- The shadow-gap plates are visible only up close.

### Phase 3 — stone replaces walnut (2026-10-22)

**Decision:** a honed stone tabletop replaces the previously approved dark walnut. Grey Cartago 03 was approved first but is a tile mosaic (record below); ambientCG **Marble 024** was chosen instead from three continuous candidates.

**Source:** ambientCG Marble 024 (CC0), 2K colour, OpenGL normal and roughness, kept in `asset-sources/studio/marble_024/`. ambientCG lists it as a generated (procedural) material, not a photograph. It is continuous and tiles without seams; its own finish is polished.

**Shipped** (`public/textures/studio/stone/`, built by `scripts/build-studio-textures.mjs`)

- Colour 2048 (238 kB): contrast widened 2.4× so the faint veins survive the tint, saturation halved so the tint decides the colour.
- Normal 1024 (3 kB): its relief is nearly flat, which suits a honed slab.
- Roughness 1024 (70 kB): re-centred from 0.11 (polished) to 0.62 ± 0.04 (honed).

**Changed** (Creative Table scene only)

- **Top:** honed stone, tinted warm grey (`#625f5b`), normal strength 0.2, a soft reflection that follows the table key. Its 1.2 m repeat is broken up across the 3.6 m top, so there is no visible tiling and no joint; it reads as one slab.
- **Edges:** the top's texture now wraps over its edges: going over the front edge the stone continues from where the top left off, so veins run down the edge instead of restarting. The 4 mm eased edge and rounded corners are unchanged.
- **Slab thickness:** 55 → 60 mm, for a stone top of this span. Footprint, height (0.78 m), placement and usable area unchanged.
- **Supports:** the walnut legs and apron are now **blackened steel**, satin (`LOOK.steel`). Same layout: a steel frame of four square legs and apron rails is how a heavy slab of this size is commonly carried, so the construction did not need to change.
- **Two meshes** now (stone top, steel frame), one more draw call than the walnut table.
- **Walnut kept:** `LOOK.tableFinish: 'walnut'` restores it completely; its textures stay in `public/` but are not requested while the table is stone. `walnutBoards.js` is unused while the table is stone.
- **Lighting:** unchanged. Under the existing key the stone shows broad, soft highlights without gloss, so no adjustment was needed.

**Validation**

- Before (walnut) and after (stone) from the table reveal, Film, Digital and final overview, desktop and phone: `docs/review/phase-3-stone/` (`-before-walnut`, `-after-stone`), plus an enlarged view of the front edge.
- Texture scale: veins read at furniture scale; no repetition visible across the top in any view. Edges: veins continue over the eased edge.
- Framing: all 42 resting cameras identical to the approved Phase 2 code; across the whole path at seven viewports the highest wall point in frame is 3.85 m of 4.00 m, with no light fixture in frame.
- Navigation: forward 0 → 5 and back at 1440 × 900 and 390 × 844. The scene requests the plaster and stone sets, not the walnut. No console errors.
- `npm run build` succeeds.
- Not tested: Safari, real devices.

**Remaining**

- The source is generated, not photographed; at the closest views its veining is regular and fine rather than mineral-rich.
- The colour is very even; the "warm accents" of the brief are faint.
- In the final overview the key light makes a broad bright patch at the near-left of the top. It is soft, not glossy, but it is the brightest thing in that frame.
- The steel frame sits in the table's shadow and reads as black.

### Phase 3 — stone table: Grey Cartago 03 rejected (2026-10-22)

The approved source, Poly Haven Grey Cartago 03 (CC0, Lucas Sánchez Ros), was downloaded at 2K (colour, OpenGL normal, roughness, AO) into `asset-sources/studio/grey_cartago_03/` and inspected before use.

**Finding:** it is a stone-tile floor, not a slab. Poly Haven files it under "Slabs & Tiles", and the scan is a running-bond mosaic of small rectangular tiles: about 12 cm wide and 10 to 30 cm long at its recorded 0.93 m size, each cut from a different stone (charcoal, mid-grey, grey-green, rust-veined), with a thin joint between every pair. The joints are in the colour, normal and roughness maps alike. The largest continuous area is a single tile.

So it cannot be mapped to read as one continuous slab: used at scale the top is a tiled floor; scaled up so one tile covers the top, it is 15 times magnified and blurred; one tile repeated is about 30 identical tiles in a row. Per the brief, it was **not applied** and no derivatives were shipped. Option 1 below was chosen.

Its character — honed finish (roughness 0.58 ± 0.02), warm grey to charcoal, restrained veins with rust accents — is what was wanted; only its format is wrong.

**Options** (each needs a decision):

1. **A continuous stone-slab scan from another CC0 library.** Poly Haven's catalogue, searched by metadata, has no continuous honed or polished slab: its stone textures are tiles, walls, cliffs and rock. ambientCG publishes CC0 marble and stone slab scans. Needs approval of a specific asset to download.
2. **Generated stone.** A continuous slab texture made procedurally (warm grey ground, soft mineral clouds, a few restrained veins), with Cartago's honed roughness as the reference. No download, no repetition, but drawn rather than photographed.
3. **Use Cartago as what it is.** A tiled stone top. Contradicts "one continuous slab".

The supports for a stone top (a dark steel or stone base in place of the walnut legs and apron) are on hold with the material.

### Phase 3 refinement — the table (2026-10-22)

From review: the table read as a generic rectangular slab on basic legs.

**Changed** (Creative Table scene only: `studioGeometry.js`, `studioLayout.js`, `studioLook.js`, `studioMaterials.js`, new `walnutBoards.js`)

- **Top:** one solid slab, 55 mm thick, with its upper and lower edges eased by a 4 mm round all the way round and its corners rounded 14 mm in plan, so the key light runs along the edge as a line instead of stopping at a razor corner. The footprint is exactly 3.6 × 1.8 m and the working surface is at exactly 0.78 m.
- **Boards:** the top still reads as eight glued-up boards, every other one jointed in its middle, each length with its own stretch of grain, tone (±6%) and sheen (±8%). These are now drawn by the material from each point's position rather than modelled as separate boxes, which is what lets the slab's edges be continuous. The front and back edges take the board they belong to, so the grain runs over the eased edge unbroken.
- **Legs:** 85 mm square, set in 150 mm from the ends and 85 mm from the sides to their outer faces, so the top overhangs them. Previously 90 mm, centred 160 mm in from every edge.
- **Apron:** a plain rail, 95 × 24 mm, between each pair of legs under the top, set back 12 mm from the legs' faces. It is what holds a 3.6 m top flat and what makes the table read as built.
- **Every edge eased:** legs and rails have a 3 mm round on all edges.
- **Grain:** along the length on the top and long edges, up the legs, along each rail. End faces (the top's ends, the legs' feet) are darker, as end grain is.
- **Finish:** unchanged satin walnut; no gloss added. Settings are in `TABLE` (`studioLayout.js`) and `LOOK.walnut` (`studioLook.js`).
- **Cost:** still one merged geometry and one draw call. 2,844 triangles. The board logic is a few lines in the walnut shader, patched before first compile.

**Preserved**

- Footprint, height, placement and the continuous Film / MGRT / Digital top.
- Camera: all 42 resting cameras identical to the approved Phase 2 code; across the whole path at seven viewports the highest wall point in frame is 3.85 m of 4.00 m, with no light fixture in frame.

**Testing**

- Before and after from the table reveal, Film, Digital and final overview, desktop (1440 × 900) and phone (390 × 844): `docs/review/phase-3-table/` (`-before` and `-after`).
- Close crops of the corner, edge and legs checked for texture stretching: none visible on the eased edges, rounded corners or leg rounds.
- `npm run build` succeeds; no console errors.
- Not tested: Safari, real devices.

**Remaining**

- The legs and apron sit in the table's own shadow from the key light, so they read mostly as silhouette; the apron is visible in the table reveal only as a dark band.
- The board joints show as a change of grain and tone, without a visible glue line.
- The eased edge is realistic in size, so its highlight is about a pixel wide at desktop distances. A larger round would read more strongly but look less like solid furniture.

### Phase 3 completion pass (2026-10-14)

Phase 2 is approved and complete; its framing was not reopened. This pass finished the open items of the Phase 3 visual development and re-ran the full validation.

**Changed** (Creative Table scene only)

- **Floor contact shading.** The concrete now darkens within 0.5 m of each wall, to 55% at the cove (`LOOK.floor.wallShade`), baked into a finer floor mesh. With the plaster's darkening at the base (now to 24% over 0.45 m), both sides of the junction shade into it, and the pale edge at the cove's foot is much reduced. Compare `docs/review/phase-3-cove/` (before = sharp junction, after = cove and both gradients).
- **Floor repetition.** The 4.2 m concrete scan repeated about twice each way across the floor; it now uses the same repetition break-up as the plaster.
- **Softer table shadow.** The table key's shadow map is 1024 instead of 2048, which widens the shadow's soft edge; the lettering keeps its 2048 map for crisp letter shadows. Both are still frozen after the first frame.
- **Walnut** is darker and less coppery (`#7f6656` tint), and the bounce fill off the wall is a little stronger (0.8) so the table's near side keeps some shape.

**Material check**

| Surface | Scale | Grain / direction | Roughness | Normal | Repetition |
|---|---|---|---|---|---|
| Plaster | 1.5 m per scan, real size | — | scan × 1.0, matte | 0.75 | broken up (patch scale 0.7) |
| Walnut | 1.0 m per scan, real size | along the table's length on the top, vertical on the legs | scan × 1.0, satin | 0.45 | eight boards, staggered joints, offset per length |
| Concrete | 4.2 m per scan | — | scan × 1.0 | 0.8 | broken up (patch scale 0.6) |
| Bronze | — | — | 0.5, metal | — | — |

**Validation**

- **Framing:** all 42 resting cameras (six stages, seven viewports) are identical to the approved Phase 2 code (`c00ec80`), compared by running the same audit against both.
- **Ceiling:** over 3,000 points of the whole path at each of the seven viewports, the highest wall point in frame is 3.85 m against a 4.00 m ceiling; no light fixture position is in frame; no clipping into the table. The path is the same in both directions.
- **Lettering:** complete or entirely out of frame at every resting stage, at every viewport.
- **Navigation:** wheel forward 0 → 5 and back 5 → 0 at 1440 × 900, 768 × 1024 and 390 × 844, one stage per gesture; a further gesture at either end stays put. No page errors.
- **Captures:** all six stages at 1440 × 900, 1024 × 768, 768 × 1024 and 390 × 844 with zone guides hidden: `docs/review/phase-3/`.
- **Independent loading** (production build): the new scene requests 10 scene files (studio textures, lettering model, the shared floor set) and none of the original scene's models, wall, column or brass textures, sky, video, GSAP or Lenis. The original scene requests no studio file. No console errors in either.
- **Original scene:** steps 0 → 0.12 → 0.45 → 0.6 and back to 0.45 as before.
- `npm run build` succeeds. `StudioHome` chunk 24.6 kB (9.7 kB gzip).

**Performance**

| | New scene | Original scene |
|---|---|---|
| Scene assets | 2,018 kB in 10 files | 6,781 kB in 40 files |
| Everything requested | 2,466 kB in 19 requests | 7,306 kB in 49 requests |
| Time to reveal, uncached, local, uncompressed | 0.88 s | 1.72 s |

- **Frame timing could not be measured meaningfully this time.** The Mac was in Low Power Mode on battery (16%), and headless Chrome delivered 30 frames per second even on an empty page. The scene held that 30 Hz ceiling throughout ten stage moves: mean 33.3 ms, worst 33.5 ms. Disabling the new repetition break-up made no difference, so the cost of the extra texture reads is below what this run could detect. On mains power on 2026-10-13 the scene held 60 Hz (16.7 ms mean, none over 33 ms).

**Not tested**

- **Safari.** Safari 27.0.1 is installed, but its automation is not enabled ("Allow JavaScript from Apple Events" and `safaridriver` are both off), and enabling either is a security setting left to you. To check by hand: open `http://localhost:5173/?scene=creative-table` in Safari with `npm run dev` running.
- Frame rate at 60 Hz and above for this pass (see above); low-power phones and tablets.
- Real phones and tablets, a real trackpad, touch input, reduced motion, throttled networks.
- All captures are from headless Chrome.

**Remaining visual issues**

- Walnut colour and the lettering finish are provisional (open decisions 1 and 2).
- The table top's edges are square (open decision 3).
- The inside of the table's shadow is still close to black.
- The plaster's own mottling is strong inside the lettering pool.
- The bronze is clean, with no surface texture or patina.
- Dust is sparse; in stills it reads as specks.
- The vertical corners between walls are sharp.
- This scene's startup cover is still plain black (Phase 6).

### Phase 3 refinement — plaster repetition (2026-10-14)

From review: the same plaster pattern was visibly repeating across the wall.

- The plaster material now reads each of its maps from two of eight offsets into the scan, chosen and blended by a slow noise across the surface (`studio/antiTiling.js`, after Inigo Quilez's texture-repetition technique). Neighbouring patches of wall come from different parts of the scan, so the 1.5 m grid of identical stains is gone. Colour, relief and roughness shift together, so they stay in register.
- Scale is unchanged: the plaster still reads at its real size. The patch size is `LOOK.plaster.patchScale`.
- Cost: one extra texture read per map on the walls. The shader is patched before its first compile, so nothing recompiles after the reveal.
- Before and after: `docs/review/phase-3-tiling/`. Build passes; no console errors.

### Phase 3 refinement — wall-to-floor cove (2026-10-13)

From review: the junction between the walls and the floor read as sharply assembled.

**Changed** (Creative Table scene only: `studioGeometry.js`, `studioLayout.js`, `studioLook.js`, `StudioRoom.jsx`)

- **A plaster cove.** Each wall now turns into the floor through a quarter-round of 80 mm radius (`ROOM.coveRadius`) instead of meeting it at a right angle. It is a plasterer's cove, not a cyclorama sweep: about 2% of the wall's height.
- **One sheet, no stretch.** The wall and its cove are a single surface, laid out flat with UVs in metres along the surface and then rolled at the bottom, so the plaster keeps its scale round the curve and its tone drift runs unbroken into it. There is no separate skirting piece.
- **The plaster darkens toward the floor.** Over the last 0.4 m of its surface, through the cove, its tone falls to 30% (`LOOK.plaster.base`): scuffing and the floor's own shade. Without this the cove made things worse, not better: it faces the light, so it showed as a bright strip ending in a hard edge against the dark concrete. With it, the wall arrives at the floor already dark.
- The corners where two coves meet are a mitre, formed by the two running through each other.
- The floor is unchanged and still dark concrete; the two materials stay distinct.

**Contact shadow and ambient occlusion**

- Reviewed with the geometry. There was no black occlusion seam at the junction before or after: the hard line was the two materials meeting at a right angle under raking light, not a shadow artefact. The ambient-occlusion settings are unchanged.
- Grounding now comes from the baked darkening at the base of the wall plus the existing occlusion pass.

**Preserved**

- Room dimensions: the cove sits inside the 9 × 7 × 4 m shell.
- Camera framing: every resting camera at seven viewports is identical to the approved audit; no ceiling, fixture or clipping anywhere along the path.
- Performance: the same draw calls and materials. The three walls gained about 7,000 triangles between them for the cove and the gradient band.

**Where the junction shows**

| View | Desktop | Portrait phone |
|---|---|---|
| Initial | Under the table, as a strip of wall above the floor | Same |
| Wall reveal | Under the table, lit by the lettering pool | Same |
| Table reveal | To the right of the table | Hidden behind the table |

**Testing**

- `npm run build` succeeds.
- Before-and-after captures of stages 0, 1 and 2 on desktop (1440 × 900) and phone (390 × 844), with enlarged details of the junction: `docs/review/phase-3-cove/`. `docs/review/phase-3/` is refreshed with the cove in place.
- Navigation back and forward at four sizes; no console errors. Original scene loads and steps as before; no file outside the studio folder changed.
- Not tested: Safari, real devices.

**Remaining**

- A thin lighter edge is still visible where the cove's foot meets the floor in the table reveal, because plaster is paler than concrete even when darkened. Lowering `LOOK.plaster.base.tone` further would remove it at the cost of a dirtier-looking wall base.
- The darkening is uniform along each wall. Real wear is patchy.
- The vertical corners between walls are still sharp.

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
