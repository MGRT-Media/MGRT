# MGRT Creative Table — Technical Architecture

How the Creative Table experience is built. What the visitor sees is defined in `creative-table-spec.md`; this document must not redefine it.

Sections 1 to 6 describe the target architecture for the redesign. Section 7 onward records **measured findings from the previous build that still apply**. The full tables and methods behind them are in `archive/greek-room/technical-architecture.md` (§13 to §17).

> Status: sections 2 to 6 describe what is built, through Phase 3. Table contents, interaction and the new scene's own startup image are later phases.

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
  studioLook.js              every surface finish and atmosphere setting
  studioAssets.js            preflight: textures and the lettering model, before mount
  studioMaterials.js         plaster, stone, steel, floor and bronze (and the kept walnut), built from studioLook
  walnutBoards.js            the walnut top's board pattern; unused while the table is stone
  studioGeometry.js          walls and the table, with UVs in metres
  StudioRoom.jsx             the room and table
  WallLettering.jsx          the bronze wordmark, from the lettering GLB
  StudioDust.jsx             motes in the two beams
  ZoneGuides.jsx             TEMPORARY outlines of the three table areas (?guides)
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
| Assets | the scanned-texture loader `materials/scannedStone.js` (off-thread decode, one copy per set), `materials/stoneMacroVariation.js`, `assets/assetUrl.js`, the fingerprint plugin, and the `textures/floors` set |
| Shell | `App.jsx`, the router, `GlobalNav`, `ui/SiteMark.jsx`, `timeline/sectionNavigationEvent.js`, `hooks/useViewportHeight.js` |

To be adopted in later phases:

| Area | Modules |
|---|---|
| Framing | `timeline/viewportFit.js` (Phase 2) |
| Assets | `models/modelAssets.js`, `models/propTextureUpgrades.js` (Phase 4, when the table gets models) |
| Loading | boot-quality variants and deferred upgrades (Phase 6) |
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
- **Portrait.** Below an aspect ratio of 0.9 a stage's `portrait` object replaces fields of its camera: the viewing direction, what to frame, and how large. Portrait keeps the desktop's three-quarter angle and frames a deliberate crop of the table, because the whole table cannot span a phone's width from inside the room. A shot's `bounds` may be a list of boxes framed together (the portrait table shots hold the whole wordmark above the table), and `centerY` sets the subject lower in the frame.
- The solve runs when the aspect ratio changes, not per frame, and moves that stage's points on the path splines.
- **No ceiling in frame, ever.** No sight line may land on a wall within 0.15 m of the ceiling, and no light fixture's position may be in frame. `stageFraming.js` enforces it by lowering a shot's aim until it complies: once when a stage is resolved, and every frame in the sampler, because between two compliant shots the camera can rise faster than its aim falls. The per-frame check is ten ray tests with scratch objects and does nothing more when the shot is already clear.
- **Not yet built:** easing of a re-fit on resize, and direct flights between Film, Digital and Overview that do not pass through the stage between (Phase 5). `goToStage(n)` already exists for navigation to call.

---

## 5. Lighting and atmosphere

Fixtures are defined in `studioLayout.js` (`LIGHTS`); how much of each a stage uses is its `lights` levels in `stageBeats.js`.

| Light | Type | Role |
|---|---|---|
| `lettering` | Spot, shadow-casting | Warm architectural spot on the wall identity, from the ceiling 2.3 m out from the wall |
| `tableKey` | Spot, shadow-casting | Large soft key over the table, from the Film side |
| `fill` | Directional, no shadow | Warm light coming back off the lit wall across the table |
| `ambient` | Hemisphere | The dim return of the two spots off plaster and wood |

- Every light exists from the first frame at intensity zero. Raising one is a change of a number, so no material recompiles when a stage begins.
- Levels are read through `contentValue()` on the camera's own progress and interpolate linearly between stages, so lighting is continuous and exactly reversible. `StudioLightingRig.jsx` publishes the current levels in `lightLevels`, which the dust also reads.
- **Two shadow maps, both frozen: 2048 for the lettering, 1024 for the table key** (the coarser map gives the table's shadow a wider soft edge). The plan was one; the lettering needs its own, because the gap between the letters and the wall is only visible through the shadow they drop. Nothing in the room moves, so each map is drawn once (`shadowUpdates.js`): the second costs memory, not frames.
- **Reflections follow their light.** The bronze, the stone and the steel reflect a small blurred studio interior (three's `RoomEnvironment`, prefiltered once). It is set on those two materials only, not as the scene's environment, so it is not an ambient light. Its strength is scaled each frame by the level of the light that surface belongs to; otherwise polished surfaces would glow in a dark room.
- **Haze** is exponential fog at a low density. **Dust** is one draw call of 320 points that light themselves: each works out in the vertex shader whether it is inside either spot's cone, from the same fixture definitions, and takes that light's colour and level. Outside a beam it is given no size.
- The fixture positions are also what the framing guard keeps out of frame (§4), so moving a light can tilt a shot. The whole-path audit is re-run after any change to `LIGHTS`.

---

## 6. Materials, models and post-processing

All finishes are in `studioLook.js`.

### Materials

- **Plaster** is a Poly Haven scan and the **stone** an ambientCG scan (sources and licences in `asset-sources/README.md`), shipped as the three files the existing scanned-texture loader reads: colour, OpenGL normal, and roughness packed in the green channel. Every map is in place when a material is created; nothing is swapped after the reveal.
- **UVs are in metres** (`studioGeometry.js`), so a texture's repeat is one over its scan's recorded size and it lands at real scale on anything.
- **Walls turn into the floor through an 80 mm plaster cove** (`ROOM.coveRadius`). Wall and cove are one sheet, laid out flat with UVs along the surface and then rolled, so nothing stretches round the curve. The plaster's tone falls toward the floor (`LOOK.plaster.base`), baked into the vertices; a cove left pale faces the light and reads as a bright skirting.
- **Plaster** is tinted warm. The walls carry a slow, wall-sized drift in tone baked into their vertex colours, which is what stops a 1.5 m scan reading as a grid across a 9 m wall.
- **Table.** `LOOK.tableFinish` chooses the finish; it is `'stone'`. The stone table (`buildStoneTable`, sizes in `TABLE.stone`) is a 50 mm slab built as a sweep of its edge profile (9 mm round over, 5 mm under) round an outline with 45 mm corners, with true normals throughout; two stone pedestals with rounded edges standing across it, 0.6 m in from each end; and a recessed blackened-steel plate between each pedestal and the slab as a shadow gap. Material: honed stone (ambientCG Marble 024, its polished roughness re-centred to 0.62 in the build, repetition broken up by `antiTiling.js`). The slab's UVs wrap over its edges, so veins run down the edge instead of restarting there.
- **Walnut (kept, unused).** The earlier finish is complete and selectable with `tableFinish: 'walnut'`: the same geometry in one material, with the boards drawn by `walnutBoards.js`. Its textures stay in `public/` but are not requested while the table is stone.
- **Floor** is the original scene's scanned concrete, held dark, with its repeat broken up the same way as the plaster and a contact shade baked in along the walls (`LOOK.floor.wallShade`).
- **Repetition** on plaster and concrete is broken up by `antiTiling.js`: each map is read from two of eight offsets into the scan, chosen and blended by a slow noise, so neighbouring patches come from different parts of the scan. Patched before first compile; one extra texture read per map.
- **Bronze** has no texture: colour, roughness and the reflection above.

### Wall lettering

- `public/models/studio/wall-lettering.glb`, built from Cormorant instantiated at weight 500 (the font is variable and defaults to Light). Geometry only; 475 kB.
- 30 mm deep with a 1.4 mm chamfer, standing 20 mm off the wall, at the approved position and footprint.

### Texture resolution

Chosen from how close the camera gets: plaster 1024 / 768 / 512 (colour / normal / roughness); stone 2048 / 1024 / 1024 (walnut, kept, the same), because the tabletop is the subject of the close stages and its grain is fine lines.

### Post-processing

`StudioDepthOfField.jsx` runs render, ambient occlusion (GTAO), depth-aware bokeh and output. The focal plane sits on the current stage's look-at point, read from the stage definitions, so the lens knows nothing about the room's geometry. Dust is drawn in the main scene; it does not write depth, so the blur behind it is decided by the room.

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
