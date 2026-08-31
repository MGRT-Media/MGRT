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
**Current Phase:** Phase 1B — Atmosphere & Light
**Phase Status:** In progress
**Current Objective:** Introduce the primary cinematic volumetric light into the approved Phase 1A architectural shell.

### Current approval state

```text
PHASE 1A — Environment Shell
STATUS: APPROVED (2026-08-31, human review)

PHASE 1B — Atmosphere & Light
STATUS: IN PROGRESS
APPROVAL: NOT YET GRANTED
```

Claude must work only within the currently approved scope unless explicitly instructed otherwise.

---

## 3. Phase Progress

```text
PHASE 1
├── 1A — Environment Shell              APPROVED
├── 1B — Atmosphere & Light             IN PROGRESS
├── 1C — Camera & Scroll                NOT STARTED
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

## 4. Phase 1B — Atmosphere & Light

**Status:** IN PROGRESS
**Approval:** NOT YET GRANTED

### Objective
Establish the opening visual language: primary directional/volumetric light, architectural shadows, initial atmospheric depth, dust within illuminated areas, opening darkness, and the light reveal, per `build-workflow.md` §8. The light must feel physically motivated.

### In scope
The primary cinematic light and its immediate physical effects on the approved Phase 1A shell: light source, visible volumetric shaft, light falloff/softness, floor/architecture interaction (shadows, light pool), and restrained dust within the illuminated volume.

### Out of scope
Scroll-driven or time-based lighting changes (Phase 1C), camera choreography, Film/Digital/Campaign content, new architecture materials, post-processing, audio.

### Review criteria
Light direction, contrast, architectural readability, dust subtlety, volumetric quality, atmospheric depth, and overall cinematic tone (per `build-workflow.md` §8).

### Current implementation notes

- `src/experience/lighting/volumetricLighting.js` — framework-agnostic controller (`createVolumetricLighting()`) exposing `init()` / `update(time)` / `dispose()` and an exported `lightingParams` data structure (color, intensity, position, target, angle, penumbra, decay, distance, shadow, ambient, fog, volumetric, dust) for Phase 1C to bind to later. Builds:
  - A `THREE.SpotLight` (the primary light, shadow-casting, warm ~`#fff1dc`, intensity 55, positioned high at `[3.4, 8, 2.2]` aimed at `[0.6, 0, -3.5]`, 0.32 rad angle, **0.92 penumbra**, **2048×2048 shadow map, `shadow.radius: 6`** for a smooth, organic floor-pool/shadow edge with no visible polygonal artifacting).
  - The visible shaft is now **two nested additive-blended `ShaderMaterial` cones** — a narrow brighter "core" (`coreScale: 0.42`, opacity 0.12) inside a wider softer "halo" (opacity 0.055) — plus a **fresnel (view-angle) term** in the fragment shader that boosts density at grazing/silhouette angles. The overlapping shells plus the angle-dependent density read as a beam with real physical volume and depth rather than a flat translucent surface, while remaining a plain mesh/shader technique — no raymarching, no depth-texture pass, no new dependency.
  - A soft radial floor light-pool (analytic shader, no texture).
  - A desaturated-grey `AmbientLight` (`#9a9aa2`), **raised from 0.85 to 1.1** so the back wall and side walls stay softly legible instead of dropping to pitch darkness.
  - A small static `THREE.Points` dust field confined to the shaft volume, **raised from 140 to 170 points / 0.35 to 0.4 opacity** so it reads more clearly within the now-larger, doubled beam volume — still static (no per-frame motion), still restrained per `creative-reference.md` §10.
- `src/experience/lighting/VolumetricLightingRig.jsx` — thin R3F adapter: instantiates the controller once, calls `init()` on mount and `dispose()` on unmount, adds `controller.group` via `<primitive dispose={null}>` (disposal is handled entirely by `controller.dispose()`; R3F's own auto-dispose traversal isn't a fit for imperatively-nested lights/groups). Deliberately does **not** call `update(time)` from a `useFrame` loop — Phase 1B lighting is static by requirement, so no per-frame work happens yet; Phase 1C will wire `update(time)` to the shared timeline.
- `src/experience/Environment.jsx` — removed the Phase 1A placeholder hemisphere/ambient "visibility aid" light (as already flagged as provisional in the Phase 1A record) and mounted `<VolumetricLightingRig />` instead. Added `receiveShadow`/`castShadow` flags to the floor, walls, and columns so the architecture participates in the new shadow-casting light. **Floor geometry given 32×64 tessellation** (for smooth lighting/shadow reception, per review feedback — though note MeshStandardMaterial computes lighting per-fragment, so this is a defensive/compliance change more than a visible fix on its own). No geometry position, proportion, or material color was changed.
- `src/experience/CinematicExperience.jsx` — added the `shadows` prop to the R3F `Canvas` to enable the renderer's shadow map; added `<fogExp2 attach="fog" args={[lightingParams.fog.color, lightingParams.fog.density]} />` (`#08080a`, density 0.05) for atmospheric distance separation between the foreground columns, the beam, and the back wall — applies automatically to the standard materials (floor/walls/columns/dust) via three.js's built-in fog support; the custom shaft/floor-pool shaders are intentionally not fogged (they're additive light, not physical surfaces — fogging them would dim the beam itself, which isn't the intent). No other Canvas/camera change.

### Known issues

| Issue | Severity | Notes |
|---|---|---|
| ACES Filmic tone mapping (the R3F/three.js default) crushes low-radiance ambient contributions to literal black (`0,0,0`) in 8-bit output | Low (resolved via tuning, documented for Phase 1C) | Discovered during tuning: a plausible-looking dark ambient color/intensity combination rendered the entire room pure black outside the beam, even though the light was genuinely present and correctly attached to the scene. Root-caused via isolated testing (bypassing the custom module with a plain declarative `<ambientLight>`) rather than guessing. Resolved by using a desaturated *light* grey ambient color (`#9a9aa2`) at a moderate intensity (0.85, later 1.1) rather than a near-black color at high intensity — same "dark room" result, but the underlying radiance stays above the tone-mapping's black-crush threshold. Relevant for Phase 1C/1B follow-on tuning: prefer lowering intensity over darkening color when trying to dim a light. |
| R3F's default `<primitive>` auto-dispose traversal threw `Cannot read properties of undefined (reading 'dispose')` on unmount once the shaft became a nested `Group` of two meshes | Low (resolved) | R3F tries to auto-dispose objects passed to `<primitive>` on unmount; this traversal isn't built for a hand-assembled tree of imperatively-created lights/groups/meshes and choked once the shaft mesh became a `Group`. Fixed by passing `dispose={null}` on the `<primitive>` in `VolumetricLightingRig.jsx` so disposal is handled solely by `controller.dispose()`, which already explicitly disposes every geometry/material it owns. |

See also §6 for the two known issues carried over from Phase 1A (bundle size, dev-only esbuild advisory).

### Required next step
Phase 1B is implemented and awaiting human visual review and explicit approval before Phase 1C begins.

Do not begin Phase 1C until Phase 1B is explicitly approved.

---

## 5. Approved Visual Decisions

This section records visual decisions that have already received human approval and therefore should be treated as protected foundations.

### Approved

**Phase 1A — Environment Shell (approved 2026-08-31):**
- Room dimensions and architectural proportions (14×32 floor, 9 unit wall height).
- Column geometry, proportions (plinth/tapered shaft/capital LatheGeometry profile), count (8, 4 per side), and spacing.
- Static initial camera position `[0, 1.6, 9]`, `fov: 45`, and the resulting negative space / composition.
- Overall room layout (floor, back wall, two side walls, no ceiling).

These are now protected foundations. Phase 1B must not alter them; see §4 of `build-workflow.md`'s Phase 1B objective for what may change (lighting/atmosphere only).

### Protected decisions

When a visual or interaction decision is approved, record it here. Examples: camera starting composition, architectural proportions, light direction, monitor position, scroll behavior, transition timing, typography placement, portfolio composition.

Previously approved decisions must not be changed casually in later phases. If a later phase requires a change to an approved decision, Claude must identify the conflict and report it before making the change.

---

## 6. Known Issues

Record known technical, visual, browser, performance, or content issues here.

| Issue | Phase Found | Severity | Current Action | Target Phase |
|---|---|---|---|---|
| Production bundle exceeds Vite's 500kB chunk-size warning (~960kB / ~265kB gzip) | 1A | Low | Documented only; no code-splitting attempted | Phase 5 (Performance) |
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
**Current commit (Phase 1B, technically complete):** `2da89c8` — "Phase 1B: refine volumetric lighting per visual feedback" (on top of `9d7e5b2`, the initial Phase 1B implementation)

The repository was initialized (`git init -b main`) with the five governing documents relocated into `docs/` as the first commit, giving a clean recovery point before any implementation began. Phase 1A (scaffold, environment shell, column refinement) was committed and approved on top of that baseline; Phase 1B (volumetric lighting) is committed on top of the approved Phase 1A checkpoint and is recoverable independently of it.

### Checkpoint rules

Before significant implementation: confirm the current Git state, identify the current commit, ensure the previous approved state is recoverable, make the implementation changes, test the changes, and record the relevant checkpoint when the phase reaches technical completion or approval.

Do not overwrite or discard an approved state without a recoverable Git history.

---

## 9. Testing State

### Current phase testing

**Phase:** 1B (including the post-review lighting refinement)
**Functional testing:** COMPLETE — `npm run build` succeeds (Vite production build, 58 modules, no errors, both before and after the refinement); dev server starts cleanly with no console errors from the application (a batch of stale error-log entries from an earlier iteration, tied to a since-fixed R3F disposal issue, was traced to the browser pane's log buffer persisting across reloads in one tab — confirmed non-issue by checking a freshly opened tab, which showed zero errors).
**Visual testing:** COMPLETE (via the in-app Chromium browser pane) — the double-cone volumetric shaft with fresnel shading, softened floor light-pool, raised ambient fill on the architecture, and fog-assisted depth separation all render as intended; verified no z-fighting, banding, or flicker across repeated screenshots; re-verified shadow-casting softness by temporarily aiming the beam at a column (visibly softer edge than the pre-refinement baseline), then reverted to the approved baseline aim.
**Chrome testing:** COMPLETE — verified in the Chromium-based browser pane (desktop viewport).
**Safari testing:** NOT YET COMPLETE — no macOS/iOS Safari available in this environment; carried over from Phase 1A as an open gap, not silently skipped.
**Mobile testing:** PARTIAL — verified via emulated 375×812 mobile viewport (before and after the refinement): canvas/lighting renders correctly, no console errors, no context loss. Real-device touch/scroll and address-bar show/hide behavior not testable in this environment.
**120Hz testing:** NOT APPLICABLE YET — Phase 1B lighting is static (no per-frame work runs; `update(time)` is defined but never called), so there is nothing frame-rate-dependent to test. Relevant starting in Phase 1C.

Testing status should be updated as the phase progresses.

### Required testing before phase approval

A phase must not be marked technically complete until the relevant build checks, runtime checks, console checks, browser checks, device checks, scroll checks, visual checks, and regression checks have been completed.

---

## 10. Phase Completion Record

Each completed phase should receive a concise record.

### Phase 1A

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** Scaffolded Vite + React + React Three Fiber + Drei project from scratch; implemented the persistent architectural shell (floor, back wall, two side walls, 8 structural columns) and static initial camera; added viewport-height pinning per `technical-architecture.md` §16.
**Testing performed:** Production build verification, dev-server console check, visual composition review (desktop), emulated mobile-viewport resize/resilience check. See §9 for full detail and gaps (Safari, real-device mobile, 120Hz not yet testable).
**Known issues:** See §4 and §6 — bundle size and a dev-only `esbuild` advisory, both low severity and deferred to later phases.
**Approved visual decisions:** None yet — pending human review of this phase.
**Git checkpoint:** `main` branch; baseline docs commit `960243b`, Phase 1A commit `eea4e73`, column refinement `8f6784d`.
**Next approved phase:** Approved 2026-08-31 (human review in chat) — Phase 1B (Atmosphere & Light) began.

### Phase 1B

**Implementation:** Complete
**Technical completion:** Complete (2026-08-31)
**Human approval:** Pending
**Major changes:** Added `src/experience/lighting/volumetricLighting.js` (framework-agnostic controller with `init()`/`update(time)`/`dispose()` and an exported `lightingParams` data structure) and `src/experience/lighting/VolumetricLightingRig.jsx` (R3F adapter); replaced the Phase 1A placeholder hemisphere/ambient light in `Environment.jsx` with the real system; added shadow flags to the architecture and enabled `shadows` on the Canvas. **Refined (same session, human visual feedback):** raised shadow map to 2048² with `shadow.radius` blur and higher penumbra for a smooth floor-pool edge; rebuilt the shaft as two nested cones with a fresnel view-angle term for true volumetric depth; raised ambient and added `FogExp2` for background legibility and spatial depth; fixed an R3F disposal error surfaced by the new nested shaft structure.
**Testing performed:** See §9. Production build, dev-server console check, visual verification, shadow-casting mechanics check (including a repeat check after the refinement), mobile-viewport resilience check (before and after refinement).
**Known issues:** See §4 and §6 — an ACES tone-mapping tuning gotcha and an R3F disposal fix (both resolved, documented for future work), plus the two carried-over Phase 1A issues (bundle size, dev-only esbuild advisory).
**Approved visual decisions:** None yet — pending human review of this phase.
**Git checkpoint:** `main` branch; initial commit `9d7e5b2`, refinement commit `2da89c8`.
**Next approved phase:** Pending human approval of Phase 1B before Phase 1C (Camera & Scroll) may begin.

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
