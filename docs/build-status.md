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
**Current Phase:** Phase 1A — Environment Shell
**Phase Status:** Technically complete, pending human approval
**Current Objective:** Establish the persistent Three.js physical environment before introducing cinematic lighting, atmosphere, camera choreography, or final portfolio content.

### Current approval state

```text
PHASE 1A — Environment Shell
STATUS: TECHNICALLY COMPLETE
APPROVAL: NOT YET GRANTED
```

Claude must work only within the currently approved scope unless explicitly instructed otherwise.

---

## 3. Phase Progress

```text
PHASE 1
├── 1A — Environment Shell              TECHNICALLY COMPLETE
├── 1B — Atmosphere & Light             NOT STARTED
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

## 4. Phase 1A — Environment Shell

**Status:** TECHNICALLY COMPLETE
**Approval:** NOT YET GRANTED

### Objective
Establish the persistent physical environment: Three.js scene, architectural shell, floor, walls, structural elements, basic spatial scale, initial camera position, scene composition, and persistent environment structure.

### In scope
Only the systems necessary to establish the physical environment and its spatial foundation.

### Out of scope
Final portfolio content, campaign media, final Digital content, complex atmospheric effects, audio, advanced post-processing, complex cinematic transitions, final typography systems, secondary decorative objects, full camera choreography, and Film → Digital transition mechanics.

### Review criteria

Before Phase 1A can be approved, verify: the physical environment feels intentional, architectural scale is credible, spatial depth is established, camera starting position is appropriate, composition provides sufficient negative space, the environment supports the intended cinematic experience, scene structure is suitable for later phases, and no unnecessary complexity has been introduced.

### Current implementation notes

Project scaffolded from scratch (Vite + React + React Three Fiber + Drei; see `package.json`). Application structure follows `technical-architecture.md` §4's cinematic/explore separation — only the cinematic layer exists so far.

- `src/experience/CinematicExperience.jsx` — mounts the persistent R3F `Canvas`, static camera (`position: [0, 1.6, 9]`, `fov: 45`), capped `dpr={[1,2]}`, no post-processing.
- `src/experience/Environment.jsx` — the architectural shell: a floor (14×32), back wall, two side walls, and 8 structural columns (4 per side) establishing an enclosed hall with perspective depth. A flat hemisphere + ambient light is used purely as a **visibility aid** for reviewing scale and composition — it is explicitly not the Phase 1B lighting design (no directional light, shadows, or atmosphere).
- `src/hooks/useViewportHeight.js` — pins `--app-height` to `window.innerHeight` at mount, and only re-reads it when `window.innerWidth` changes (real resize/orientation change) rather than on every height fluctuation, so mobile Safari/Chrome address-bar collapse/expand during scroll won't trigger a canvas/camera resize. `global.css` uses `100dvh` with this cached value as a fallback, per `technical-architecture.md` §16.
- No scroll system, camera choreography, portfolio content, audio, or post-processing has been added — out of scope for this phase.

**Placeholder note:** material tones are a neutral mid-grey "blockout" palette (e.g. `#4a4a4a` floor, `#5c5c5c` back wall), not the near-black palette from `creative-reference.md` §5. This is intentional — legible scale/composition review now, with the final dark tonal values and physically-motivated light introduced in Phase 1B. This palette must not be treated as a final material decision.

### Known issues

| Issue | Severity | Notes |
|---|---|---|
| Production bundle exceeds Vite's 500kB chunk-size warning (~960kB / ~265kB gzip) | Low | Expected at this stage (three.js baseline cost); no code-splitting attempted yet. Revisit under Phase 5 performance work, not before. |
| `npm audit` reports a moderate `esbuild`/Vite dev-server advisory (GHSA-67mh-4wv8-2f99) | Low | Dev-server-only (local requests to the Vite dev server), does not affect production builds. A fix requires a breaking Vite major upgrade (v5 → v8) — deferred rather than forced in this phase. |
| No ceiling geometry | None (by design) | Not required by `build-workflow.md` §7's Phase 1A scope; the open volume above reads as intentional negative space. Revisit only if a later phase's composition needs it. |

### Required next step
Phase 1A is technically complete. Awaiting human visual review and explicit approval before Phase 1B begins.

Do not begin Phase 1B until Phase 1A is explicitly approved.

---

## 5. Approved Visual Decisions

This section records visual decisions that have already received human approval and therefore should be treated as protected foundations.

### Approved
*None yet.*

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
**Current commit (Phase 1A, technically complete):** `eea4e73` — "Phase 1A: scaffold project and implement environment shell"
**Current approved checkpoint:** *To be recorded once Phase 1A receives explicit human approval*

The repository was initialized (`git init -b main`) with the five governing documents relocated into `docs/` as the first commit, giving a clean recovery point before any implementation began. The Phase 1A scaffold and environment shell were committed on top of that baseline.

### Checkpoint rules

Before significant implementation: confirm the current Git state, identify the current commit, ensure the previous approved state is recoverable, make the implementation changes, test the changes, and record the relevant checkpoint when the phase reaches technical completion or approval.

Do not overwrite or discard an approved state without a recoverable Git history.

---

## 9. Testing State

### Current phase testing

**Phase:** 1A
**Functional testing:** COMPLETE — `npm run build` succeeds (Vite production build, 56 modules, no errors); dev server starts cleanly with no console errors or warnings from the application (one unrelated Canvas2D debug-tooling warning from a manual pixel-readback check, not from the app itself).
**Visual testing:** COMPLETE (via the in-app Chromium browser pane) — architectural hall, floor, back wall, side walls, and 8 columns render with credible perspective, spatial depth, and negative space above the hall; composition matches the review criteria in §4.
**Chrome testing:** COMPLETE — verified in the Chromium-based browser pane (desktop viewport).
**Safari testing:** NOT YET COMPLETE — no macOS/iOS Safari available in this environment; must be tested before this phase can be considered fully verified per `build-workflow.md` §9's Safari requirement. Flagging as a gap rather than silently skipping.
**Mobile testing:** PARTIAL — verified via emulated 375×812 mobile viewport: canvas resizes correctly, no context loss, no console errors, scene continues rendering (composition itself is the unmodified desktop framing — mobile-specific recomposition is explicitly Phase 1C/Phase 4 scope, not 1A). Real-device touch/scroll and address-bar show/hide behavior not testable in this environment.
**120Hz testing:** NOT YET COMPLETE — no scroll or per-frame animation exists yet in Phase 1A (static camera only), so there is nothing frame-rate-dependent to test. Relevant starting in Phase 1C.

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
**Git checkpoint:** `main` branch; baseline docs commit `960243b`, Phase 1A commit `eea4e73`.
**Next approved phase:** Pending human approval of Phase 1A before Phase 1B (Atmosphere & Light) may begin.

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
