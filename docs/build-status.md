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
**Current Phase:** Phase 1C — Camera & Scroll
**Phase Status:** Technically complete, pending human approval
**Current Objective:** Establish the scroll-driven cinematic camera timeline through the approved Phase 1A/1B environment.

### Current approval state

```text
PHASE 1A — Environment Shell
STATUS: APPROVED (2026-08-31, human review)

PHASE 1B — Atmosphere & Light
STATUS: APPROVED (2026-08-31, human review)

PHASE 1C — Camera & Scroll
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
├── 1C — Camera & Scroll                TECHNICALLY COMPLETE
└── 1D — Digital / Monitor Foundation   NOT STARTED

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

## 4. Phase 1C — Camera & Scroll

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

### Objective
Establish the cinematic camera system and scroll-controlled timeline: continuous camera movement, scroll-to-progress mapping, reversible progression, camera smoothing, camera orientation, timeline state, and the initial Film approach, per `build-workflow.md` §9.

### In scope
A single master GSAP/ScrollTrigger timeline mapping normalized scroll (0.0–1.0) to a continuous, reversible camera path through the approved Phase 1A/1B environment, ending near (not inside) the Phase 1B light beam's floor target as a provisional "central anchor" approach shot.

### Out of scope
Phase 1D cinema-camera/monitor meshes, portfolio media, video reels, UI text layers, audio, Phase 2 content, section-snapping or auto-scroll behavior.

### Review criteria
Camera should feel smooth → physical → responsive → deliberate, not sticky → delayed → mechanical → jittery (per `build-workflow.md` §9).

### Current implementation notes

- `src/experience/timeline/cameraPath.js` — a pure, stateless function `sampleCameraPath(progress)` that interpolates camera position and lookAt target across 4 keyframes (`t: 0, 0.35, 0.7, 1.0`) with a per-segment `easeInOutCubic`. Deterministic given `progress` alone — scrolling back to any value reproduces the exact same camera state, which is what makes the path trivially reversible. Keyframe `t: 0` matches the approved Phase 1A static hero framing exactly (`[0, 1.6, 9]`, looking level down −Z) so there is no jump at the top of the page. The path moves forward between the columns and settles facing the Phase 1B beam's floor target, staying just outside the beam's ~3.4-unit-radius dust volume (an approach shot, not a fly-through — an earlier attempt that ended inside that volume produced visible clipping/oversized-sprite artifacts against the dust and floor-pool geometry, caught and fixed during verification, not shipped).
- `src/experience/timeline/ScrollTimelineProvider.jsx` — owns the single master `gsap.timeline({ scrollTrigger: {...} })` (registers the `ScrollTrigger` plugin) and exports `scrollProgress`, a plain mutable object (`{ value: 0 }`) — **not React state**. `ScrollTrigger`'s `scrub: 0.6` ties `scrollProgress.value` bidirectionally and smoothly to real scroll position: fully reversible, no section-snapping, no auto-scroll. Also renders `<ScrollSpacer>`, the DOM element that gives the document real scrollable height (`calc(var(--app-height) * 3)` — a provisional 3-viewport scroll length for this phase's proof of mechanism, not final act pacing, expressed via the cached viewport height rather than raw `vh` so it doesn't shift when mobile browser chrome resizes).
- `src/experience/timeline/ScrollCameraRig.jsx` — inside the R3F `Canvas`, a `useFrame` callback that reads `scrollProgress.value`, samples `cameraPath.js`, and directly mutates `camera.position.set(...)` / `camera.lookAt(...)` every frame. No `useState`/`setState` anywhere in the scroll or camera path (verified by grep), per `technical-architecture.md` §7's explicit rule against dispatching React state from per-frame or scroll callbacks.
- `src/App.jsx` / `src/styles/global.css` — restructured so the canvas stays fixed/pinned over the viewport (`.app-shell { position: fixed; inset: 0; ... }`) while `<ScrollSpacer>` (a plain block-level sibling) gives the actual document real scrollable height. `#root` no longer constrains height (previously `height: var(--app-height)`, which would have clipped the spacer and prevented scrolling). Reuses the existing Phase 1A `useViewportHeight` hook unchanged — mobile address-bar resize was already handled there (cached height, only re-reads on real width change) and now also protects the scroll-spacer's height from jittering.
- `src/experience/CinematicExperience.jsx` — mounts `<ScrollCameraRig />` inside the `Canvas`; the `camera` prop's initial position still seeds the mount state and matches keyframe `t: 0` exactly.
- Added `gsap` as a dependency (already the recommended stack in `technical-architecture.md` §3 for scroll orchestration — not a new/unlisted dependency).

### Known issues
*None new.* See §6 for the carried-over Phase 1A/1B issues (bundle size, dev-only esbuild advisory — bundle size grew further with GSAP, still deferred to Phase 5).

### Required next step
Phase 1C is technically complete and awaiting human visual review and explicit approval before Phase 1D begins.

Do not begin Phase 1D until Phase 1C is explicitly approved.

---

## 5. Approved Visual Decisions

This section records visual decisions that have already received human approval and therefore should be treated as protected foundations.

### Approved

**Phase 1A — Environment Shell (approved 2026-08-31):**
- Room dimensions and architectural proportions (14×32 floor, 9 unit wall height).
- Column geometry, proportions (plinth/tapered shaft/capital LatheGeometry profile), count (8, 4 per side), and spacing.
- Initial (progress-0) camera framing `[0, 1.6, 9]`, `fov: 45`, looking level down −Z, and the resulting negative space / composition.
- Overall room layout (floor, back wall, two side walls, no ceiling).

**Phase 1B — Atmosphere & Light (approved 2026-08-31):**
- The primary light system's character: warm SpotLight-driven volumetric shaft, floor light-pool, shadow-casting architecture, dust confined to the beam, and the ambient/fog/three-tier material tonality (columns lightest → walls mid → floor darkest) reached across three review passes.
- Exact final parameter values live in `lightingParams` (`src/experience/lighting/volumetricLighting.js`) and `SURFACE_TONE` (`src/experience/Environment.jsx`).

These are now protected foundations. Later phases must not alter them without identifying the conflict first — with one already-anticipated exception: Phase 1A's "static initial camera position" was always scoped as the **opening (progress-0) framing only** (`build-status.md` §4's Phase 1A record explicitly listed "full camera choreography" as out of scope, reserved for Phase 1C). Phase 1C making the camera scroll-driven for progress > 0 is that anticipated evolution, not a violation — the progress-0 framing itself is unchanged and still matches the approved composition exactly.

### Protected decisions

When a visual or interaction decision is approved, record it here. Examples: camera starting composition, architectural proportions, light direction, monitor position, scroll behavior, transition timing, typography placement, portfolio composition.

Previously approved decisions must not be changed casually in later phases. If a later phase requires a change to an approved decision, Claude must identify the conflict and report it before making the change.

---

## 6. Known Issues

Record known technical, visual, browser, performance, or content issues here.

| Issue | Phase Found | Severity | Current Action | Target Phase |
|---|---|---|---|---|
| Production bundle exceeds Vite's 500kB chunk-size warning (~1082kB / ~314kB gzip as of Phase 1C, adding GSAP) | 1A | Low | Documented only; no code-splitting attempted | Phase 5 (Performance) |
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
**Current commit (Phase 1B, technically complete):** `c574d5e` — "Phase 1B: three-tier surface tonality and higher global exposure" (on top of `d36f88b`, `2da89c8`, and `9d7e5b2`, the prior Phase 1B commits)

The repository was initialized (`git init -b main`) with the five governing documents relocated into `docs/` as the first commit, giving a clean recovery point before any implementation began. Phase 1A (scaffold, environment shell, column refinement) was committed and approved on top of that baseline; Phase 1B (volumetric lighting) is committed on top of the approved Phase 1A checkpoint and is recoverable independently of it.

### Checkpoint rules

Before significant implementation: confirm the current Git state, identify the current commit, ensure the previous approved state is recoverable, make the implementation changes, test the changes, and record the relevant checkpoint when the phase reaches technical completion or approval.

Do not overwrite or discard an approved state without a recoverable Git history.

---

## 9. Testing State

### Current phase testing

**Phase:** 1C
**Functional testing:** COMPLETE — `npm run build` succeeds (Vite production build, 66 modules, no errors); dev server starts cleanly with no console errors from the application, including after repeated scrolling and simulated resize events.
**Visual testing:** COMPLETE (via the in-app Chromium browser pane) — verified camera framing at progress 0% (matches the approved Phase 1A/1B baseline exactly), 50%, and 100%; verified full reversibility (scroll to 100% then back to 0% reproduces the exact starting frame, as expected from `sampleCameraPath` being a pure function of progress); caught and fixed a clipping artifact from an earlier camera-path draft that ended inside the light beam's dust volume before marking the phase complete.
**Chrome testing:** COMPLETE — verified in the Chromium-based browser pane (desktop viewport).
**Safari testing:** NOT YET COMPLETE — no macOS/iOS Safari available in this environment; carried over from Phase 1A/1B as an open gap, not silently skipped. Scroll/GSAP behavior in Safari specifically has not been verified — flagging per `build-workflow.md` §9's explicit requirement to test Safari during the camera/scroll phase, not defer it to final polish.
**Mobile testing:** PARTIAL — verified via emulated 375×812 mobile viewport: renders correctly, no console errors. Directly verified (via a simulated `resize` event with `innerHeight` changed and `innerWidth` held constant) that `--app-height` — and therefore canvas and scroll-spacer sizing — does not change on a height-only resize, which is the mechanism that prevents mobile address-bar show/hide from snapping the canvas or camera mid-scroll. Real-device touch/scroll momentum behavior not testable in this environment.
**120Hz testing:** NOT DIRECTLY TESTABLE in this environment (no real 120Hz display). Frame-timing was measured during a continuous 2-second programmatic scroll: 156 frames, ~16.65ms average frame time (~60fps), 18.70ms max, 0 frames exceeding 33ms — no dropped-frame stutter observed at the display refresh rate available here. The camera path itself is refresh-rate-independent (driven by `scrollProgress.value` each frame via `useFrame`, not a fixed-step timer), so it should scale to higher-refresh displays, but this has not been observed directly on hardware.

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
**Human approval:** Pending
**Major changes:** Added `gsap` dependency. Added `src/experience/timeline/cameraPath.js` (pure keyframe/easing camera-path function), `src/experience/timeline/ScrollTimelineProvider.jsx` (master GSAP/ScrollTrigger timeline + scroll spacer, exporting a plain mutable `scrollProgress` object — not React state), and `src/experience/timeline/ScrollCameraRig.jsx` (a `useFrame` callback that directly mutates `camera.position`/`camera.lookAt` every frame). Restructured `App.jsx`/`global.css` so the canvas is pinned (`position: fixed`) while a real scrollable spacer drives native page scroll. No Phase 1A/1B geometry, lighting, or material values were changed.
**Testing performed:** Production build, dev-server console check, visual verification at multiple scroll positions (0%, 50%, 100%), reversibility check (scroll to 100% then back to 0%, confirmed pixel-identical to the approved Phase 1B baseline), frame-timing measurement during continuous scroll (~60fps average, 0 frames over 33ms — see §9), grep-verified no `useState`/`setState` in the scroll/camera path, mobile-viewport resilience check, and a direct simulated-resize test confirming `--app-height` (and therefore canvas/spacer sizing) does not change when only `window.innerHeight` changes (mobile address-bar collapse/expand).
**Known issues:** See §6 — bundle size grew further with GSAP (still low severity, deferred to Phase 5); no new issues introduced. One in-flight issue was caught and fixed during verification, not shipped: an earlier camera-path draft ended inside the Phase 1B dust/beam volume and produced visible clipping artifacts — the path was revised to stay outside that volume before this phase was marked complete.
**Approved visual decisions:** None yet — pending human review of this phase.
**Git checkpoint:** `main` branch; see §8 for the exact commit once recorded.
**Next approved phase:** Pending human approval of Phase 1C before Phase 1D (Digital / Monitor Foundation) may begin.

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
