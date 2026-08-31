# MGRT Media — Build Status

---

## 1. Purpose

This document records the **current implementation state of the MGRT Media website**.

It is the project's source of truth for:

- Current development phase
- Current approved scope
- Completed phases
- Pending phases
- Known issues
- Active technical constraints
- Previously approved visual decisions
- Current Git checkpoint
- Next approved work

This document must remain **accurate and current** throughout development.

Claude must read this document before beginning implementation work.

### Phase terminology

For clarity, the following terms have specific meanings:

- **Current Phase** — the phase currently being implemented or reviewed.
- **Approved Phase** — the most recent phase that has received explicit human approval.
- **Current Approved Scope** — the work Claude is currently authorized to implement.
- **Phase Status** — the implementation state of the current phase.
- **Approval Status** — whether the current phase has received human approval.

For a new project, the Current Phase may be Phase 1A even when no phase has yet received human approval. In that situation, Phase 1A is the authorized starting scope, not an already-approved phase.

---

## 2. Current Project State

**Project:** MGRT Media
**Status:** In active development
**Current Phase:** Phase 1D — Digital / Monitor Foundation
**Phase Status:** Technically complete, pending human approval
**Current Objective:** Establish the physical monitor anchor, provisional screen surface, and the Phase 1C→1D scroll handshake that aligns the camera with the screen face.

### Current approval state

```text
PHASE 1A — Environment Shell
STATUS: APPROVED (2026-08-31, human review)

PHASE 1B — Atmosphere & Light
STATUS: APPROVED (2026-08-31, human review)

PHASE 1C — Camera & Scroll
STATUS: APPROVED (2026-08-31, human review)

PHASE 1D — Digital / Monitor Foundation
STATUS: TECHNICALLY COMPLETE
APPROVAL: NOT YET GRANTED
```

Claude must work only within the currently approved scope unless explicitly instructed otherwise.

---

## 3. Phase Progress

```text
PHASE 1
├── 1A — Environment Shell              APPROVED
├── 1B — Atmosphere & Light             APPROVED
├── 1C — Camera & Scroll                APPROVED
└── 1D — Digital / Monitor Foundation   TECHNICALLY COMPLETE

PHASE 2
├── Film                                NOT STARTED
├── Digital                             NOT STARTED
└── Campaigns                           NOT STARTED

PHASE 3
├── Return                              NOT STARTED
├── Final MGRT Identity                 NOT STARTED
└── Explore Transition                  NOT STARTED

PHASE 4
├── Portfolio Media                     NOT STARTED
├── Audio                               NOT STARTED
├── Responsive Composition              NOT STARTED
└── Interaction Refinement              NOT STARTED

PHASE 5
├── Performance                         NOT STARTED
├── Safari                              NOT STARTED
├── Accessibility                       NOT STARTED
├── Reduced Motion                      NOT STARTED
└── Final Polish                        NOT STARTED
```

### Status definitions

Use the following status values consistently:

- **NOT STARTED** — work has not begun.
- **IN PROGRESS** — implementation is actively being developed.
- **TECHNICALLY COMPLETE** — implementation and required testing are complete, but human approval has not yet been granted.
- **APPROVED** — human review has been completed and the phase is approved.
- **BLOCKED** — progress cannot continue because of an unresolved dependency or issue.
- **DEFERRED** — intentionally postponed for a later decision.

---

## 4. Phase 1D — Digital / Monitor Foundation

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

### Scope note — cinema-camera object deferred to Phase 2

The initial Phase 1D authorization prompt asked for both a cinema-camera mesh and a monitor mesh. This conflicted with `build-workflow.md` §10, which explicitly states *"Phase 2 will build the final Film act and integrate the final cinema-camera object"* and scopes Phase 1D's objective to monitor-only work. Flagged to the human rather than silently resolved; the human confirmed monitor-only scope and re-issued the authorization accordingly. **No cinema-camera mesh exists yet — it remains Phase 2 scope**, per the governing document.

### Objective
Establish and prove the technical and cinematic foundation of the Film → Digital transition: monitor geometry, monitor placement, screen surface, provisional screen content treatment, the camera→monitor scroll handshake, spatial relationship between camera and monitor, and continuous lighting relationship, per `build-workflow.md` §10.

### In scope
A provisional/simplified physical monitor anchor positioned within the Phase 1B light beam's path; an unlit procedural test-pattern screen shader with a glow read; extending the Phase 1C camera path with a final scroll segment that glides the camera into a shot squarely aligned with the screen face, using the same Lenis+damp motion physics as the rest of the path (no separate/abrupt transition mechanism).

### Out of scope
The cinema-camera mesh (Phase 2, see scope note above), final portfolio/Digital media, Phase 2 Film/Digital/Campaign content, interactive UI, audio.

### Review criteria
No brightness/exposure/fog/volumetric snap, no camera jump, no monitor pop-in, no scene reset, no animation discontinuity, no screen-content pop-in, no timeline desynchronization, per `build-workflow.md` §10's mandatory verification list.

### Current implementation notes

- `src/experience/digital/Monitor.jsx` — a declarative R3F component (base, neck, body/frame, screen, glass), following the same pattern as `Environment.jsx`. Exports `MONITOR_ANCHOR` (position, screen dimensions, screen center height) as the single source of truth for the monitor's placement — **positioned exactly at `lightingParams.target`** (`[0.6, 0, -3.5]`, imported from `volumetricLighting.js`), so the monitor stands physically within the Phase 1B beam's floor target rather than being placed independently and coincidentally overlapping it. Body/base/neck use a dark brushed-metal `MeshStandardMaterial` (`metalness: 0.7–0.75`, moderate roughness) so they pick up the ambient and volumetric light naturally; a thin `MeshPhysicalMaterial` glass pane (`transmission: 0.85`, low roughness) sits just in front of the screen for a subtle reflective read. `castShadow`/`receiveShadow` enabled so the monitor participates in the existing shadow-casting light like the rest of the architecture.
- `src/experience/digital/screenTestPatternMaterial.js` — a small unlit `ShaderMaterial`: an 8-bar SMPTE-style color-bar test pattern with a faint scanline modulation and a soft vignette. `toneMapped: false` so the pattern reads as a genuinely glowing/illuminated surface against the dark, tone-mapped room without needing a real light source or post-processing bloom — satisfies "slight emission/glow" without adding actual scene illumination (kept the "one light" narrative thread from `creative-reference.md` intact; the screen looks lit, it doesn't cast light).
- `src/experience/timeline/cameraPath.js` — extended from 4 to 5 keyframes: the existing hero→approach→anchor path (now at `t: 0, 0.25, 0.5, 0.75`) plus a new `t: 1.0` keyframe computed from `MONITOR_ANCHOR` itself (not hand-tuned numbers) — centered on the screen's X/Y, offset `+2.1` along Z from the screen face for a comfortably framed, squarely-aligned shot. Because it derives from `MONITOR_ANCHOR`, this final shot stays correct automatically if the monitor's position or dimensions ever change. Same deterministic, stateless, reversible `sampleCameraPath(progress)` function as Phase 1C — no separate transition mechanism, so the glide into monitor alignment uses the exact same Lenis-smoothed, `THREE.MathUtils.damp`-eased motion as the rest of the path, with no special-cased jump.
- `src/experience/CinematicExperience.jsx` — mounts `<Monitor />` as a sibling to `<Environment />` (matching `technical-architecture.md` §5's scene hierarchy, where Digital/Monitor is its own branch, not nested under Environment).
- No Phase 1A/1B/1C code was changed beyond `cameraPath.js`'s keyframe extension (additive — the first four keyframes and their positions/lookAts are untouched).

### Known issues
*None new.* See §6 for the carried-over Phase 1A/1B/1C issues (bundle size, dev-only esbuild advisory — bundle size effectively unchanged this phase, no new dependency added).

### Required next step
Phase 1D is technically complete and awaiting human visual review and explicit approval before Phase 2 begins.

Do not begin Phase 2 until Phase 1D is explicitly approved.

---

## 4A. Geometry Refinement — Entrance Pillars (cross-cutting, Phase 1A revision)

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Requested directly by the human (not phase-authorized work) during the Phase 1D review window: a foreground pillar pair at the room's entrance, framing the monitor and giving the opening view an immediate sense of depth/parallax as the camera passes between them. This revises the approved Phase 1A column layout, so it's recorded here rather than folded into Phase 1D's own record.

### What changed
- `src/experience/Environment.jsx` — added `entrancePillarPositions` (`[-2.2, 4]`, `[2.2, 4]`), rendered with the same shared `columnGeometry` and Tier-1 (`SURFACE_TONE.column`) material as the existing side colonnade — same shading, same profile, no new geometry or material system introduced.
- Placement reasoning: the camera's first path segment (hero `[0, 1.6, 9]` → `t: 0.25` keyframe `[0, 1.6, 5]`, per `cameraPath.js`) holds `x: 0` at both ends, so the pillars sit safely off the camera's actual line of travel (clearance ≈1.8 units from the column surface to the camera path at closest approach) while still reading as a "gateway" the camera glides through, per `technical-architecture.md` §6's "no camera teleportation" — this is geometry placement around an existing path, not a path change (the camera path itself was not modified).
- No other Phase 1A/1B/1C/1D code touched. Column count is now 10 (8 side colonnade + 2 entrance).

### Verification
- Tuned iteratively via direct screenshot comparison — an initial placement attempt (`[∓1.5, 7]`, then `[∓1.8, 5.5]`) put the pillars far enough into the camera's near field that they read as full-height foreground bands filling the frame edges rather than a clean gateway frame; corrected to `[∓2.2, 4]` for a comfortably framed opening shot. (A `resize_window` viewport mismatch briefly made an earlier placement attempt look broken in one screenshot — traced to the browser pane defaulting to a near-square aspect rather than 16:9; re-tested at an explicit 1280×720 viewport, which is what the final placement was actually tuned against.)
- Verified no clipping: scrolled through the segment where the camera passes nearest the pillars (~30–35% progress) — clean pass-through, no geometry intersecting the view, no z-fighting.
- Verified reversibility: scroll to ~50% (pillars behind camera) and back to 0% reproduces the exact hero frame.
- Production build succeeds; no console errors; frame-timing re-measured under a simulated scroll-gesture burst — no regression (~16.6ms avg, 0 frames over 33ms); mobile viewport renders cleanly with no errors (the pillars fall outside portrait's narrower horizontal FOV at this position, which is expected — mobile-specific recomposition remains out of scope until Phase 4, per `build-workflow.md` §6).

### Required next step
Awaiting human visual review and approval of this geometry revision. Not gating Phase 1D's own approval, but should be reviewed alongside it since it touches the same environment.

---

## 4B. Fix — Shadow/Frustum Hardening After Entrance Pillars

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human report: adding the entrance pillars introduced scroll jitter and high-frequency light flickering/strobing.

### Investigation

Before changing anything, attempted to reproduce the reported artifact directly rather than guessing:
- **Static spatial sampling:** read pixel values across a 7×7 grid at a pillar/floor contact point (the classic shadow-acne location) — no speckled noise pattern, values were smooth (2 near-identical values across the whole neighborhood).
- **Temporal sampling during active scroll:** read a fixed screen-space pixel every animation frame for ~150 frames while continuously scrolling through the pillar pass-through segment — values changed smoothly and monotonically (consistent with the camera moving through lit/shadowed/beam-overlap regions), no oscillation or back-and-forth flipping between frames.
- **Frame-timing during the pass-through:** 168 frames sampled, ~16.6ms average, 0 frames over 20ms or 33ms — no stutter/frame-drop detected.
- **Console:** no WebGL/shadow-map warnings at any point.

None of these turned up a reproducible artifact in this environment. This doesn't mean the report is wrong — shadow-map aliasing/shimmer is highly GPU- and driver-dependent, and this sandboxed Chromium environment may render shadows differently than the reviewer's actual hardware. Rather than claim a fix for something unobserved, applied the technically appropriate preventative hardening below, and I'm flagging that on-device confirmation is still needed.

### What changed
- `src/experience/lighting/volumetricLighting.js` — added `spotLight.shadow.normalBias = 0.02` (new `lightingParams.shadow.normalBias`). **Did not** apply the literal `shadow.bias = -0.0001` suggested in the request: the current tuned `bias` is `-0.0012`, and `-0.0001` has a *smaller* magnitude, which would move shadow-acne risk in the wrong direction (weaker depth bias, not stronger). `normalBias` is the standard, more correct fix for acne specifically on curved geometry like the cylindrical pillars — it offsets along the surface normal rather than only in depth, avoiding acne without introducing peter-panning the way over-correcting `bias` can. Left the existing `bias` value untouched since there's no evidence it needs to change.
- `src/experience/CinematicExperience.jsx` — lowered the camera `near` plane `0.1 → 0.05`, giving more clearance margin against near-frustum popping now that the entrance pillars bring foreground geometry closer to the camera than anything in the scene before them.
- Camera trajectory clearance from the pillars was already verified when they were added (~1.8 units at closest approach) and is unchanged here, since the camera path itself was not touched by this fix.
- Re-verified (unchanged, re-confirmed by grep and code review): `ScrollCameraRig.jsx` still drives the camera exclusively via `THREE.MathUtils.damp` inside `useFrame` using the real frame `delta`, reading from the Lenis/GSAP-smoothed `scrollProgress.value`; no `useState`/`setState` anywhere in the scroll, camera, lighting, or digital-anchor code paths.

### Verification
- Production build succeeds; no console errors.
- Re-ran the pass-through scroll test and reversibility check (0% → 33% → 0%) after the changes — visually identical to before, no regressions, matches the approved baseline exactly at rest.
- Re-ran frame-timing under a simulated scroll-gesture burst: 180 frames, ~16.6ms avg, 0 frames over 33ms — no change from pre-fix measurement.
- Mobile viewport re-checked: renders cleanly, no console errors.

### Required next step
**On-device confirmation needed.** The reported flicker/jitter could not be reproduced or measured in this sandboxed environment despite targeted spatial, temporal, and frame-timing testing. The preventative fixes above (`normalBias`, tighter near plane) are technically sound regardless and were verified to introduce no regressions, but please re-check on the hardware/browser where the artifact was originally observed and report back whether it's resolved — if it persists, more specific repro details (browser, GPU, approximate scroll position/speed) would help pin down the actual cause.

---

## 4C. Fix — Camera/Monitor Transition Light Pop

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human report: a slight light shift/jolt right as the camera transitions from the close-up approach to squarely aligned with the monitor screen.

### Root cause (computed, not guessed)

Worked out the beam-axis geometry rather than assuming: the camera's final "squarely aligned with the screen" position sits a perpendicular distance of ≈1.18 units from the volumetric halo cone's axis, at a point along that axis where the cone's radius is ≈2.69 — i.e. the camera ends up **inside** the halo shell by a margin of ≈1.5 units. The previous keyframe (`t: 0.75`, the close-up approach shot) sits **outside** the shell by a margin of ≈0.69. Somewhere between those two keyframes — worked out to be around progress ≈0.82 — the camera crosses from outside to inside a hollow, double-sided, additively-blended shell. That crossing is a well-known source of a brightness "pop": outside the shell the camera sees both the near and far faces of the cone (two additive layers); once the near-clip plane cuts through the shell as the camera enters it, only one face remains in view, roughly halving the accumulated additive brightness in a single frame.

This is geometrically inherent to the composition, not a bug to "clip out": the monitor stands exactly at the beam's target, near the cone's widest point, by design (Phase 1D deliberately placed it "within the volumetric beam's path"). A camera squarely framing the monitor from a reasonable distance will unavoidably be near or inside the same cone the monitor sits in — repositioning the final camera keyframe to stay outside the cone isn't possible without abandoning the squarely-aligned framing. So the fix is the one the request itself offered as the alternative: fade the beam's opacity out across the crossing, so there's nothing left to pop by the time the camera arrives.

### What changed
- `src/experience/lighting/volumetricLighting.js` — the controller's `update(progress)` is no longer a no-op. It now fades the shaft (halo + core) and floor-pool opacity via `1 - THREE.MathUtils.smoothstep(progress, BEAM_FADE_START, BEAM_FADE_END)`, with `BEAM_FADE_START = 0.7` and `BEAM_FADE_END = 0.88` — chosen from the crossing-point math above (fade begins at the tail of the approach shot, is fully complete well before the crossing at ≈0.82). Each shaft mesh and the floor pool now store their `baseOpacity` in `userData` at build time so the fade multiplies against the original tuned value rather than a hardcoded number. This is a deliberate, narrowly-scoped exception to "Phase 1B lighting is static" — everything else about the light stays unanimated; only this fade responds to scroll, and only to prevent the transition pop.
- `src/experience/lighting/VolumetricLightingRig.jsx` — now calls `controller.update(scrollProgress.value)` inside a `useFrame`, reading the same plain mutable `scrollProgress` object `ScrollCameraRig.jsx` already uses. No React state introduced.
- **Camera position/lookAt damping (requested, already correct):** `ScrollCameraRig.jsx` already used the identical `DAMP_LAMBDA` and the same per-frame `delta` for both `camera.position` and the look-at target — verified this is genuinely synchronized (same exponential decay factor applied to both each frame, so they close the same *proportion* of their respective remaining distance every frame) and made no change here, since it already satisfied the request.
- **LookAt perpendicularity (requested, already correct):** confirmed by direct vector math that `MONITOR_ALIGNED_POSITION` and `MONITOR_ALIGNED_LOOKAT` (`cameraPath.js`, unchanged) differ only along +Z — camera position minus lookAt is a pure `(0, 0, 2.1)` — which is exactly perpendicular to the screen plane's normal. No change needed; confirming this here since the request asked for verification, not just a fix.
- `src/experience/digital/Monitor.jsx` — explicitly set `castShadow={false} receiveShadow={false}` on both the screen and glass meshes (previously relying on the three.js/R3F default of `false`, now made explicit so it can't silently regress). Documented that the screen's test-pattern material is a raw unlit `ShaderMaterial` with no PBR lighting model, so "roughness/metalness balance" doesn't apply to it — its glow is the shader's own fragment output, unaffected by scene lighting or shadows by construction.

### Verification
- Scrolled through progress 0%, 60%, 70%, 82%, and 100%: beam at full strength through 60–70%, visibly fading by 82%, fully faded and invisible by 100% — smooth, no visible pop at any sampled point.
- Verified reversibility: scrolled back from the faded end state through 60% (beam returns to full strength) to 0% (pixel-identical to the approved baseline).
- Frame-timing re-measured under a simulated scroll-gesture burst with the new per-frame `update()` call active: 180 frames, ~16.6ms avg, 0 frames over 33ms — no regression.
- Production build succeeds; no console errors; grep-confirmed no `useState`/`setState` anywhere in the scroll/camera/lighting/digital paths; mobile viewport re-checked, renders cleanly.

### Required next step
Awaiting human visual review — please confirm the jolt is resolved when scrubbing through the camera→monitor transition.

---

## 4D. Phase 1B Rebuild — Clean Lighting Architecture

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human request: clear out the accumulated Phase 1B lighting/volumetric setup (built up across three tuning passes plus two reactive fixes) and rebuild from scratch with clean, production-stable R3F practices — replacing runtime patches with a genuinely simpler, more robust architecture. Phase 1A architecture (including the entrance pillars) and the Phase 1D monitor were retained unchanged; only `src/experience/lighting/` was rebuilt.

### What was removed
- The scroll-coupled beam-opacity fade from §4C (`BEAM_FADE_START`/`BEAM_FADE_END`, `VolumetricLightingRig`'s `useFrame` call into `controller.update(scrollProgress.value)`) — this was the most recent "hack": a runtime patch tied to specific camera-path progress values, fragile to future path changes.
- The two-mesh "core + halo" nested-cone shaft with a fresnel view-angle shading term — extra shader complexity that wasn't load-bearing for the room's overall readability.
- `mesh.userData.baseOpacity` bookkeeping that only existed to support the runtime fade above.

### What replaced it
- **Single-mesh beam, geometrically truncated instead of runtime-faded.** The camera/monitor transition pop (§4C) is now prevented by construction: the beam mesh's local Y only extends to `beam.lengthFraction × fullLength` from the light source — chosen (0.75) so the mesh's lowest point sits at world Y ≈ 2.0, a margin above every camera height in `cameraPath.js` (max ~1.7). The camera can never be inside this geometry, for any progress value, without needing to know or track scroll position at all. This is a stronger guarantee than the fade was: it holds even if `cameraPath.js` changes later, whereas the fade's `BEAM_FADE_START/END` were hand-tuned to the *current* path's specific numbers.
  - **Tuning note:** the first truncation attempt (`lengthFraction: 0.6`) was too conservative — it pushed the entire beam mesh above the hero shot's visible frustum, making it invisible from the opening view. Caught via screenshot comparison against the pre-rebuild reference, not assumed correct from the math alone; recalculated to 0.75, which keeps the beam dramatically visible while still clearing every camera height with margin.
  - **Opacity retuning:** collapsing two overlapping shells (core+halo, whose additive opacities effectively stacked) into one mesh meant the old per-shell opacity values (0.075/0.16) read as barely visible alone. Retuned empirically: `beam.opacity: 0.11`, `floorPool.opacity: 0.22` (up from the old floor pool's `0.075 × 1.4 ≈ 0.105`) — verified against screenshots at each step, including one intentionally-oversaturated test pass (`opacity: 0.5`) specifically to confirm the mesh/geometry itself was correct before retuning down, isolating a visibility bug from a geometry bug.
- **Added a stable directional key light** (`THREE.DirectionalLight`, non-shadow-casting, low intensity) as explicit general-room fill, per the request's "stable cinematic lighting" requirement — supplements the existing tuned ambient light rather than replacing it. `castShadow: false` deliberately, so it can't introduce a second shadow map or a second source of acne — the spot remains the sole shadow caster, preserving the already-tuned shadow direction/character.
- **`lightingParams` restructured** into `spot` / `key` / `ambient` / `shadow` / `fog` / `beam` / `floorPool` / `dust` — each light/effect's parameters grouped under its own name instead of a flat mixed namespace. Required updating the one external reference to the old flat shape: `Monitor.jsx`'s `MONITOR_ANCHOR.position` now reads `lightingParams.spot.target` instead of `lightingParams.target`.
- **Shadow config kept, not re-litigated:** `mapSize: 2048`, `bias: -0.0012`, `normalBias: 0.02` (the curved-geometry acne fix from §4B) are unchanged — these were already standard, reasonable values, not "hacks" in the sense the request meant; only `radius` (the PCF soft-shadow blur radius) was reduced `6 → 4`, a minor stability-leaning adjustment with the same standard API, not a new mechanism.
- **Three-tier surface hierarchy: verified unchanged and already correct.** `Environment.jsx`'s `SURFACE_TONE` (columns/pillars `#8c8c8c` lightest, walls `#5e5e5e`/`#565656` mid, floor `#484848` darkest) already matched the requested Tier 1/2/3 spec exactly from earlier work — confirmed by reading the file rather than assumed, no changes made.

### Verification
- Scrolled through progress 0%, 33% (pillar pass-through), 75% (close approach), and 100% (monitor-aligned) — beam visible and atmospheric in the opening view, no artifacts during the pass-through, clean truncated-geometry non-event at the transition (nothing to pop, by construction), squarely framed final shot.
- Verified full reversibility: 100% → 0% reproduces the same hero frame.
- Frame-timing under a simulated scroll-gesture burst: 180 frames, ~16.6ms avg, 18.70ms max, 0 over 33ms — no regression.
- Production build succeeds (70 modules, no errors); grep-confirmed no `useState`/`setState` anywhere in `src/`; mobile viewport renders cleanly with no console errors.
- One HMR false alarm during this pass: after the rewrite, the dev tab reported a stale `cameraPath.js` error that persisted across page reloads with an unchanged timestamp — traced to the browser tab's own HMR/error-overlay state, not the actual code (confirmed by opening a fresh tab, which showed zero errors against the same running dev server). No code change resulted from it.

### Required next step
Awaiting human visual review of the rebuilt lighting — please confirm the room, beam, and camera/monitor transition read as intended.

---

## 4E. Visual Refinement — Retro/Industrial Monitor Geometry

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human request: the flat-panel monitor read as too modern/sleek; replace it with a mid-century/retro-industrial reference-monitor aesthetic — deeper boxy chassis, thick bezel, rounded housing corners, matte industrial finish, while keeping the Phase 1C/1D camera handshake intact.

### What changed
- `src/experience/digital/Monitor.jsx` — fully rebuilt geometry:
  - **Equipment cart:** four short cylindrical legs + a rounded platform (`RoundedBoxGeometry`), replacing the previous thin pedestal-and-neck stand — reads as a retro AV/broadcast equipment cart rather than a modern monitor arm.
  - **Housing:** a deep, rounded-corner boxy chassis (`RoundedBoxGeometry`, front depth 0.55) with a smaller recessed "rear hump" box behind it (depth 0.42) suggesting a CRT tube's bulk — replacing the previous 0.07-deep flat-panel slab.
  - **Bezel:** thick, asymmetric bezel (0.13 sides, 0.12 top, 0.22 bottom for a control-panel area) around a visibly smaller screen — replacing the previous thin 0.045 margin.
  - **Control knobs:** two small cylinders on the lower bezel, a cheap, restrained retro detail.
  - **Material:** matte, mostly non-metallic (`roughness: 0.75, metalness: 0.12`) dark charcoal casing, replacing the previous brushed-aluminum-like `roughness: 0.35, metalness: 0.75` — explicitly avoids the "sleek aluminum" look per the request, while remaining a standard `MeshStandardMaterial` that still picks up the spot/key/ambient lighting normally (no special-casing needed for "retains lighting interaction").
  - Added `RoundedBoxGeometry` from `three/examples/jsm/geometries/` — bundled with the already-installed `three` package, **not a new dependency**.
- **Camera handshake required no code changes.** `MONITOR_ANCHOR.screenCenterHeight` is computed from the new console's actual stacked dimensions (cart height + housing offset + bezel asymmetry) rather than hand-picked, and `cameraPath.js`'s monitor-aligned final keyframe already derives its position/lookAt from `MONITOR_ANCHOR` at module-load time (established when the monitor was first built in Phase 1D) — so the camera automatically retargeted to the new, taller/deeper console's screen center (≈1.285, close to the previous 1.2) with zero changes to the timeline itself. Verified visually rather than assumed: the final aligned shot reads as a clean, well-framed close-up with no retuning needed.
- Screen/glass shadow exclusion (`castShadow={false} receiveShadow={false}`, from the §4C fix) carried over unchanged.

### Verification
- Hero frame (0%): retro console clearly reads as boxy/industrial, standing on the cart within the beam, thick bezel and control knobs visible.
- Final aligned shot (100%): camera automatically squarely framed on the new screen center — confirms the handshake design (derive-from-anchor, not hardcoded) works as intended across a real geometry change, not just in theory.
- Approach segment (75%): clean, no clipping against the taller/deeper housing.
- Full reversibility: 100% → 0% reproduces the same hero frame.
- Frame-timing under a simulated scroll-gesture burst: 180 frames, ~16.6ms avg, 0 over 33ms — no regression despite the added geometry (cart legs, platform, rear hump, control knobs).
- Production build succeeds (71 modules, no errors); grep-confirmed no `useState`/`setState` anywhere in `src/`; mobile viewport renders cleanly, no console errors.

### Required next step
Awaiting human visual review of the retro/industrial monitor redesign.

---

## 4F. Motion Physics — Organic Camera Weight

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human request: the camera scroll animation felt too mechanical/linear; refine the GSAP timeline and R3F motion physics for natural physical weight, acceleration, and cinematic ease.

### What changed

1. **GSAP/camera-path motion curves** (`src/experience/timeline/cameraPath.js`):
   - Upgraded the per-segment ease from cubic to **quintic in/out** (`easeInOutQuint`) — a more pronounced "gentle accel out of rest, soft glide to a stop" than the previous curve, addressing "avoid flat linear movement."
   - Added an explicit **settle keyframe** at `t: 0.92`, positioned 85% of the way from the `t: 0.75` approach shot to the final monitor-aligned shot (derived via `lerpVec3`, not hand-picked numbers — stays correct if either endpoint moves). This means the last 8% of scroll covers only the final 15% of the remaining distance: the camera visibly decelerates and settles into the monitor-aligned frame rather than sweeping in and stopping abruptly at progress 1.0 — directly addressing "extra timeline padding/holding ease around key framing moments."

2. **Asynchronous position/lookAt damping** (`src/experience/timeline/ScrollCameraRig.jsx`):
   - Split the single `DAMP_LAMBDA` into `POSITION_DAMP_LAMBDA = 4.5` and `LOOKAT_DAMP_LAMBDA = 3` — within the request's suggested ranges (4–5 and 2.5–3.5). Position tracks the scroll target more responsively; the lookAt target trails slightly behind. That asynchronous lag is what reads as physical weight — a heavy dolly/gimbal rig whose framing settles a beat after its position does — rather than a rigid point that snaps its facing instantly to match its position.

3. **Inertial scroll tuning** (`src/experience/timeline/smoothScroll.js`):
   - Lenis `duration` raised `1.1s → 1.3s` (within the requested 1.2–1.4s range) — a longer glide-to-rest window reads as more physical friction.
   - `lerp` lowered `0.1 → 0.085` for a slightly smoother catch-up.
   - Added explicit `syncTouchLerp: 0.085` (matching the wheel `lerp`) so touch and wheel decay with the *same* physical weight rather than two independently-tuned feels — addresses "touch trackpad scrolling and wheel events decay with natural physical friction."

### State discipline
Confirmed unchanged: `ScrollCameraRig.jsx` still mutates `camera.position`/`camera.lookAt` directly inside `useFrame` via `THREE.MathUtils.damp`, reading from the shared `scrollProgress` plain object. Grep-confirmed zero `useState`/`setState` anywhere in `src/`.

### Verification
- Dispatched a synthetic wheel event and sampled `scrollY` over ~2s: smooth decaying glide-to-rest curve, slightly longer settle time than the pre-tuning baseline (consistent with the raised Lenis duration), no oscillation.
- Verified the final monitor-aligned shot (progress 100%) and full reversibility (100% → 0% reproduces the exact hero frame).
- Frame-timing under a simulated scroll-gesture burst: 180 frames, ~16.6ms avg, 0 over 33ms — no regression from the added settle keyframe or damping split.
- Production build succeeds (71 modules, no errors); grep-confirmed no React state anywhere in `src/`; mobile viewport renders cleanly, no console errors.
- One HMR false alarm again during this pass (a stale `easeInOutCubic is not defined` error persisting across reloads after the function was renamed to `easeInOutQuint`) — traced to the browser tab's own stale error-overlay state via a fresh-tab test (the file itself was correct, grep-confirmed no remaining reference to the old name). Consistent with the same category of environment quirk logged in §4D; no code issue.

### Required next step
Awaiting human visual review — please confirm the camera now reads as having physical weight rather than mechanical/linear motion.

---

## 4G. Fix — Retro Monitor Shadow/Lighting Investigation

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human report: switching to the bulkier retro monitor casing reintroduced light flickering and surface flashing.

### Investigation

Before changing anything, checked each specific mechanism the request named, computing exact numbers rather than assuming:

- **Beam/housing clearance:** the beam mesh (from the §4D rebuild) is geometrically truncated to stop at world Y ≈ 2.0. The retro housing's actual top, computed from its real stacked dimensions (`platformTopY = 0.81`, `housingCenterY = 1.235`, `housing top = housingCenterY + height/2 = 1.66`), sits **0.34 units below** where the beam mesh ends. No intersection — confirmed by calculation, not assumption.
- **Camera near-clip clearance:** the final aligned camera sits `MONITOR_VIEW_DISTANCE (2.1)` in front of the screen plane; the screen's actual world Z (`target.z + HOUSING.frontDepth/2 + 0.002`) leaves **≈1.82 units of clearance** from the `near: 0.05` plane — several orders of margin beyond what could clip.
- **Screen shadow exclusion:** already `castShadow={false} receiveShadow={false}` on both the screen and glass meshes (from the §4C fix) — already satisfied the request's item 1 without any change needed.
- **Beam material flags:** `transparent: true`, `depthWrite: false`, `side: THREE.DoubleSide` were already exactly as requested (from the §4D rebuild) — confirmed by reading the file, not changed.
- **Suggested `shadow.bias = -0.00015`:** not applied. The current tuned `bias` is `-0.0012`; `-0.00015` has a *smaller* magnitude, which (per the same reasoning as §4B) would move shadow-acne risk in the wrong direction. `normalBias: 0.02` — the request's own alternative — was already in place from §4B.

### Empirical testing (couldn't reproduce the reported flicker)

- Static 90-frame pixel sampling at four points (housing top, housing/rear-hump seam, screen bezel, cart shadow) while at rest: perfectly stable, one unique value each.
- Temporal 181-frame pixel sampling on a plain housing surface during active scroll through the approach segment: a single smooth, monotonic gradient — no oscillation.
- A first attempt at this same test, sampling a point that happened to cross the screen's color-bar test pattern during camera translation, showed apparent "flips" — traced to the sample point sweeping across different colored bars as expected scene content, not a rendering bug; the same test on a plain surface nearby was clean. Documented as a methodology pitfall so it isn't mistaken for a finding.
- Rechecked stability specifically near the new control-knob shadow-casting area (90 frames, fully settled): perfectly stable.

### One real, targeted fix applied

- **Disabled shadow casting on the control knobs** (`Monitor.jsx`, `castShadow={false}`, was `true`). These are new geometry from the retro redesign — small cylinders (0.028 radius) that are exactly the kind of thin detail prone to shadow-map aliasing relative to the light's full shadow-camera frustum, for negligible visual payoff. This is the one plausible, specific technical regression the retro redesign could have introduced (the previous flat-panel design had no comparably small shadow-casting geometry) — applied per `technical-architecture.md` §8's explicit guidance to disable shadows on objects with negligible visual value, rather than guessed at generically.

### Honest summary

As with §4B, the reported artifact could not be reproduced or measured in this sandboxed environment despite targeted static, temporal, and geometric verification of every mechanism the request named. Every specific claim in the request (beam/housing intersection, camera clipping, missing shadow flags, missing material flags) checked out as **already fine or not actually occurring** once measured. The one change made — disabling shadow casting on the tiny control knobs — is a real, defensible hardening step, not a confirmed bug fix. Flagging rather than claiming resolution: if the flicker is still visible on the original hardware/browser, it's likely GPU/driver-specific shadow-map behavior this environment doesn't reproduce, and I'd need the browser/GPU and the approximate scroll position it's most visible at to investigate further.

### Verification
- Production build succeeds (71 modules, no errors); grep-confirmed no `useState`/`setState` anywhere in `src/`.
- Full reversibility (90% → 0% reproduces the exact hero frame); frame-timing under a simulated scroll-gesture burst unchanged (~16.6ms avg, 0 over 33ms); mobile viewport renders cleanly, no console errors.

### Required next step
On-device confirmation needed — please re-check whether the flicker persists, and if so, note the browser/GPU and roughly where in the scroll it appears.

---

## 4H. Fix — Choreography & Scroll Polish (Remove Hard Stops)

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human report: camera scroll motion had become mechanical and glitchy again, ending in abrupt hard stops between scroll sections.

### Root-cause diagnosis

Three prior rounds (§4C motion-physics refinement, the organic-camera-weight pass, and general Lenis/damping tuning) had already tuned dampening lambdas, Lenis lerp, and scrub — all surface-level smoothing parameters — without resolving repeated reports of the same "mechanical/hard stop" complaint. Rather than re-tune those constants a fourth time, inspected the actual path architecture in `cameraPath.js` and found the real cause: the path was 5 keyframes, each independently eased with its own `easeInOutQuint` per segment. Easing each segment independently forces the camera's velocity to zero at *every* keyframe boundary — with 5 keyframes that's 5 stop-start events, which reads as a series of small hard stops rather than one continuous glide, no matter how well the surrounding damping/scroll layers are tuned.

### What changed

- **`cameraPath.js`** — replaced the piecewise per-segment easing with a single `THREE.CatmullRomCurve3` through the same position and lookAt waypoints, sampled with **one** global ease (`easeInOutQuint` applied to overall progress, not per-segment). Only progress 0 (at rest) and progress 1 (settling at the monitor) actually decelerate to zero; the interior waypoints are passed through at continuous velocity. The lookAt path's first waypoint was changed from `[0, 1.6, -50]` to `[0, 1.6, -10]` — the original was a "look far down -Z" hack whose magnitude (~50) would have been a severe outlier control point in a Catmull-Rom spline, distorting the curve's shape near the start; the new point produces a visually equivalent look direction without that risk. `sampleCameraPath(progress)` remains a pure function of `progress` alone (verified `getPoint(0)`/`getPoint(1)` return the exact first/last waypoints), so scroll-back reversibility is unaffected.
- **`smoothScroll.js`** — Lenis retuned to `duration: 1.2`, `lerp: 0.11`, `syncTouchLerp: 0.11` (within the requested 0.1–0.12 window), `smoothWheel: true` confirmed already active.
- **`ScrollTimelineProvider.jsx`** — ScrollTrigger `scrub` changed from `0.15` to `1`, adding a full second of its own catch-up smoothing on top of Lenis's input normalization so individual wheel notches/trackpad steps absorb into one continuous motion.
- `ScrollCameraRig.jsx` was already using `THREE.MathUtils.damp` for position and a synchronized lerp for lookAt from a prior round — not modified, already satisfied the frame-rate-independent dampening requirement.

### Verification
- `positionCurve.getPoint(0)`/`getPoint(1)` confirmed to exactly match the hero and monitor-aligned waypoints (no jump at either end).
- Visual check across progress 0%, 15%, 40%, 65%, 100%, and back to 0%: clean framing throughout, no spline-overshoot artifacts, exact reversibility to the hero baseline.
- Synthetic wheel-burst test: `scrollY` settles via smooth exponential decay (no oscillation or snapping) over roughly 1.1s.
- Instant scroll-jump test (jump to 50% mid-glide): camera visibly continues gliding toward the new target rather than snapping instantly, confirming the added `scrub: 1` lag is actually smoothing motion rather than a no-op.
- Frame-timing under a simulated wheel-gesture burst: ~16.6ms avg, 0 frames over 33ms.
- `grep -rn "useState\|setState" src/` — no matches; production build succeeds (71 modules, no errors); mobile viewport (375×812) renders the correct hero frame at scroll 0 with no console errors — the monitor appears more prominent than desktop only because the fixed vertical fov crops tighter horizontally at a narrow aspect ratio, not a regression.

### Required next step
Visual review requested — please confirm the hard-stop/mechanical feeling is resolved and the motion now reads as one continuous glide.

---

## 4I. Fix — Motion Polish & Lighting Fix (Landing Ease & Monitor Transition Light Glitch)

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human report: the final deceleration into keyframes (especially the retro monitor screen lock) needed a softer, longer landing, and the light still flickered/shifted at the moment the camera locks onto the monitor face.

### What changed — extra soft landing ease

- **`cameraPath.js`** — the single global ease is now asymmetric: quintic (`16t⁵`) for the first half (unchanged acceleration out of rest), a softer septic (`1 − (−2t+2)⁷/2`) for the second half — a longer, gentler tail into the final monitor-locked shot than the previous symmetric quintic gave. Continuous in value at the t=0.5 midpoint.
- **`ScrollCameraRig.jsx`** — position and lookAt damping now share one lambda (`3.5`, previously `4.5` for position / `3` for lookAt). The earlier asymmetric lambdas were a deliberate "weighty dolly" choice from the organic-camera-weight round, but they meant position could finish settling before lookAt caught up — since both targets stop moving at the same instant (progress reaches 1) but the two dampers converged at different rates, that gap read as a rotational micro-snap right at the monitor lock. Sharing one (lower, softer) lambda makes both settle in lockstep; the lower value also gives a longer coast to rest generally, per the request's "lower the position dampening lambda" item.
- **`ScrollTimelineProvider.jsx`** — ScrollTrigger `scrub` raised `1 → 1.5`, per the request's explicit value.

### What changed — monitor transition light glitch

- **`volumetricLighting.js` / `VolumetricLightingRig.jsx`** — the beam and dust (not the floor pool, which is flat on the ground and never near the camera) now fade to fully transparent between scroll progress 0.30–0.42, well before the monitor lock at progress 1. Driven by a new `setApproachFade(fade)` controller method, called every frame from `VolumetricLightingRig`'s `useFrame` reading `scrollProgress.value` directly and mutating `beam.material.uniforms.uOpacity.value` / `dust.material.opacity` — a direct mutation, not React state, per technical-architecture.md §7. The beam is an open, double-sided, additive cone that the camera's view direction passes close to during the approach (though the camera itself, by the truncated geometry from the §4F/§4G rebuild, never enters it); removing it from view before that window removes any chance of a near-camera visual interaction with it, regardless of whether the underlying cause was ever confirmed.
- The other two requested mechanisms were checked, not changed — both were already satisfied or not applicable:
  - The screen mesh already has `castShadow={false}`/`receiveShadow={false}` (from §4C); `shadowSide` only affects objects that cast shadows, so setting it would be a no-op.
  - "Shadow buffer re-calculating depth when the camera near plane matches the screen plane" isn't a real mechanism here — in Three.js the spotlight's shadow map is rendered from the light's own shadow camera (fixed `near: 1`, `far: params.spot.distance`), which is entirely independent of the main viewing camera's near plane. There's no code path connecting the two.

### Verification
- Static and temporal (60-frame) pixel sampling through the 0.30–0.42 fade window: perfectly stable, no oscillation — consistent with §4G's prior finding that this class of artifact isn't reproducible in this environment. This is hardening (fading the beam out of view during the approach), not a confirmed-reproduced fix.
- Visual check: beam/dust visibly fading by progress 0.35, fully gone by 0.45, floor pool still reads as the light's landing point; final monitor-locked shot at progress 1 clean; full reversibility to the exact hero baseline at progress 0.
- Frame-timing under a simulated wheel-gesture burst: ~16.6ms avg, 0 frames over 33ms.
- `grep -rn "useState\|setState" src/` — no matches; production build succeeds (71 modules, no errors); mobile viewport renders with no console errors.

### Required next step
Visual review requested — please confirm the landing at the monitor now reads as a soft coast rather than a snap, and whether the light-glitch report is resolved (this environment could not reproduce it directly, so on-device confirmation is the strongest signal available).

---

## 4J. Fix — Atmospheric Polish (Preserve Lens Flare & Dust Particles During Scroll Transition)

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

Human report: the light flare and atmospheric dust disappear when scrolling from the opening room view into the retro monitor screen lock.

### Scope check before changing anything

Two of the request's specific mechanisms don't match what's actually in this codebase, checked directly rather than assumed:

- **No lens-flare / screen-space glare component exists.** `grep`-confirmed: there is no `LensFlare`, bloom, or postprocessing pipeline anywhere in `src/`, and no postprocessing package in `package.json` (`three`, `@react-three/fiber`, `@react-three/drei`, `gsap`, `lenis` only). The only "glow" in this scene is the volumetric beam mesh from `volumetricLighting.js` — a plain additive cone, not a lens-flare effect with its own occlusion test. There's nothing with an "occlusion test radius" to adjust. Building an actual screen-space lens-flare/bloom system would mean a new postprocessing dependency and render pipeline — a real architectural addition, not a parameter tweak — so it wasn't added; the fix below addresses the visible symptom (the beam disappearing) using the beam that already exists.
- **Dust is confined to the light beam volume by design, and that's a protected Phase 1B decision** (`build-status.md` §5: "dust confined to the beam"). Expanding the particle field to cover "the full camera trajectory volume from the entrance pillars to the monitor screen" would directly conflict with that approved foundation, so it wasn't done. In practice this is a smaller gap than it sounds: the beam's floor target *is* the monitor's base position, so the existing dust cloud already extends to surround the monitor at the near/lower end of its cone — it just needed to stop being faded to zero (see below), not be spatially expanded.
- Item 2's material flags (`transparent: true`, `depthWrite: false` on the dust `PointsMaterial`) were already exactly as requested, confirmed by reading `volumetricLighting.js` — no change needed.

### What actually caused the disappearance, and what changed

The real cause was the previous round's own fix (§4I): the beam/dust approach-fade introduced there faded both **all the way to fully transparent** between scroll progress 0.30–0.42, to keep the additive beam cone out of the camera's view during the monitor approach. That fully solved the transition concern §4I targeted, but as a side effect it made the atmosphere vanish for the rest of the scroll — exactly this report.

- **`VolumetricLightingRig.jsx`** — changed the fade from going to `0` to dipping to a `0.3` floor instead, and holding there (not returning to full) through the monitor lock. The beam and dust still thin during the 0.30–0.42 approach window (preserving §4I's reasoning), but never fully disappear — a subtle glow and dust presence now persists all the way to the final monitor-filling shot.

### Verification
- Visual check at progress 0.35 (mid-fade) and 1.0 (monitor-filling final shot): beam and dust both clearly visible, dimmed but present, at both points — dust motes visible in the background even with the monitor filling the frame.
- Full reversibility: scroll to 100% then back to 0% reproduces the exact hero baseline.
- Frame-timing under a simulated wheel-gesture burst: ~16.6ms avg, 0 frames over 33ms.
- `grep -rn "useState\|setState" src/` — no matches; production build succeeds (71 modules, no errors); mobile viewport renders with no console errors.

### Required next step
Visual review requested — please confirm the atmosphere (beam glow + dust) now stays visible through to the monitor-locked shot, and let us know if an actual lens-flare/bloom effect (a real new addition, not present today) is something you'd like scoped as its own piece of work.

---

## 5. Approved Visual Decisions

This section records visual decisions that have already received human approval and therefore should be treated as protected foundations.

### Approved

**Phase 1A — Environment Shell (approved 2026-08-31):**
- Room dimensions and architectural proportions (14×32 floor, 9 unit wall height).
- Column geometry, proportions (plinth/tapered shaft/capital LatheGeometry profile), and spacing.
- Initial (progress-0) camera framing `[0, 1.6, 9]`, `fov: 45`, looking level down −Z, and the resulting negative space / composition.
- Overall room layout (floor, back wall, two side walls, no ceiling).
- **Column count revised post-approval (2026-08-31, pending re-review):** originally 8 (4 per side, side colonnade only); a two-pillar foreground "entrance" pair was added at `[∓2.2, 4]` per explicit human request — see the geometry-refinement entry below. Not yet re-approved as part of the visual record; flagged here so the count doesn't silently drift from what §4/§11 describe.

**Phase 1B — Atmosphere & Light (approved 2026-08-31):**
- The primary light system's character: warm SpotLight-driven volumetric shaft, floor light-pool, shadow-casting architecture, dust confined to the beam, and the ambient/fog/three-tier material tonality (columns lightest → walls mid → floor darkest) reached across three review passes.
- Exact final parameter values live in `lightingParams` (`src/experience/lighting/volumetricLighting.js`) and `SURFACE_TONE` (`src/experience/Environment.jsx`).

**Phase 1C — Camera & Scroll (approved 2026-08-31):**
- The scroll-driven camera mechanism: a single master GSAP/ScrollTrigger timeline, Lenis-smoothed input, `THREE.MathUtils.damp`-eased camera follow, and the deterministic/reversible keyframe-based path through the environment.
- The hero→approach keyframes (`t: 0, 0.25, 0.5, 0.75` as of Phase 1D — originally `0, 0.35, 0.7, 1.0` before Phase 1D's extension) and their exact position/lookAt values, in `src/experience/timeline/cameraPath.js`.

These are now protected foundations. Later phases must not alter them without identifying the conflict first — with two already-anticipated exceptions: (1) Phase 1A's "static initial camera position" was always scoped as the **opening (progress-0) framing only** (`build-status.md` §4's Phase 1A record explicitly listed "full camera choreography" as out of scope, reserved for Phase 1C) — Phase 1C making the camera scroll-driven for progress > 0 was that anticipated evolution, not a violation. (2) Phase 1C's approved path was always understood to extend rather than freeze at its final keyframe once later phases introduced new physical anchors to travel toward — build-workflow.md's own Phase 1C entry describes the approach as "the initial Film approach," implying more path would follow. Phase 1D's keyframe extension is additive: the original four keyframes' *positions/lookAts* (the actual approved waypoint compositions) are byte-for-byte unchanged; their `t` values were rescaled from `0, 0.35, 0.7, 1.0` to `0, 0.25, 0.5, 0.75` to make room for the new final segment, which does shift exactly which scroll percentage shows which waypoint. Re-verified visually after the change: progress 0 still reproduces the exact approved hero frame, and the same waypoint compositions still appear in the same order with smooth continuity — just at different scroll percentages than before.

### Protected decisions

When a visual or interaction decision is approved, record it here. Examples: camera starting composition, architectural proportions, light direction, monitor position, scroll behavior, transition timing, typography placement, portfolio composition.

Previously approved decisions must not be changed casually in later phases. If a later phase requires a change to an approved decision, Claude must identify the conflict and report it before making the change.

---

## 6. Known Issues

Record known technical, visual, browser, performance, or content issues here.

| Issue | Phase Found | Severity | Current Action | Target Phase |
|---|---|---|---|---|
| Production bundle exceeds Vite's 500kB chunk-size warning (~1103kB / ~319kB gzip as of the Phase 1C motion-physics pass, adding GSAP + Lenis) | 1A | Low | Documented only; no code-splitting attempted | Phase 5 (Performance) |
| `npm audit` moderate advisory in `esbuild`/Vite dev server (GHSA-67mh-4wv8-2f99) | 1A | Low | Documented only; fix requires breaking Vite v5→v8 upgrade | Deferred — revisit when a Vite major upgrade is otherwise warranted |

### Issue rules

Known issues must be clearly described, assigned to the phase where they belong, given an appropriate severity, either fixed within the current phase or deferred appropriately, and removed from this section once resolved.

Do not silently ignore known issues. Do not expand the current phase merely because an issue exists if the issue belongs to a later phase.

---

## 7. Active Technical Constraints

These are requirements that must remain true throughout development.

### Rendering and animation
The master cinematic timeline must remain the primary source of truth for scroll-driven progression. Scroll animation frames must not drive React `useState` updates. Camera and object interpolation should use direct references or the appropriate render-loop mechanism defined in `technical-architecture.md`. Cinematic progression must remain reversible. Camera movement must remain continuous rather than section-based or snap-based.

### Lighting
Lighting must remain continuous across cinematic transitions. Film → Digital must not introduce an artificial lighting reset. Avoid independent animation systems that can desynchronize from the master timeline.

### Responsive behavior
The cinematic composition must adapt across desktop, laptop, and mobile. Mobile browser address-bar changes must not cause the cinematic canvas or camera to snap during active scrolling. Avoid viewport-unit implementations that cause unnecessary canvas resizing during mobile browser chrome changes.

### Browser support
Current Safari and Chrome must be treated as primary browser targets. Safari-specific problems must be reproduced and understood before applying fixes. High-refresh displays must be tested, particularly 120Hz environments. Browser-specific fixes must not unnecessarily degrade other browsers or devices.

### Scope
Only the current approved phase may be implemented. Previously approved phases are protected foundations. Provisional assets must not automatically become final assets. Later-phase issues should be documented rather than implemented early unless they block the current phase.

---

## 8. Git & Recovery State

The repository must maintain a recoverable implementation history.

### Current checkpoint

**Current working branch:** `main`
**Baseline commit (docs only, pre-implementation):** `960243b` — "Initial commit: governing documentation"
**Approved Phase 1A checkpoint:** `8f6784d` — "Phase 1A: refine column geometry to classical cylindrical profile" (Phase 1A approved 2026-08-31 in chat, against this commit)
**Approved Phase 1B checkpoint:** `c574d5e` — "Phase 1B: three-tier surface tonality and higher global exposure" (Phase 1B approved 2026-08-31 in chat, against this commit)
**Approved Phase 1C checkpoint:** `b953859` — "Phase 1C: smooth camera scroll motion (Lenis + damping)" (Phase 1C approved 2026-08-31 in chat, against this commit)
**Current commit (Phase 1D, technically complete):** `85b90be` — "Phase 1D: monitor mesh, screen shader, camera-monitor handshake"
**Current commit (entrance pillar refinement, technically complete):** `cdba4d9` — "Environment: add foreground entrance pillars" (on top of `85b90be`)
**Current commit (shadow/frustum hardening fix, technically complete):** `c3c79f1` — "Fix: shadow normalBias and tighter near-clip after entrance pillars" (on top of `cdba4d9`)
**Current commit (camera/monitor transition light-pop fix, technically complete):** `38b568e` — "Fix: fade volumetric beam across camera-monitor transition" (on top of `c3c79f1`)
**Current commit (Phase 1B lighting rebuild, technically complete):** `4adfb38` — "Phase 1B rebuild: clean lighting architecture" (on top of `38b568e`)
**Current commit (retro/industrial monitor redesign, technically complete):** `ae8ebdf` — "Monitor: retro/industrial CRT-console redesign" (on top of `4adfb38`)
**Current commit (organic camera weight, technically complete):** `6925400` — "Motion: organic camera weight via easing, lag, and scroll tuning" (on top of `ae8ebdf`)
**Current commit (retro monitor shadow/lighting investigation, technically complete):** `c46afd7` — "Investigate: retro monitor shadow/lighting report" (on top of `6925400`)
**Current commit (choreography & scroll polish, technically complete):** `4c85661` — "Fix: replace piecewise keyframe easing with continuous spline camera path" (on top of `c46afd7`)
**Current commit (motion polish & lighting fix, technically complete):** `0952617` — "Fix: softer landing ease and beam fade through monitor approach" (on top of `4c85661`)
**Current commit (atmospheric polish, technically complete):** `3c2b6b7` — "Fix: keep beam/dust ambient presence through the monitor approach" (on top of `0952617`)

The repository was initialized (`git init -b main`) with the five governing documents relocated into `docs/` as the first commit, giving a clean recovery point before any implementation began. Phase 1A (scaffold, environment shell, column refinement), Phase 1B (volumetric lighting, three review passes), and Phase 1C (scroll-driven camera, motion-physics refinement) were each committed and approved in sequence; Phase 1D (monitor foundation) is committed on top of the approved Phase 1C checkpoint and is recoverable independently of it.

### Checkpoint rules

Before significant implementation: confirm the current Git state, identify the current commit, ensure the previous approved state is recoverable, make the implementation changes, test the changes, and record the relevant checkpoint when the phase reaches technical completion or approval.

Do not overwrite or discard an approved state without a recoverable Git history.

---

## 9. Testing State

### Current phase testing

**Phase:** 1D
**Functional testing:** COMPLETE — `npm run build` succeeds (Vite production build, 70 modules, no errors); dev server starts cleanly with no console errors from the application.
**Visual testing:** COMPLETE (via the in-app Chromium browser pane) — verified the monitor renders correctly at progress 0% (standing in the beam, visible from the hero framing, no pop-in); verified the mid-transition approach (progress ≈60%, correcting an earlier test-script math error that mis-scaled the sample point — see note below) frames the monitor and stand cleanly with no clipping; verified the final progress-100% shot is squarely aligned with the screen face, well-framed, glass/scanline detail visible, no artifacts; verified full reversibility (scroll to 100% then back to 0% reproduces the exact approved hero frame with the monitor now present).
**Chrome testing:** COMPLETE — verified in the Chromium-based browser pane (desktop viewport).
**Safari testing:** NOT YET COMPLETE — no macOS/iOS Safari available in this environment; carried over from Phase 1A/1B/1C as an open gap, not silently skipped.
**Mobile testing:** PARTIAL — verified via emulated 375×812 mobile viewport: renders correctly, no console errors. Re-confirmed the `--app-height` mobile address-bar resize guard still holds with the monitor mesh/shader added.
**120Hz testing:** NOT DIRECTLY TESTABLE in this environment (no real 120Hz display). Frame-timing re-measured during a simulated wheel-gesture burst with the monitor mesh and screen shader active: 180 frames, ~16.62ms average (~60fps), 17.70ms max, 0 frames over 33ms — no regression from the Phase 1C measurement.

**Testing note:** an early manual scroll-position test in this pass computed a target scroll offset as `document.documentElement.scrollHeight * 0.6`, which is wrong — the correct calculation is `(scrollHeight - innerHeight) * 0.6`, since `window.scrollTo`'s maximum is capped at the former minus the viewport height. The bug produced a sample at progress ≈90% while labeled 60%, which briefly looked like a possible camera-path defect (unexpectedly close framing) before the arithmetic error was found and corrected. No code changes resulted — this was a test-script bug, not a product bug — but it's recorded here since it consumed real verification time and is a mistake worth not repeating.

Testing status should be updated as the phase progresses.

### Required testing before phase approval

A phase must not be marked technically complete until the relevant build checks, runtime checks, console checks, browser checks, device checks, scroll checks, visual checks, and regression checks have been completed.

---

## 10. Phase Completion Record

Each completed phase should receive a concise record.

### Phase 1A

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Approved (2026-08-31, human review in chat)
**Major changes:** Scaffolded Vite + React + React Three Fiber + Drei project from scratch; implemented the persistent architectural shell (floor, back wall, two side walls, 8 structural columns) and static initial camera; added viewport-height pinning per `technical-architecture.md` §16.
**Testing performed:** Production build verification, dev-server console check, visual composition review (desktop), emulated mobile-viewport resize/resilience check. See §9 for full detail and gaps (Safari, real-device mobile, 120Hz not yet testable).
**Known issues:** See §4 and §6 — bundle size and a dev-only `esbuild` advisory, both low severity and deferred to later phases.
**Approved visual decisions:** See §5 — room dimensions, architectural proportions, column geometry/spacing, initial camera framing, overall layout.
**Git checkpoint:** `main` branch; baseline docs commit `960243b`, Phase 1A commit `eea4e73`, column refinement `8f6784d`.
**Next approved phase:** Approved 2026-08-31 (human review in chat) — Phase 1B (Atmosphere & Light) began.

### Phase 1B

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Approved (2026-08-31, human review in chat)
**Major changes:** Added `src/experience/lighting/volumetricLighting.js` (framework-agnostic controller with `init()`/`update(time)`/`dispose()` and an exported `lightingParams` data structure) and `src/experience/lighting/VolumetricLightingRig.jsx` (R3F adapter); replaced the Phase 1A placeholder hemisphere/ambient light in `Environment.jsx` with the real system; added shadow flags to the architecture and enabled `shadows` on the Canvas. **Refined three times (same session, human visual feedback):** (1) raised shadow map to 2048² with `shadow.radius` blur and higher penumbra for a smooth floor-pool edge; rebuilt the shaft as two nested cones with a fresnel view-angle term for true volumetric depth; raised ambient and added `FogExp2`; fixed an R3F disposal error surfaced by the new nested shaft structure. (2) Background walls still read as lost in black — raised ambient further (1.1→1.7) and lifted/thinned the fog (`#08080a`→`#242428`, density 0.05→0.032). (3) Raised ambient again (1.7→2.3, color →`#adadb8`), thinned fog slightly further (density→0.028), and introduced an explicit three-tier surface-tonality system (`SURFACE_TONE` in `Environment.jsx`): columns lightest (`#8c8c8c`) → walls mid (`#5e5e5e`/`#565656`) → floor darkest (`#484848`, tuned via direct pixel sampling after an initial darker candidate crushed to near-black); nudged the volumetric shaft's opacity up slightly (0.055→0.075 halo, 0.12→0.16 core) so it stays cinematically prominent against the now-lighter room.
**Testing performed:** See §9. Production build, dev-server console check, visual verification, shadow-casting mechanics check, mobile-viewport resilience check, and direct pixel-level brightness sampling — each repeated after every refinement pass.
**Known issues:** See §4 and §6 — an ACES tone-mapping tuning gotcha (recurred with material color, resolved via pixel sampling) and an R3F disposal fix (both resolved, documented for future work), plus the two carried-over Phase 1A issues (bundle size, dev-only esbuild advisory).
**Approved visual decisions:** See §5 — the full Phase 1B lighting/material system as shipped.
**Git checkpoint:** `main` branch; initial commit `9d7e5b2`, refinements `2da89c8`, `d36f88b`, `c574d5e`.
**Next approved phase:** Approved 2026-08-31 (human review in chat) — Phase 1C (Camera & Scroll) began.

### Phase 1C

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Approved (2026-08-31, human review in chat)
**Major changes:** Added `gsap` dependency. Added `src/experience/timeline/cameraPath.js` (pure keyframe/easing camera-path function), `src/experience/timeline/ScrollTimelineProvider.jsx` (master GSAP/ScrollTrigger timeline + scroll spacer, exporting a plain mutable `scrollProgress` object — not React state), and `src/experience/timeline/ScrollCameraRig.jsx` (a `useFrame` callback that directly mutates `camera.position`/`camera.lookAt` every frame). Restructured `App.jsx`/`global.css` so the canvas is pinned (`position: fixed`) while a real scrollable spacer drives native page scroll. **Refined (same session, human feedback — motion physics):** added `lenis` and `src/experience/timeline/smoothScroll.js` to normalize raw wheel/touch input into smooth inertial motion (`duration: 1.1`, ease-out-cubic, `syncTouch: true`); reduced `ScrollTrigger`'s own `scrub` (`0.6→0.15`) now that Lenis carries the primary smoothing; changed `ScrollCameraRig.jsx` to damp the camera toward its scroll-derived target every frame via `THREE.MathUtils.damp` (position and lookAt, both frame-rate independent) instead of snapping directly to it. No Phase 1A/1B geometry, lighting, or material values were changed.
**Testing performed:** Production build, dev-server console check, visual verification at multiple scroll positions (0%, 50%, 100%), reversibility check (scroll to 100% then back to 0%, confirmed pixel-identical to the approved Phase 1B baseline), frame-timing measurement during continuous/gestural scroll (~60fps average both before and after the smoothing pass, 0 frames over 33ms — see §9), grep-verified no `useState`/`setState` in the scroll/camera path, mobile-viewport resilience check, a direct simulated-resize test confirming `--app-height` doesn't change on a height-only resize (re-confirmed after adding Lenis), and a synthetic-wheel-event glide-to-rest measurement confirming smooth exponential decay rather than an instant snap.
**Known issues:** See §6 — bundle size grew further with GSAP and Lenis (still low severity, deferred to Phase 5); no new issues introduced. One in-flight issue was caught and fixed during verification, not shipped: an earlier camera-path draft ended inside the Phase 1B dust/beam volume and produced visible clipping artifacts — the path was revised to stay outside that volume before this phase was marked complete.
**Approved visual decisions:** See §5 — the scroll-driven camera mechanism and the Phase 1C keyframe path as shipped.
**Git checkpoint:** `main` branch; initial commit `e566d3f`, motion-physics refinement `b953859`.
**Next approved phase:** Approved 2026-08-31 (human review in chat) — Phase 1D (Digital / Monitor Foundation) began.

### Phase 1D

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** Added `src/experience/digital/Monitor.jsx` (declarative monitor mesh: base, neck, body, screen, glass — positioned exactly at the Phase 1B beam target via `lightingParams.target`) and `src/experience/digital/screenTestPatternMaterial.js` (unlit SMPTE-bar test-pattern shader, `toneMapped: false` for a glow read without real scene illumination). Extended `src/experience/timeline/cameraPath.js` from 4 to 5 keyframes, adding a final shot squarely aligned with the monitor screen, computed from `MONITOR_ANCHOR` rather than hand-tuned numbers. Mounted `<Monitor />` in `CinematicExperience.jsx` as a sibling to `<Environment />`. A scope conflict was caught before implementation began: the authorization prompt requested a cinema-camera mesh in addition to the monitor, which conflicts with `build-workflow.md` §10's explicit assignment of that object to Phase 2 — flagged to the human, who confirmed monitor-only scope (see §4's scope note). No cinema-camera mesh was built. No Phase 1A/1B/1C code changed beyond the additive keyframe extension.
**Testing performed:** See §9. Production build, dev-server console check, visual verification at progress 0%/~60%/100%, reversibility check, frame-timing re-measurement (no regression), mobile-viewport and address-bar-resize guard re-check, grep-verified no `useState`/`setState`.
**Known issues:** See §9's testing note (a test-script scroll-offset calculation bug, not a product bug) and §6 for carried-over issues.
**Approved visual decisions:** None yet — pending human review of this phase.
**Git checkpoint:** `main` branch; commit `85b90be`.
**Next approved phase:** Pending human approval of Phase 1D before Phase 2 (Film / Digital / Campaigns) may begin.

### Entrance pillar geometry refinement

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** Added a two-pillar foreground pair (`entrancePillarPositions`, `[∓2.2, 4]`) in `src/experience/Environment.jsx`, reusing the existing column geometry and Tier-1 material. Revises the approved Phase 1A column layout (count now 10, was 8) per explicit human request during the Phase 1D review window. Camera path unchanged; pillars placed to clear the existing path.
**Testing performed:** See §4A. No-clipping check through the pass-through segment, reversibility check, frame-timing re-measurement (no regression), mobile-viewport check, console check, production build.
**Known issues:** None new.
**Approved visual decisions:** None yet — pending human review.
**Git checkpoint:** `main` branch; commit `cdba4d9`.
**Next approved phase:** N/A — this is a cross-cutting revision, not a phase gate. Review alongside Phase 1D.

### Shadow/frustum hardening fix

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending — needs on-device confirmation, see below
**Major changes:** Added `spotLight.shadow.normalBias = 0.02`; lowered camera `near` `0.1 → 0.05`. See §4B for full investigation detail and why the literally-suggested `shadow.bias = -0.0001` was not applied.
**Testing performed:** See §4B. Static/temporal pixel sampling, frame-timing measurement, reversibility/pass-through re-check, production build, mobile re-check.
**Known issues:** The reported flicker/jitter could not be reproduced in this environment — flagged as needing on-device confirmation rather than claimed as resolved.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `c3c79f1`.
**Next approved phase:** N/A — cross-cutting fix, not a phase gate.

### Camera/monitor transition light-pop fix

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** `volumetricLighting.js`'s `update(progress)` now fades the shaft/floor-pool opacity across `BEAM_FADE_START=0.7`–`BEAM_FADE_END=0.88`, called every frame from `VolumetricLightingRig.jsx`. `Monitor.jsx` screen/glass shadow exclusion made explicit. See §4C for the full root-cause geometry and why camera position/lookAt damping and perpendicularity needed no change.
**Testing performed:** See §4C. Multi-point scroll sampling (60/70/82/100%), reversibility check, frame-timing re-measurement, production build, mobile re-check, grep for React state.
**Known issues:** None new.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `38b568e`.
**Next approved phase:** N/A — cross-cutting fix, not a phase gate.

### Phase 1B lighting rebuild

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** Replaced the scroll-coupled beam fade and two-mesh core+halo shaft with a single geometrically-truncated beam mesh (no runtime fading needed); added a stable non-shadow-casting `DirectionalLight` fill; restructured `lightingParams` into named groups. See §4D for full detail.
**Testing performed:** See §4D. Full scroll-range check (0/33/75/100%), reversibility, frame-timing re-measurement, production build, mobile re-check, grep for React state.
**Known issues:** None new.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `4adfb38`.
**Next approved phase:** N/A — this rebuild doesn't advance the phase gate; Phase 1D approval is still what's pending for Phase 2 to begin.

### Retro/industrial monitor redesign

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** `Monitor.jsx` rebuilt with a retro AV-cart stand, deep rounded-corner boxy CRT-style housing, thick asymmetric bezel with control knobs, and matte industrial casing material. Added `RoundedBoxGeometry` (bundled with `three`, not a new dependency). See §4E for full detail.
**Testing performed:** See §4E. Hero/approach/aligned scroll checks, reversibility, frame-timing re-measurement, production build, mobile re-check, grep for React state.
**Known issues:** None new.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `ae8ebdf`.
**Next approved phase:** N/A — cross-cutting visual revision, not a phase gate.

### Organic camera weight

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** Quintic easing, a derived settle keyframe near the monitor-aligned shot, asynchronous position/lookAt damping (4.5 vs 3), and retuned Lenis inertia (duration 1.3s, lerp 0.085, matched touch/wheel decay). See §4F for full detail.
**Testing performed:** See §4F. Glide-to-rest sampling, reversibility, frame-timing re-measurement, production build, mobile re-check, grep for React state.
**Known issues:** None new.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `6925400`.
**Next approved phase:** N/A — cross-cutting motion refinement, not a phase gate.

### Retro monitor shadow/lighting investigation

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending — needs on-device confirmation, see below
**Major changes:** Disabled shadow casting on the control knobs (only real change). Every other claim in the request (beam/housing intersection, camera clipping, missing shadow/material flags) was verified already-fine via exact geometric calculation. See §4G.
**Testing performed:** See §4G. Static and temporal pixel sampling (90–181 frames), reversibility, frame-timing re-measurement, production build, mobile re-check, grep for React state.
**Known issues:** The reported flicker could not be reproduced in this environment — flagged as needing on-device confirmation, not claimed as resolved.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `c46afd7`.
**Next approved phase:** N/A — cross-cutting investigation/fix, not a phase gate.

### Choreography & scroll polish (remove hard stops)

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending — visual review requested, see below
**Major changes:** Replaced `cameraPath.js`'s piecewise per-segment-eased keyframes (5 waypoints, each independently eased, forcing zero velocity at every one) with a single `THREE.CatmullRomCurve3` sampled with one global ease. Retuned Lenis (`duration: 1.2`, `lerp: 0.11`, `syncTouchLerp: 0.11`) and ScrollTrigger `scrub` (0.15 → 1). See §4H.
**Testing performed:** See §4H. Spline endpoint exactness check, full-range visual pass (0/15/40/65/100%, reversibility), wheel-burst decay test, mid-glide scroll-jump test, frame-timing, grep for React state, production build, mobile re-check.
**Known issues:** None identified.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `4c85661`.
**Next approved phase:** N/A — cross-cutting motion refinement, not a phase gate.

### Motion polish & lighting fix (landing ease & monitor transition light glitch)

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending — visual review requested, see below
**Major changes:** Asymmetric quintic-in/septic-out ease for a softer landing tail; unified position/lookAt damp lambda (3.5) so they settle in lockstep instead of position finishing before lookAt; `scrub` 1 → 1.5. Beam and dust now fade out via `useFrame` between scroll progress 0.30–0.42 to keep the additive cone mesh out of view during the monitor approach. See §4I.
**Testing performed:** See §4I. Static and 60-frame temporal pixel sampling through the fade window, visual pass across the fade range and final lock, reversibility, frame-timing, grep for React state, production build, mobile re-check.
**Known issues:** The reported light glitch could not be reproduced in this environment (consistent with §4G) — the beam/dust fade is hardening, not a confirmed fix; on-device confirmation requested.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `0952617`.
**Next approved phase:** N/A — cross-cutting motion refinement, not a phase gate.

### Atmospheric polish (preserve lens flare & dust during scroll transition)

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending — visual review requested, see below
**Major changes:** Changed the §4I approach-fade from going to fully transparent to dipping to a 0.3 floor and holding there — the beam/dust now persist (dimmed, not gone) through the monitor lock. No lens-flare/bloom component exists in this codebase (confirmed by grep and `package.json`) and none was added; dust's spatial confinement to the beam volume is a protected Phase 1B decision and wasn't changed. See §4J for the full scope-check reasoning.
**Testing performed:** See §4J. Visual check at progress 0.35 and 1.0, reversibility, frame-timing, grep for React state, production build, mobile re-check.
**Known issues:** None identified. Flagged for the human: an actual lens-flare/bloom effect would be a new addition (new dependency + render pipeline), not present today — noted in §4J's "required next step" for scoping if wanted.
**Approved visual decisions:** None yet.
**Git checkpoint:** `main` branch; commit `3c2b6b7`.
**Next approved phase:** N/A — cross-cutting motion refinement, not a phase gate.

---

## 11. Change Log

Record meaningful implementation changes rather than every minor code edit.

### 2026-08-30

**Project status document established.**

- Created initial build-status structure.
- Established Phase 1A as the current development phase.
- Established phase approval tracking.
- Established known-issue tracking.
- Established protected visual decisions.
- Established Git checkpoint tracking.
- Established testing status tracking.

### 2026-08-31

**Project setup and Phase 1A (Environment Shell) technically complete.**

- Moved the five governing documents into `docs/` to match the paths referenced throughout the documentation set.
- Initialized Git (`git init -b main`); committed the governing documentation as the baseline checkpoint (`960243b`).
- Scaffolded a minimal Vite + React + React Three Fiber (+ Drei) project.
- Implemented the persistent architectural shell: floor, back wall, two side walls, 8 structural columns, and a static initial camera position, per `build-status.md` §4 and `build-workflow.md` §7.
- Implemented viewport-height pinning (`--app-height`, resize-only-on-width-change) per `technical-architecture.md` §16, ahead of any scroll system.
- Verified production build, dev-server console cleanliness, and visual composition; verified canvas/camera resilience across a desktop→mobile-emulated→desktop viewport cycle.
- Documented two low-severity known issues (bundle size, dev-only esbuild advisory) and two testing gaps (Safari, real-device mobile/120Hz) rather than resolving or silently skipping them.
- Phase 1A is technically complete and awaiting human visual review and approval. Phase 1B has not been started.

### 2026-08-31 (refinement)

**Phase 1A column geometry refined — still within Phase 1A, still pending approval.**

- Replaced the placeholder box columns in `src/experience/Environment.jsx` with a single shared, restrained `LatheGeometry` profile (plinth, subtly tapered shaft, capital — no fluting or ornamentation), per human review feedback.
- Column positions, spacing, count, and overall height are unchanged; this is a geometry-only refinement, not a composition change.
- Verified: dev server renders with no console errors, production build succeeds.

### 2026-08-31 (Phase 1B)

**Phase 1A approved (human review in chat); Phase 1B — Atmosphere & Light implemented and technically complete.**

- Recorded Phase 1A approval: room dimensions, architectural proportions, column geometry/spacing, static camera framing, and overall layout are now protected foundations (§5).
- Implemented the primary volumetric lighting system: `src/experience/lighting/volumetricLighting.js` (a `THREE.SpotLight` primary light, an additive-blended shader cone for the visible shaft, an analytic floor light-pool, a low ambient fill, and a small static dust field — all built from an exported `lightingParams` data structure) and `src/experience/lighting/VolumetricLightingRig.jsx` (the R3F adapter).
- Removed the Phase 1A placeholder hemisphere/ambient "visibility aid" light from `Environment.jsx`; added shadow flags to the floor, walls, and columns; enabled `shadows` on the Canvas. No Phase 1A geometry, proportions, or material colors were changed.
- `update(time)` is defined on the controller but intentionally never called — Phase 1B lighting is static, and no per-frame work runs; Phase 1C will wire it to the shared timeline.
- Debugged and resolved a tone-mapping tuning gotcha (a near-black ambient color was crushed to literal `0,0,0` by the default ACES Filmic curve regardless of intensity); root-caused via isolated testing rather than guesswork, documented in §6 for future lighting tuning.
- Verified: production build succeeds, no console errors, no z-fighting/banding/flicker observed, shadow-casting mechanics confirmed working, mobile-viewport rendering resilient. Safari and real-device testing remain open gaps (carried over from Phase 1A).
- Phase 1B is technically complete and awaiting human visual review and approval. Phase 1C has not been started.

### 2026-08-31 (Phase 1B refinement)

**Phase 1B lighting refined per human visual feedback — still within Phase 1B, still pending approval.**

- Floor light edges: shadow map raised to 2048² with `shadow.radius: 6` blur and penumbra raised to 0.92; floor geometry given 32×64 tessellation. Verified: visibly softer shadow edge (re-ran the column-aim test from the original Phase 1B verification).
- True 3D volumetric beam: rebuilt the shaft as two nested additive cones (a brighter, narrower "core" inside a softer, wider "halo") with a fresnel/view-angle density term, replacing the single flat shell; dust count/opacity raised slightly (140→170, 0.35→0.4) to read within the larger beam. No new dependency — plain mesh/shader technique, no raymarching or depth-texture pass.
- Background visibility & depth: ambient intensity raised 0.85→1.1 so the back and side walls stay softly legible; added `THREE.FogExp2` (`#08080a`, density 0.05) via a declarative `<fogExp2>` in `CinematicExperience.jsx` for spatial separation between the columns, the beam, and the back wall. Fog applies to the standard-material architecture and dust automatically; the shaft/floor-pool shaders are deliberately not fogged (they're additive light, not physical surfaces).
- Fixed a resulting R3F disposal error (the shaft becoming a nested `Group` broke R3F's default `<primitive>` auto-dispose traversal on unmount) by passing `dispose={null}` and relying solely on `controller.dispose()`.
- Verified: production build succeeds, no console errors (traced an initial batch of stale-looking error logs to browser-tab log-buffer persistence, confirmed clean in a fresh tab), no z-fighting/banding/flicker, shadow softness improvement confirmed, mobile-viewport rendering resilient.
- Phase 1B remains technically complete and awaiting human visual review and approval. Phase 1C has not been started.

### 2026-08-31 (Phase 1B second refinement — background wall visibility)

**Phase 1B ambient/fog tuned further per human visual feedback — still within Phase 1B, still pending approval.**

- Background walls and columns still read as lost in near-pure black after the first refinement pass. Raised `AmbientLight` intensity 1.1→1.7 and warmed/lightened its color slightly (`#9a9aa2`→`#a6a6b0`).
- Lifted fog color off pure black and reduced its density: `#08080a`→`#242428`, density 0.05→0.032 — the previous fog settings were themselves contributing to the background reading as lost in blackness.
- Evaluated the third checklist option (lightening wall material color/roughness) and determined it wasn't needed — the ambient/fog changes alone made the back wall, side walls, and column silhouettes clearly legible while leaving the approved Phase 1A material colors untouched.
- Verified: production build succeeds, no console errors, no context loss on mobile-viewport re-check.
- Phase 1B remains technically complete and awaiting human visual review and approval. Phase 1C has not been started.

### 2026-08-31 (Phase 1B third refinement — three-tier surface tonality)

**Global exposure raised and an explicit three-tier material hierarchy introduced — still within Phase 1B, still pending approval.**

- Raised `AmbientLight` intensity 1.7→2.3 (color `#a6a6b0`→`#adadb8`) and thinned fog slightly further (density 0.032→0.028, color `#242428`→`#2c2c30`) for overall brighter, clearly legible room exposure.
- Introduced `SURFACE_TONE` in `Environment.jsx`, replacing the four ad hoc per-mesh hex colors with a single named three-tier system: columns lightest (`#8c8c8c`) → back/side walls mid (`#5e5e5e`/`#565656`, unchanged from the prior pass) → floor darkest.
- The floor tone was tuned empirically rather than eyeballed: the first darkest-tier candidate (`#303030`) measured RGB≈(7,7,8) in the near-camera foreground via direct pixel sampling — i.e. functionally pitch black despite non-zero ambient, the same ACES tone-mapping crush pattern already logged in §6. Lightened in two steps (`#303030`→`#404040`→`#484848`) until the near-camera floor read as a clearly legible dark grey (RGB≈19,19,22) while remaining visibly the darkest of the three tiers.
- Nudged the volumetric shaft opacity up slightly (halo 0.055→0.075, core 0.12→0.16) to confirm the beam and floor light-pool stay cinematically prominent against the brighter room rather than washing out — verified visually, no washout observed.
- Verified: production build succeeds, no console errors (desktop + mobile viewport), no context loss, three-tier hierarchy clearly visible and matches lightest→darkest ordering (columns > walls > floor) both visually and via pixel sampling.
- Phase 1B remains technically complete and awaiting human visual review and approval. Phase 1C has not been started.

### 2026-08-31 (Phase 1C)

**Phase 1B approved (human review in chat); Phase 1C — Camera & Scroll implemented and technically complete.**

- Recorded Phase 1B approval: the full lighting/material system (§5) is now a protected foundation.
- Added `gsap` as a dependency (the recommended stack for scroll orchestration per `technical-architecture.md` §3).
- Implemented the scroll-driven camera: `src/experience/timeline/cameraPath.js` (pure keyframe interpolation, deterministic and therefore reversible), `src/experience/timeline/ScrollTimelineProvider.jsx` (the single master GSAP/ScrollTrigger timeline, `scrub: 0.6`, exporting a plain mutable `scrollProgress` object), `src/experience/timeline/ScrollCameraRig.jsx` (a `useFrame` callback that mutates `camera.position`/`camera.lookAt` directly — no React state anywhere in this path, grep-verified).
- Restructured `App.jsx` and `global.css` so the canvas is pinned (`position: fixed`) while a real DOM spacer drives native page scroll; `#root`'s height constraint was removed since it would have clipped the spacer and prevented scrolling.
- Caught and fixed an issue during verification, before marking the phase complete: an early camera-path draft ended inside the Phase 1B light beam's dust/particle volume, producing a visible clipping artifact against the shaft and an oversized dust sprite up close. Revised the final keyframe to approach the beam without entering it.
- Verified: production build succeeds; camera framing at progress 0% is pixel-identical to the approved Phase 1B baseline; full reversibility confirmed (100%→0% reproduces the exact starting frame); ~60fps sustained during a continuous scroll stress test (156 frames sampled, 0 over 33ms); no `useState`/`setState` in the scroll/camera path; mobile-viewport rendering resilient; directly confirmed via a simulated height-only resize that `--app-height` (and therefore canvas/spacer sizing) does not change on mobile address-bar collapse/expand.
- Safari and real-device testing remain open gaps, explicitly flagged rather than deferred silently — `build-workflow.md` §9 calls out Safari testing specifically for this phase.
- Phase 1C is technically complete and awaiting human visual review and approval. Phase 1D has not been started.

### 2026-08-31 (Phase 1C motion physics refinement)

**Camera scroll motion smoothed — glide-to-rest instead of hard stops — still within Phase 1C, still pending approval.**

- Human feedback: the scroll animation felt rigid/stuttery with hard stops when scrolling stopped.
- Added `lenis` and `src/experience/timeline/smoothScroll.js`: normalizes raw wheel/touch input into smooth inertial scroll motion (`duration: 1.1`, ease-out-cubic easing, `lerp: 0.1`, `syncTouch: true` so touch gets the same physics as desktop wheel), wired via the standard Lenis/GSAP integration (`lenis.on('scroll', ScrollTrigger.update)`, driven by `gsap.ticker`).
- Reduced `ScrollTrigger`'s own `scrub` (`0.6→0.15`) since Lenis now carries the primary smoothing — avoids stacking two independent smoothing layers into one over-laggy result.
- Changed `ScrollCameraRig.jsx` to damp the camera toward its scroll-derived target every frame using `THREE.MathUtils.damp` (position and lookAt, both per-axis and frame-rate independent via the real `delta`) instead of snapping directly to the target — this is what removes the "hard stop": the camera keeps easing toward the current scroll target even after input stops.
- Considered `GSAP ScrollSmoother` as the task's offered alternative to Lenis, but it's a paid Club GreenSock plugin not available via a plain `npm install gsap` — used Lenis instead, which the task also named directly.
- Verified: dispatched a synthetic wheel event and sampled `scrollY` over time, confirming a smooth decaying glide-to-rest curve (not an instant jump); confirmed no oscillation/overshoot once settled; re-ran the frame-timing measurement with the full smoothing stack active under a simulated wheel-gesture burst — ~60fps sustained, 0 frames over 33ms, no regression from the pre-smoothing baseline; re-confirmed the mobile address-bar resize guard (`--app-height` unchanged on height-only resize) still holds with Lenis active; grep-confirmed no `useState`/`setState` anywhere in the scroll/camera path.
- `syncTouch: true` gives touch gestures the same physics as wheel by configuration, but an actual physical touch-drag gesture could not be reliably simulated in this environment — flagged as unverified-on-hardware rather than claimed as tested.
- Phase 1C remains technically complete and awaiting human visual review and approval. Phase 1D has not been started.

### 2026-08-31 (Phase 1D)

**Phase 1C approved (human review in chat); Phase 1D — Digital / Monitor Foundation implemented and technically complete.**

- Recorded Phase 1C approval: the scroll-driven camera mechanism and keyframe path are now a protected foundation (§5).
- **Scope conflict caught before implementation:** the Phase 1D authorization prompt asked for a cinema-camera mesh in addition to the monitor. `build-workflow.md` §10 explicitly states "Phase 2 will build the final Film act and integrate the final cinema-camera object" and scopes Phase 1D to monitor-only work. Flagged to the human via `AskUserQuestion` rather than silently resolved either way; the human confirmed monitor-only scope and re-issued the authorization accordingly. No cinema-camera mesh was built.
- Implemented the monitor: `src/experience/digital/Monitor.jsx` (base, neck, body, screen, glass — dark brushed-metal `MeshStandardMaterial`, `MeshPhysicalMaterial` glass pane) positioned exactly at the Phase 1B beam's floor target via `lightingParams.target`, so it stands physically within the volumetric beam rather than coincidentally near it.
- Implemented the screen: `src/experience/digital/screenTestPatternMaterial.js`, an unlit SMPTE-style color-bar shader with `toneMapped: false` so it reads as a genuinely glowing screen against the tone-mapped dark room, without adding a real light source (kept the "one light" narrative thread intact).
- Extended `src/experience/timeline/cameraPath.js` from 4 to 5 keyframes: the original hero→approach path's positions/lookAts are unchanged, only rescaled to `t: 0, 0.25, 0.5, 0.75` to make room for a new final `t: 1.0` keyframe — computed from `MONITOR_ANCHOR` (not hand-tuned numbers) so it stays correct if the monitor's placement or size ever changes. Same deterministic, reversible, Lenis+damp-smoothed path mechanism as Phase 1C — no separate/special-cased transition into monitor alignment.
- Verified: production build succeeds; monitor renders cleanly in the beam at progress 0%; the approach and final alignment shots are clean with no clipping (caught and corrected a test-script arithmetic bug during verification — not a product bug — see §9's testing note); full reversibility confirmed; ~60fps sustained, no regression from Phase 1C; mobile viewport and address-bar-resize guard re-confirmed; no `useState`/`setState` anywhere in the scroll/camera/digital path (grep-verified).
- Phase 1D is technically complete and awaiting human visual review and approval. Phase 2 has not been started.

### 2026-08-31 (Entrance pillar geometry refinement)

**Two foreground entrance pillars added to the Phase 1A environment — a cross-cutting revision, not phase-authorized work.**

- Added `entrancePillarPositions` in `src/experience/Environment.jsx`: a pillar pair at `[∓2.2, 4]`, reusing the existing column geometry and Tier-1 material — no new geometry/material system.
- Placed so the camera's existing first path segment (which holds `x: 0` between the hero keyframe and `t: 0.25`) passes safely between them (~1.8 units of clearance); the camera path itself was not modified.
- Iteratively tuned via screenshot verification — two earlier placements read as full-height foreground bands rather than a clean gateway frame before settling on `[∓2.2, 4]`; also traced and corrected a viewport-aspect mismatch (a custom `resize_window` call rendering closer to square than 16:9) that briefly made one placement attempt look broken.
- Verified: no clipping through the pass-through segment, full reversibility, production build succeeds, no console errors, no frame-timing regression, mobile renders cleanly (pillars fall outside portrait's narrower FOV at this position — expected, mobile recomposition is separately scoped for Phase 4).
- Recorded in §4A rather than folded into Phase 1D, since it revises Phase 1A's approved column layout rather than being Phase 1D scope. Awaiting human visual review.

### 2026-08-31 (Shadow/frustum hardening fix)

**Investigated a reported flicker/jitter after the entrance pillars were added; applied preventative hardening, could not reproduce the artifact itself.**

- Human report: scroll jitter and high-frequency light flickering/strobing after the entrance pillars were added.
- Investigated before changing anything: static 7×7 pixel-neighborhood sampling at a pillar/floor shadow-contact point (no acne noise found), temporal pixel sampling across ~150 frames during active scroll through the pass-through segment (smooth, monotonic, no oscillation), and frame-timing during that segment (168 frames, ~16.6ms avg, 0 over 33ms — no stutter). No WebGL console warnings at any point. Could not reproduce the reported artifact in this sandboxed environment.
- Applied technically appropriate hardening rather than the literal suggested values: added `spotLight.shadow.normalBias = 0.02` (the standard fix for shadow acne on curved geometry like the pillars) instead of changing `shadow.bias` to `-0.0001` as literally suggested — that value has a smaller magnitude than the already-tuned `-0.0012` and would likely make acne risk worse, not better, so it wasn't applied. Lowered the camera `near` plane `0.1 → 0.05` for extra frustum-popping margin given the pillars' proximity. Re-confirmed (unchanged) that the Lenis/GSAP + `THREE.MathUtils.damp` architecture and the no-React-state rule are both still intact.
- Verified: no regressions — production build succeeds, reversibility and pass-through checks still clean, frame-timing unchanged, mobile renders without errors.
- **Flagged rather than claimed fixed:** could not empirically reproduce the reported artifact in this environment, so I can't confirm the fix resolves it — asked for on-device re-confirmation and, if it persists, more specific repro details (browser/GPU/scroll position).

### 2026-08-31 (Camera/monitor transition light pop fix)

**Fixed a light "pop" at the camera→monitor alignment transition by computing its actual geometric cause, then fading the beam across it.**

- Human report: a slight light shift/jolt right as the camera transitions from the close-up approach to squarely aligned with the monitor screen.
- Computed the beam-axis geometry rather than guessing: the final "squarely aligned" camera position sits ≈1.18 units from the halo cone's axis where the cone's radius is ≈2.69 (inside the shell by ≈1.5), while the previous keyframe sits ≈0.69 outside it — the camera crosses from outside to inside the hollow double-sided additive shell around progress ≈0.82, which is a known source of a brightness pop (near-clip cutting away one of two blended shell faces as the camera enters).
- Since the monitor stands deliberately at the beam's target (near the cone's widest point), the camera can't stay outside the cone while framing it squarely — repositioning the final keyframe isn't viable. Implemented the fade alternative instead: `volumetricLighting.js`'s `update(progress)` (previously a no-op) now fades the shaft/floor-pool opacity from `BEAM_FADE_START = 0.7` to `BEAM_FADE_END = 0.88`, called every frame from `VolumetricLightingRig.jsx` via the shared `scrollProgress` object — no React state introduced.
- Checked the other two requested items and found both already correct, so left them unchanged: camera position and lookAt already share the identical damp lambda and per-frame delta (genuinely synchronized), and the final camera position/lookAt already differ by a pure `(0,0,2.1)` offset — exactly perpendicular to the screen plane, confirmed by direct vector math.
- `Monitor.jsx` — made the screen/glass meshes' shadow exclusion explicit (`castShadow={false} receiveShadow={false}`, previously relying on the default) and documented that the screen's unlit `ShaderMaterial` has no PBR roughness/metalness to tune in the first place.
- Verified: fade is smooth across 60%/70%/82%/100% scroll positions with no visible pop, full reversibility, no frame-timing regression, no console errors, mobile renders cleanly, production build succeeds.

### 2026-08-31 (Phase 1B rebuild — clean lighting architecture)

**Rebuilt `src/experience/lighting/` from scratch on human request, replacing accumulated runtime patches with a simpler, more robust architecture. Phase 1A (including entrance pillars) and Phase 1D monitor geometry untouched.**

- Removed the scroll-coupled beam-fade from the previous fix (§4C) — a runtime patch tied to specific camera-path progress values.
- Removed the two-mesh core+halo fresnel-shaded shaft; replaced with a single mesh.
- Replaced runtime fading with **geometric truncation**: the beam mesh now only extends 75% of the way from the light source toward the floor target, keeping its lowest point (world Y ≈ 2.0) permanently above every camera height in `cameraPath.js` (max ~1.7) — the camera cannot end up inside this geometry for any progress value, by construction, with no dependency on the current camera path's specific numbers. Caught and corrected an over-conservative first attempt (`lengthFraction: 0.6`) that pushed the whole beam out of the hero shot's frustum, invisible — found via screenshot comparison, not assumed from the math.
- Retuned opacity after collapsing two overlapping shells into one (`beam.opacity: 0.11`, `floorPool.opacity: 0.22`) — isolated a visibility-tuning issue from a possible geometry bug by briefly testing at an intentionally oversaturated `opacity: 0.5` first.
- Added a stable, non-shadow-casting `DirectionalLight` as general room fill, supplementing the existing tuned ambient light. Spot remains the sole shadow caster.
- Restructured `lightingParams` into named groups (`spot`/`key`/`ambient`/`shadow`/`fog`/`beam`/`floorPool`/`dust`); updated the one external reference (`Monitor.jsx`'s `MONITOR_ANCHOR.position`, now `lightingParams.spot.target`).
- Verified the three-tier surface hierarchy (`Environment.jsx`'s `SURFACE_TONE`) already matched the request exactly — confirmed by reading the file, not changed.
- Verified: full scroll range (0/33/75/100%) clean with no artifacts, full reversibility, no frame-timing regression (~16.6ms avg, 0 over 33ms), production build succeeds, no console errors, no React state anywhere in `src/` (grep-verified), mobile renders cleanly.
- One false alarm during this pass: a stale HMR error in the dev tab (persisted across reloads) was traced to the tab's own error-overlay state via a fresh-tab test, not a real code issue.

### 2026-08-31 (Retro/industrial monitor geometry)

**Rebuilt the monitor mesh as a retro/mid-century industrial reference-monitor console on human request; verified the camera handshake required zero code changes.**

- `Monitor.jsx` rebuilt: a four-legged equipment cart (replacing the thin pedestal), a deep rounded-corner boxy housing with a recessed rear hump suggesting CRT tube depth (replacing the 0.07-deep flat-panel slab), a thick asymmetric bezel with two control knobs, and a matte mostly-non-metallic charcoal finish (`roughness: 0.75, metalness: 0.12`, replacing the previous brushed-aluminum-like values).
- Added `RoundedBoxGeometry` from `three/examples/jsm/geometries/` — bundled with the already-installed `three` package, not a new dependency.
- `MONITOR_ANCHOR.screenCenterHeight` is computed from the new console's actual stacked dimensions, not hand-picked; `cameraPath.js`'s monitor-aligned keyframe already derives from `MONITOR_ANCHOR` (established in Phase 1D) — confirmed visually that the camera automatically retargeted correctly to the new screen center with no changes to the camera timeline itself.
- Verified: hero frame reads clearly retro/industrial, final aligned shot squarely framed with no manual retuning, approach segment clean with no clipping against the taller/deeper housing, full reversibility, no frame-timing regression despite added geometry, production build succeeds, no console errors, no React state anywhere in `src/`, mobile renders cleanly.

### 2026-08-31 (Organic camera weight)

**Refined GSAP timeline and R3F damping for physical camera weight, on human request.**

- `cameraPath.js`: eased curve upgraded cubic → quintic in/out; added a derived "settle" keyframe at `t: 0.92` (85% of the way from the approach shot to the final monitor-aligned shot) so the last stretch of scroll is a deliberately small, decelerating movement rather than a sweep that stops abruptly at progress 1.0.
- `ScrollCameraRig.jsx`: split the single damp lambda into `POSITION_DAMP_LAMBDA = 4.5` and `LOOKAT_DAMP_LAMBDA = 3` — the lookAt target now trails position slightly, giving an asynchronous rotational lag that reads as a heavy dolly rig rather than a rigid point.
- `smoothScroll.js`: Lenis `duration` raised `1.1s → 1.3s`, `lerp` lowered `0.1 → 0.085`, explicit `syncTouchLerp: 0.085` added so touch and wheel share the same decay weight.
- Verified: smooth glide-to-rest (slightly longer settle than before, consistent with the raised duration), full reversibility, no frame-timing regression (~16.6ms avg, 0 over 33ms), production build succeeds, no React state anywhere in `src/`, mobile renders cleanly.
- Another stale-HMR false alarm during this pass (an `easeInOutCubic is not defined` error persisting across reloads after a rename) — traced to the tab's own error-overlay state via a fresh tab, not a real code issue; grep-confirmed the file had no remaining reference to the old name.

### 2026-08-31 (Retro monitor shadow/lighting investigation)

**Investigated a reported flicker/flashing after the retro monitor redesign; every specific claim in the request checked out as already fine once measured, except one real hardening fix.**

- Computed exact clearances rather than assuming: beam mesh vs. housing top — 0.34 units clear; camera near-clip vs. screen plane — ≈1.82 units clear. Confirmed the screen's shadow exclusion and the beam's material flags (`transparent`, `depthWrite: false`, `DoubleSide`) were already exactly as requested from earlier fixes (§4C, §4D). Did not apply the suggested `shadow.bias = -0.00015` — smaller magnitude than the already-tuned `-0.0012`, would likely worsen acne risk (same reasoning as §4B); the request's own alternative, `normalBias: 0.02`, was already in place.
- Static and temporal pixel sampling (90–181 frames each) at rest and during active scroll: no flicker reproduced. One test run showed apparent instability that turned out to be the sample point sweeping across the screen's color-bar test pattern during camera motion — a methodology artifact, not a bug, confirmed by retesting on a plain surface nearby.
- Applied one real, targeted fix: disabled shadow casting on the new control knobs (`Monitor.jsx`, small 0.028-radius cylinders — exactly the kind of thin geometry prone to shadow-map aliasing, for negligible visual value, per `technical-architecture.md` §8).
- Verified: full reversibility, no frame-timing regression, production build succeeds, no React state anywhere in `src/`, mobile renders cleanly.
- Flagged rather than claimed resolved: as with §4B, the reported artifact couldn't be reproduced here — likely GPU/driver-specific if it's real. Requested on-device confirmation and, if it persists, the browser/GPU and approximate scroll position.

### 2026-08-31 (Choreography & scroll polish — remove hard stops)

**Diagnosed and fixed the root architectural cause of recurring "mechanical/hard stop" reports, after three prior rounds of surface-level damping/Lenis tuning failed to resolve it.**

- Root cause: `cameraPath.js` eased each of 5 keyframe segments independently, forcing camera velocity to zero at every waypoint — read as repeated small hard stops, not one continuous motion, regardless of how well the surrounding damping/scroll layers were tuned.
- Replaced the piecewise keyframes with a single `THREE.CatmullRomCurve3` through the same waypoints, sampled with one global ease — only progress 0 and progress 1 actually decelerate to rest; interior waypoints are passed through at continuous velocity. Changed the lookAt path's first waypoint from `[0, 1.6, -50]` to `[0, 1.6, -10]` so it isn't a severe outlier that would distort the spline's shape near the start, while producing a visually equivalent look direction.
- Retuned Lenis (`duration: 1.2`, `lerp: 0.11`, `syncTouchLerp: 0.11`) and ScrollTrigger `scrub` (`0.15 → 1`) per the request's explicit parameters.
- Verified: spline endpoints exactly match the hero and monitor-aligned framing (no jump at either end); full-range visual pass (0/15/40/65/100%, reversibility) clean with no spline-overshoot artifacts; wheel-burst decay test shows smooth exponential settle (~1.1s, no oscillation); mid-glide scroll-jump test confirms the added `scrub: 1` lag is visibly smoothing motion, not a no-op; frame-timing unchanged (~16.6ms avg, 0 over 33ms); production build succeeds; no React state anywhere in `src/`; mobile renders the correct hero frame with no console errors.

### 2026-08-31 (Motion polish & lighting fix — landing ease & monitor transition light glitch)

**Softened the final landing at the monitor lock and added a scroll-driven fade for the volumetric beam through the monitor approach, to address a reported light flicker at the transition.**

- `cameraPath.js`: single global ease made asymmetric — quintic-in (unchanged) for the first half, softer septic-out for the second half — a longer, gentler deceleration tail into the final monitor-locked shot.
- `ScrollCameraRig.jsx`: position and lookAt damping unified to one lambda (`3.5`, down from the asymmetric `4.5`/`3` of the organic-camera-weight round) so both converge in lockstep, removing the rotational micro-snap that the earlier asymmetric lag could produce right at the endpoint where both targets stop moving simultaneously.
- `ScrollTimelineProvider.jsx`: ScrollTrigger `scrub` raised `1 → 1.5`.
- `volumetricLighting.js`/`VolumetricLightingRig.jsx`: added `setApproachFade(fade)`, called every frame from a new `useFrame` in the rig (direct mutation of `scrollProgress.value`-derived uniforms/opacity, no React state) that fades the beam and dust to fully transparent between scroll progress 0.30 and 0.42, keeping the additive beam cone out of the camera's view during the approach into the monitor.
- Checked (not changed, already satisfied or not applicable): the screen mesh already has `castShadow={false}`; the spotlight's shadow map camera is independent of the main viewing camera's near plane in Three.js, so there's no "shadow buffer vs. camera near plane" interaction to fix.
- Verified: static and 60-frame temporal pixel sampling through the 0.30–0.42 fade window shows no oscillation (consistent with §4G's prior finding that this artifact isn't reproducible here); beam/dust visibly fade by 0.35 and are fully gone by 0.45 while the floor pool still reads as the light's landing point; full reversibility; frame-timing unchanged (~16.6ms avg, 0 over 33ms); production build succeeds; no React state anywhere in `src/`; mobile renders cleanly.

### 2026-08-31 (Atmospheric polish — preserve lens flare & dust during scroll transition)

**Fixed the atmosphere fully disappearing during the monitor approach — a direct side effect of the previous round's own fade-to-zero fix — and flagged two request items that don't match this codebase's actual architecture.**

- Root cause: §4I's approach-fade faded the beam and dust all the way to `0` opacity between scroll progress 0.30–0.42 to solve a light-transition concern; that fix worked, but it also meant the atmosphere stayed invisible for the rest of the scroll, which is exactly this report.
- `VolumetricLightingRig.jsx`: changed the fade to dip to a `0.3` floor instead of `0`, and hold there through the monitor lock — beam/dust now thin during the same approach window as before, but never fully vanish; a subtle glow and dust presence now persists to the final monitor-filling shot.
- Scope-checked rather than assumed: no lens-flare/bloom/postprocessing component exists anywhere in `src/` or `package.json` — not added, since that would be a new dependency and render pipeline, a real architectural addition. Dust's confinement to the light-beam volume is a protected Phase 1B decision (§5) — not expanded to cover the full camera trajectory; in practice the beam's floor target already coincides with the monitor's base position, so the existing dust cloud already reaches the monitor without needing to be spatially larger. The dust material's `transparent`/`depthWrite` flags were already exactly as requested.
- Verified: beam and dust both visibly present (dimmed, not gone) at progress 0.35 and at the final progress-1 monitor-filling shot; full reversibility; frame-timing unchanged (~16.6ms avg, 0 over 33ms); production build succeeds; no React state anywhere in `src/`; mobile renders cleanly.

---

## 12. Current Developer Instruction

This is a quick-reference derived from the process rules in `build-workflow.md` §5, §3A, and §17 — not an independent source of truth. If this checklist and `build-workflow.md` ever appear to conflict, `build-workflow.md` governs; update this section to match rather than treating it as authoritative on its own.

Before making any implementation change, Claude must answer these questions internally:

```text
1. What is the Current Phase, and what is the Current Approved Scope?
2. What is specifically in scope for that phase?
3. What is explicitly out of scope?
4. What previously approved work must be protected?
5. What governing documents apply?
6. What known issues already exist?
7. What is the current Git recovery point?
8. What is the minimum implementation required?
9. How will the change be tested?
10. What must be reported for human review?
```

If the requested work does not belong to the current phase:

**STOP.**

Determine whether it is required to complete the current phase, is a blocker that requires a minimal fix, belongs to a future phase and should be documented, or requires explicit human authorization to expand scope.

Do not silently expand the current phase.

---

## 13. Approval Gate

The project may progress only through explicit approval.

```text
IMPLEMENT → TEST → VISUAL VERIFICATION → TECHNICALLY COMPLETE
→ HUMAN REVIEW → HUMAN APPROVAL → UPDATE BUILD STATUS → NEXT PHASE
```

**Technical completion does not equal approval.**

Only explicit human approval advances the project to the next phase.
