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
**Phase Status:** IN PROGRESS
**Approval Status:** NOT YET GRANTED
**Current Objective:** Establish the persistent Three.js physical environment before introducing cinematic lighting, atmosphere, camera choreography, or final portfolio content.

### Current approval state

```text
PHASE 1A — Environment Shell
STATUS: IN PROGRESS
APPROVAL: NOT YET GRANTED
```

Claude must work only within the current authorized scope unless explicitly instructed otherwise.

---

## 3. Phase Progress

```text
PHASE 1
├── 1A — Environment Shell              IN PROGRESS
├── 1B — Atmosphere & Light             NOT STARTED
├── 1C — Camera & Scroll                NOT STARTED
├── 1D — Digital / Monitor Foundation   NOT STARTED
└── 1E — Billboard Reveal Foundation    NOT STARTED

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

**Status:** IN PROGRESS
**Approval:** NOT YET GRANTED

### Objective
Establish the persistent physical environment: Three.js scene, architectural shell, floor, walls, structural elements, basic spatial scale, initial camera position, scene composition, and persistent environment structure.

### In scope
Only the systems necessary to establish the physical environment and its spatial foundation.

### Out of scope
Final portfolio content, final Digital content, complex atmospheric effects, audio, advanced post-processing, complex cinematic transitions, final typography systems, secondary decorative objects, full camera choreography, Film → Digital transition mechanics, and billboard reveal / dive-back-in mechanics.

### Review criteria

Before Phase 1A can be approved, verify: the physical environment feels intentional, architectural scale is credible, spatial depth is established, camera starting position is appropriate, composition provides sufficient negative space, the environment supports the intended cinematic experience, scene structure is suitable for later phases, and no unnecessary complexity has been introduced.

### Current implementation notes
*No implementation notes yet.*

### Known issues
*None currently recorded.*

### Required next step
Complete Phase 1A implementation, test the application, visually inspect the environment, and present the result for human review.

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
| None currently recorded | — | — | — | — |

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

### Current recovery state

**Current recovery checkpoint:** *To be recorded*
**Current approved checkpoint:** *None yet*
**Current working branch:** *To be recorded*
**Current commit:** *To be recorded*

> The current recovery checkpoint identifies the Git state from which the current implementation can be recovered. The approved checkpoint identifies the most recent human-approved state.

For a new project, there may be no approved checkpoint yet. However, **a current recovery checkpoint must be populated with a real branch name and commit SHA as soon as the repository is initialized, before any Phase 1A implementation work begins.** An unfilled recovery checkpoint means the Git safety net required by `build-workflow.md` §5.4 is not yet active.

> **Example (illustrative only, not actual project state):**
> Before Phase 1A is approved — `Current recovery checkpoint: 8f31c2a` · `Current approved checkpoint: None yet` · `Current working branch: main` · `Current commit: 8f31c2a`
> After Phase 1A is approved — `Current recovery checkpoint: b72d91e` · `Current approved checkpoint: b72d91e` · `Current working branch: main` · `Current commit: b72d91e`

### Checkpoint rules

Before significant implementation: confirm the current Git state, identify the current commit, and update the current recovery checkpoint so the previous state remains recoverable. Make the implementation changes, test the changes, and update the current approved checkpoint only once the phase receives explicit human approval.

Do not overwrite or discard an approved state without a recoverable Git history.

---

## 9. Testing State

### Current phase testing

**Phase:** 1A
**Functional testing:** NOT YET COMPLETE
**Visual testing:** NOT YET COMPLETE
**Chrome testing:** NOT YET COMPLETE
**Safari testing:** NOT YET COMPLETE
**Mobile testing:** NOT YET COMPLETE
**120Hz testing:** NOT YET COMPLETE

Testing status should be updated as the phase progresses.

### Required testing before phase approval

A phase must not be marked technically complete until the relevant build checks, runtime checks, console checks, browser checks, device checks, scroll checks, visual checks, and regression checks have been completed.

---

## 10. Phase Completion Record

Each completed phase should receive a concise record.

### Phase 1A

**Implementation:** Pending
**Technical completion:** Pending
**Human approval:** Pending
**Major changes:** None recorded
**Testing performed:** None recorded
**Known issues:** None recorded
**Approved visual decisions:** None recorded
**Git checkpoint:** Pending
**Next approved phase:** Pending human approval

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

### 2026-09-01

**Narrative update: Campaigns reimagined as a structural billboard reveal.**

- Act 3 (Campaigns) redefined: the camera pulls back from the monitor to reveal that the entire preceding world was displayed on a physical billboard, seen from an exterior environment, rather than presenting curated campaign examples.
- Act 4 (Return) redefined: the camera dives back through the billboard surface into the same interior scene, rather than a separate withdrawal from campaign displays.
- Removed the Campaigns portfolio content range (previously 3–5 examples) from `creative-reference.md`, `experience-design.md`, and `build-workflow.md` — Campaigns no longer has curated content of its own.
- Added a render-to-texture technical requirement to `technical-architecture.md` (§5–6) for the billboard reveal and dive-back-in.
- Added **Phase 1E — Billboard Reveal Foundation** to `build-workflow.md` and this document's Phase Progress tracker, to prove the render-to-texture and boundary-crossing mechanism before final Campaigns content is built in Phase 2.
- No effect on Phase 1A–1D scope or on any approved work — nothing had been approved prior to this change.

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
