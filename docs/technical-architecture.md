# MGRT Creative Table — Technical Architecture

How the Creative Table experience is built. What the visitor sees is defined in `creative-table-spec.md`; this document must not redefine it.

Sections 1 to 6 describe the target architecture for the redesign. Section 7 onward records **measured findings from the previous build that still apply**. The full tables and methods behind them are in `archive/greek-room/technical-architecture.md` (§13 to §17).

> Status: sections 2 to 4 describe what Phase 1 built. Sections 5 and 6 are the approved plan for later phases. Room dimensions and camera poses in the code are provisional blockout values; they are set properly only after the blockout has been validated in the browser.

---

## 1. Stack and application shell

| Layer | Choice |
|---|---|
| Build | Vite 5, deployed on Vercel |
| UI | React 18, plain CSS with custom properties (`src/styles/global.css`) |
| 3D | three 0.169 through react-three-fiber 8 |
| Scroll | GSAP ScrollTrigger for the timeline, Lenis for input smoothing |

`@react-three/drei` is in `package.json` but imported nowhere. It can be removed at cutover.

**No new runtime dependencies are needed for the redesign.** The GLTF loader, meshopt decoder, post-processing passes and PMREM generator all ship with three.

### Shell

- `src/App.jsx` is a small router. It lazy-loads `src/pages/Home.jsx`, so `/work`, `/about` and `/contact` never download Three.js. Every homepage-only import must stay below that boundary, including overlay UI that reads scroll progress.
- `Home.jsx` owns the loading gate (preload, warm-up, ready) and mounts the canvas plus the DOM overlays.
- One persistent `<Canvas>`. DOM and WebGL stay separate: text and controls are DOM, the room is WebGL.

---

## 2. Coexistence during the redesign

The Greek-room experience keeps working on this branch until the replacement is approved.

- The new scene lives under `src/experience/studio/`, with its own page, `src/pages/StudioHome.jsx`.
- **Scene selector:** `?scene=creative-table` mounts the new scene; anything else mounts the original. An inline script at the top of `index.html` reads the query and records it as `data-scene` on `<html>`; `src/sceneSelection.js` reads that attribute once. The choice holds for the whole page load.
- `App.jsx` lazy-loads one page or the other through **two separate loader functions**. Written as one function choosing between two `import()` calls, Vite preloads both chunks' dependencies whichever is chosen (found in Phase 1: the old scene's chunk and GSAP were fetched on the new scene's page).
- The startup cover's opening image and the preload hints belong to the original scene. With `data-scene` set, the image is hidden and `startHeroPreloads()` does nothing.
- Shared modules may be generalised only in ways that leave the old scene's behaviour unchanged. Phase 1 made two such changes: the bokeh pass moved into `postprocessing/DepthAwareBokehPass.js`, and `SceneReady` takes its deferred-loading step as an `afterReady` prop.
- Greek-room source and assets are deleted only in the cutover phase.

---

## 3. Scene structure

```text
src/pages/StudioHome.jsx     the page: loading gate, canvas, overlays, input
src/sceneSelection.js        which scene this page load runs
src/experience/studio/
  studioLayout.js            room, table, lettering, zones and light fixtures (single source)
  stageBeats.js              the six stages: camera pose, look-at, field of view, light levels
  stageSampling.js           reads the stages at any point between them
  stageNavigation.js         which stage is requested: goToStage, stepStage
  StageInput.jsx             wheel, touch and keyboard into stage steps
  StudioExperience.jsx       canvas root
  stageFraming.js            solves a fitted stage's camera for the live viewport
  StudioCameraRig.jsx        moves the camera to the requested stage
  StudioLightingRig.jsx      holds each light at its stage's level
  StudioDepthOfField.jsx     post-processing chain and focus
  StudioRoom.jsx             the room and table as a blockout
  WallLettering.jsx          the wordmark, flat placeholder until Phase 3
  ZoneGuides.jsx             TEMPORARY outlines of the three table areas
```

Everything for the new scene is in `studio/` so the cutover is a matter of deleting the old folders.

### Centralised definitions

Two modules hold every number that describes the experience:

- **`studioLayout.js`** — where things are: room size, table size, lettering position, the Film, MGRT and Digital zones, and each light fixture's position, colour and full intensity.
- **`stageBeats.js`** — what happens at each stage: camera position, look-at target, field of view, and each light's level from 0 to 1. Also the travel time between stages.

Camera, lighting, depth of field and navigation read from these. No component holds a position or a level literal. Stages are only resting states; `stageSampling.js` derives everything in between. This replaces the previous arrangement, where `cameraPath.js` and `DepthOfField.jsx` imported anchors directly from scene components and could not outlive them.

### What is reused

| Area | Modules |
|---|---|
Used by the new scene now:

| Area | Modules |
|---|---|
| Progress | `timeline/journeyProgress.js` (the two progress objects), `timeline/contentProgress.js` |
| Loading | `loading/SceneReady.jsx`, `loading/startupCover.js`, `loading/LoadErrorBoundary.jsx`, the startup cover in `index.html` |
| Rendering | `postprocessing/DepthAwareBokehPass.js`, `lighting/shadowUpdates.js`, `ui/GrainOverlay.jsx` |
| Shell | `App.jsx`, the router, `GlobalNav`, `ui/SiteMark.jsx`, `timeline/sectionNavigationEvent.js`, `hooks/useViewportHeight.js` |

To be adopted in later phases:

| Area | Modules |
|---|---|
| Framing | `timeline/viewportFit.js` (Phase 2) |
| Assets | `models/modelAssets.js`, `models/propTextureUpgrades.js`, the scanned-PBR loader in `materials/scannedStone.js`, `assets/assetUrl.js`, the fingerprint plugin (Phase 3) |
| Atmosphere | the dust system in `lighting/volumetricLighting.js`, which is currently tied to the old sun (Phase 3) |
| Loading | `loading/criticalAssets.js`, `loading/deferredAssets.js`, `loading/heroAssets.js` as patterns (Phase 6) |

Not reused, because they are built around the old room: `timeline/ScrollTimelineProvider.jsx`, `timeline/ScrollCameraRig.jsx`, `timeline/cameraPath.js`, `timeline/sectionFlight*.js`, `postprocessing/DepthOfField.jsx`.
| Reference | `impact/impactStage.js`, `impact/ImpactStage.jsx`, `impact/tableWood.js`: an earlier table with an elevated three-quarter pose and aspect-aware framing |

### What is retired at cutover

`architecture/*`, `Environment.jsx`, `lighting/SunsetSky.jsx`, the sun and sky rig, `impact/heroPlate.js`, `impact/stageSwap.js`, `timeline/filmActBeats.js`, and the Greek-room camera path. `film/CinemaCamera.jsx`, `digital/Monitor.jsx` and the two videos are kept as candidates for table objects.

---

## 4. Scroll and camera

### Stage progression

- **The page does not scroll.** A stage is a state, not a scroll position. `StageInput.jsx` listens for wheel, touch and keyboard input and calls `stepStage(±1)`. There is no scroll spacer, ScrollTrigger or Lenis in the new scene, and GSAP is not loaded by it.
- This removes a class of problem the old scene needed code for: with no scroll range, a resize cannot move the camera, and a coasting trackpad cannot overshoot.
- **One gesture, one stage.** A wheel gesture counts once it has travelled 50 units and stays spent until the wheel has been quiet for 140 ms, so a flick's momentum is part of the gesture that started it. A touch counts once per finger-down after 50 px. Arrow keys, Page Up and Down, Space, Home and End work from the keyboard.
- Progress is in **stage units**: 0 to 5. `renderedProgress` holds the requested stage, a whole number; `cameraProgress` holds where the camera actually is.
- The intro cinematic, timed holds, scroll locks and automatic final beat of the old timeline do not exist here.
- Input made before the reveal is kept as one forward step, as before.

### Camera

- `StudioCameraRig.jsx` animates one number, `cameraProgress`, toward the requested stage with a critically damped spring. It starts from rest, settles without overshoot, and a new request mid-move (including a reversal) bends the motion instead of restarting it. `STAGE_TRAVEL_SECONDS` (0.45) sets the pace: about 1.1 s to cover 95% of a stage.
- Position and look-at are centripetal Catmull-Rom splines through the stage poses, sampled so stage N sits at exactly N. Neighbouring stages must not share an identical point.
- Field of view and light levels interpolate linearly between neighbouring stages.
- Because everything is a pure function of one number, reversing is exact and camera and lighting cannot drift apart.
- With reduced motion, the camera goes straight to the requested stage.
- **Fixed and fitted stages.** A fixed stage's camera is used as written (stages 0 and 1). A fitted stage (2 to 5) declares what it must show as a box and gives only a viewing direction; `stageFraming.js` solves the rest for the live aspect ratio, like CSS `object-fit: contain`:
  1. the nearest distance at which the box spans no more than the stage's share of the frame (`FRAMING` defaults: 75% of width, 80% of height);
  2. never beyond the room: 0.25 m from any wall or the ceiling;
  3. if the room is too small, the lens widens only as far as needed, up to 58°;
  4. the aim slides until the box is centred.
- **Portrait.** Below an aspect ratio of 0.9 a stage's `portraitPosition` direction is used if it has one. Stages 2 and 5 use this to view the table from its end.
- The solve runs when the aspect ratio changes, not per frame, and moves that stage's points on the path splines.
- **Not yet built:** easing of a re-fit on resize, and direct flights between Film, Digital and Overview that do not pass through the stage between (Phase 5). `goToStage(n)` already exists for navigation to call.

---

## 5. Lighting and atmosphere

- Three sources: a low ambient or environment term, a warm spotlight on the lettering, a large soft directional key on the table.
- Every light level is a function of progress, read through `contentValue()`, with per-stage levels defined in the beats.
- **Shadow budget:** one shadow-casting light, the table key, with a 2048 map. The previous 4096 sun map is not carried over. The lettering spot does not cast a map shadow unless visual development shows it is needed.
- Shadows are rendered once and frozen, then updated on demand (`shadowUpdates.js`). A static room is the ideal case for this.
- Haze is the existing exponential fog plus the existing GPU dust, with an inexpensive additive cone for the lettering beam. No ray-marched volumetrics.
- Lighting and materials are developed together in one visual-development phase, because each is tuned against the other.

---

## 6. Materials, models and post-processing

### Materials

- Plaster and walnut use scanned PBR sets: albedo, normal and a packed occlusion-roughness-metalness map, loaded through the existing scanned-texture path.
- The existing `floors` set is already a dark worn concrete and is the starting point for the floor.
- Texture resolution is chosen from how close the camera gets, then encoded per the rules in §9.

### Wall lettering

- A GLB with real extruded, bevelled geometry. The current wordmark is a flat alpha-cut texture and cannot hold up under a raking spotlight.
- See `build-status.md` for the open question on the wordmark's vector source.

### Models

- GLBs are meshopt-compressed and loaded through `modelAssets.js`.
- Models ship with low-resolution boot textures and are upgraded after the reveal (§8).

### Post-processing

`StudioDepthOfField.jsx` runs render, ambient occlusion (GTAO), depth-aware bokeh and output. The focal plane sits on the current stage's look-at point, read from the stage definitions, so the lens knows nothing about the room's geometry. Dust joins the chain in Phase 3.

---

## 7. Rendering settings that are measured, not arbitrary

| Setting | Value | Why |
|---|---|---|
| Device pixel ratio | capped at 1.75 | The post chain is fill-rate bound; 2.0 costs 30% more pixels for no visible gain. |
| Context antialias | off | The scene renders into the composer's own 4x multisampled target. A multisampled backbuffer is wasted and resolves poorly on Safari's Metal path. |
| Shadow map updates | frozen, on demand | Nothing in the room moves. |
| Render when hidden | paused | `document.visibilityState` check in the render loop. |
| Per-frame allocation | none | Module-level scratch objects. |
| Static geometry | merged per material | Fewer draw calls for geometry that never moves. |

Baseline to compare against: about 16.6 ms average frame time during a scroll burst on the development machine, with no frames over 33 ms.

---

## 8. Loading

### Sequence

```text
request → black → opening image → critical assets → scene compiled and rendered → crossfade → stage 0
```

There is no loading screen. The opening image is a capture of the scene's own first frame, so the page shows the room within about a second and crossfades into the live canvas.

### Rules, each from a measurement

- **The opening image must be the first live frame.** Capture it with `scripts/capture-opening.mjs` from the production build at DPR 1.75, with boot-quality assets and DOM overlays hidden. A DPR 1 capture read as a focus pull during the crossfade. Re-capture whenever the opening frame changes.
- **Three compositions** (ultrawide, landscape, portrait). The vertical field of view is fixed, so a wide capture is valid for any narrower aspect but never a wider one.
- **WebP only.** AVIF saved 2 to 4%, not worth a second format.
- **Scene preloads start when the opening image has loaded**, not with the page. Started together, 3.5 MB of scene files held a 122 kB image back to 9.5 s on Slow 4G; gated, it appears at about 2 s.
- **Preload hints and the preflight list must match** (`heroAssets.js`, `criticalAssets.js`).
- **Decode textures to `ImageBitmap` off the main thread.** Synchronous decode at upload cost 120 ms in one frame. Read bytes with `arrayBuffer()`, not `blob()`, which failed on preloaded responses under throttling. The bitmap flip behaviour is tested at runtime, not assumed.
- **Bind a render target before `gl.compile`.** Programs are keyed on the target's tone mapping and colour space; compiling without one builds the wrong variants and the first frame links them all again.
- **Input before the reveal is recorded as one intent**, not dropped and not replayed in bulk.

### Boot quality and deferred upgrades

Anything too small in the opening frame to resolve ships at low resolution and is upgraded in place after the reveal. Three rules keep the exchange invisible:

| Rule | Cost when broken |
|---|---|
| Upload one texture per frame | 170 ms frame |
| Never change `scene.environment`'s identity; re-render into the same target | 192 ms frame, 16 program links |
| Never fill an empty texture slot; start with one-texel stand-ins | 74 ms link |

A direct jump to a section waits for that section's full-resolution maps (`ensureSectionAssets`) rather than landing on a degraded close-up.

### Startup figures (previous build, production, Chrome)

```text
                    image starts   live 3D        interactive
Fast 4G cold           0.41s        4.41-4.53s     4.85-4.98s
Slow 4G cold        2.06-2.11s     20.61-20.69s   20.99-21.09s
cached              0.26-0.35s      0.92-1.01s     1.32-1.43s
phone 4x, Fast 4G      0.36s        5.80s          6.21s
```

Profiles: Fast 4G is 9 Mbps down, 60 ms latency. Slow 4G is 1.6 Mbps down, 150 ms latency. Use these definitions for every future measurement. Critical payload before the reveal was 4,250,696 B over 24 transfers. The new scene should not exceed it without a reason.

### What the browser metrics mean here

- LCP reports the wordmark button under the cover, not anything visible.
- A full-viewport image is never reported as LCP by Chrome.
- FCP misses the image while it fades in.

Visual readiness is the opening image (filmstrip); interactive readiness is the end of the crossfade.

---

## 9. Asset encoding and delivery

- **Content fingerprinting.** Files under `public/textures`, `models`, `environment` and `media` are hashed into their filenames at build and served `immutable` (`vite.config.js`, `vercel.json`). URLs are resolved through `assetUrl()`.
- **Chunks.** three, React and GSAP are separate vendor chunks so a deploy re-downloads only app code.
- **Vercel already serves GLB and HDR files with brotli.** Do not add pre-compressed copies.
- **WebP quality by map type:** normals at 90, packed occlusion-roughness at 85, with libwebp's sharp-YUV option. Normals at 85 visibly doubled shading error. Albedo maps are not re-encoded; they came out larger or saved almost nothing.
- **Lossy WebP is always 4:2:0.** There is no 4:4:4 option; do not document one.
- **KTX2 was measured and rejected** for now: ETC1S barely reduced bytes while the transcoder added 260 kB to the critical path. It did cut texture memory from about 48 MB to 12 MB, so revisit only if mobile GPU memory becomes a demonstrated problem.
- **Re-encoding textures inside already-optimised GLBs made them larger.** Resolution is the only remaining lever on texture bytes.
- **An opening-only low-detail model swap was tested and rejected.** It saved little at startup, was visible in the opening, and made direct navigation slower.
- Originals live in `asset-sources/`; `scripts/` regenerates what ships. Pipeline tools are installed with `--no-save`.

### Verifying a texture change

Comparing renders between texture builds is easy to get wrong. The protocol that works:

1. Prime the HTTP cache so both builds load at the same speed.
2. Wait for every deferred upgrade in both.
3. Reach stages through the app's own section targets.
4. Hide the DOM UI.
5. Capture five frames per stage and median-combine them.
6. Compare predefined matching stages, never a best-matching pair.
7. Run baseline against baseline first to get a noise floor.

---

## 10. Viewport, resize and mobile

- **Framing is solved, not scaled.** Each stationary shot declares what it must show as a depth profile, and `viewportFit.js` solves the camera distance that keeps all of it in frame with an 8% safe area. Desktop framing is the floor and is never changed by the fit.
- **The canvas follows the visible viewport.** `--app-height` is set from `visualViewport.height` from the first line of `index.html`, ignoring pinch zoom and jitter under 2 px.
- **A resize must not move the camera.** Scroll progress depends on the viewport twice, so progress is held across the whole layout change and restored afterwards. A held value is dropped, not restored, if a navigation move owns the scroll position.
- When testing by script, the scroll offset for progress `p` is `(scrollHeight - innerHeight) * p`.

---

## 11. Safari and cross-browser

Safari is a first-class target, tested throughout rather than at the end.

- Find the root cause before adding a browser-specific workaround.
- Safari's resource timing lists a preloaded file twice. That is not a second download.
- **Open issue carried over:** WebKit dates a CSS transition from the start of the frame in which the class changed, so the reveal crossfade is cut short and reads as a slight pop. Likely fix: run the fade with the Web Animations API.
- Not yet verified on a real iPhone or iPad. All mobile figures so far are Chrome device emulation.

---

## 12. Accessibility and failure

- Semantic HTML for all DOM UI; every control has an accessible name and is keyboard reachable.
- Reduced motion: stage changes are immediate, the startup fade is removed, grain is frozen.
- A scene that cannot start reports it on the startup cover with a retry. A model that fails to load costs that object, not the page (`LoadErrorBoundary`).
- Work, About and Contact are always reachable without WebGL.

---

## 13. Performance priorities

```text
1. Input responsiveness      5. Lighting continuity
2. Camera smoothness         6. Asset loading
3. Scroll synchronisation    7. Visual fidelity
4. Stable frame rendering    8. Secondary effects
```

A stable 60 fps is better than an unstable attempt at 120. Under pressure, reduce in this order: secondary effects, atmosphere, post-processing, material complexity, geometry detail. Camera, sequence and lighting are protected.
