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
