# MGRT Creative Table — Technical Architecture

How the Creative Table experience is built. What the visitor sees is defined in `creative-table-spec.md`; this document must not redefine it.

Sections 1 to 6 describe the target architecture for the redesign. Section 7 onward records **measured findings from the previous build that still apply**. The full tables and methods behind them are in `archive/greek-room/technical-architecture.md` (§13 to §17).

> Status: sections 2 to 6 are the approved plan, not yet implemented. Module names under `studio/` are proposed and may change during the foundations phase. Room dimensions and camera poses are deliberately absent: they are set only after the blockout has been validated in the browser.

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

- The new scene is built beside the old one under `src/experience/studio/`, with its own root component.
- `Home.jsx` mounts one experience or the other through a single switch. The old scene stays the default until cutover.
- Shared modules (camera rig, progress plumbing, loading, post-processing) may be generalised, but only in ways that leave the old scene's behaviour unchanged. Where that is not practical, the new scene gets its own module rather than a fork inside the old one.
- Greek-room source and assets are deleted only in the cutover phase.

---

## 3. Scene structure

```text
src/experience/
  studio/
    studioLayout.js        room, table, lettering and zone dimensions (single source)
    StudioExperience.jsx   canvas root for the new scene
    StudioRoom.jsx         walls and floor
    CreativeTable.jsx      the table
    WallLettering.jsx      the lettering GLB and its material
  lighting/
    studioLighting.js      light definitions and per-stage levels
    StudioLightingRig.jsx  applies them each frame
  timeline/
    beats.js               the six stages: progress, camera pose, look-at, field of view, light levels
    (camera rig, progress and navigation modules, reused)
  postprocessing/  loading/  models/  materials/  ui/     (reused)
```

### Centralised definitions

Two modules hold every number that describes the experience:

- **`studioLayout.js`** — where things are: room size, table size and position, lettering position, the Film, MGRT and Digital zones.
- **`beats.js`** — what happens at each stage: its progress value, camera pose, look-at target, field of view and light levels.

Camera, lighting, depth of field and navigation read from these. No component holds a position or a progress literal. This replaces the previous arrangement, where `cameraPath.js` and `DepthOfField.jsx` imported anchors directly from scene components and could not outlive them.

### What is reused

| Area | Modules |
|---|---|
| Progress | `timeline/journeyProgress.js`, `timeline/contentProgress.js` |
| Camera | `timeline/ScrollCameraRig.jsx` (damping, slerp, settle event), `timeline/sectionFlight*.js` (direct navigation), `timeline/viewportFit.js` |
| Scroll | `timeline/smoothScroll.js`, the one-gesture-per-leg model and the resize hold from `ScrollTimelineProvider.jsx` |
| Loading | everything under `loading/`, the startup cover in `index.html`, the fingerprint plugin in `vite.config.js` |
| Assets | `models/modelAssets.js`, `models/propTextureUpgrades.js`, the scanned-PBR loader in `materials/scannedStone.js`, `assets/assetUrl.js` |
| Rendering | `postprocessing/DepthOfField.jsx`, `lighting/shadowUpdates.js`, the dust system in `lighting/volumetricLighting.js`, `ui/GrainOverlay.jsx` |
| Reference | `impact/impactStage.js`, `impact/ImpactStage.jsx`, `impact/tableWood.js`: an earlier table with an elevated three-quarter pose and aspect-aware framing |

### What is retired at cutover

`architecture/*`, `Environment.jsx`, `lighting/SunsetSky.jsx`, the sun and sky rig, `impact/heroPlate.js`, `impact/stageSwap.js`, `timeline/filmActBeats.js`, and the Greek-room camera path. `film/CinemaCamera.jsx`, `digital/Monitor.jsx` and the two videos are kept as candidates for table objects.

---

## 4. Scroll and camera

### Scroll

- Scroll is a normalised progress value. Six stages are six stops on it.
- One scroll gesture moves one stage, as the current chapter navigation does.
- Progress lives in mutable module objects, never React state.
- The intro cinematic, the lens-hold locks and the automatic final beat from the old timeline are not carried over.

### Camera

- The existing damped rig is kept: arc-length damping for position, quaternion slerp for rotation, and a settle event when the camera comes to rest.
- The path is a spline through the stage poses in `beats.js`. **No complex path is authored until room proportions and framing have been validated in the blockout.** Until then, poses are simple and adjustable.
- Each stage's framing adapts to the viewport through `viewportFit.js` (§10).
- Direct navigation between Film, Digital and Overview uses the existing section-flight system, which blends content state along the way so lights do not pop.

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

The chain is kept: render, ambient occlusion (GTAO), depth-aware bokeh, dust, output. Focus targets come from the beats instead of prop anchors.

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
