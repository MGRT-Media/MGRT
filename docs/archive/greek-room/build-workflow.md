# MGRT Media — Build Workflow

---

## 1. Purpose

This document defines **how MGRT Media is built, reviewed, tested, and progressed through development**.

It is the operational workflow for Claude Code and any developer working on the project.

The workflow exists to prevent:

- Building beyond the currently approved phase
- Making large uncontrolled changes
- Solving visual problems with unnecessary technical complexity
- Introducing changes that contradict the creative direction
- Declaring a phase complete without human review
- Optimizing before the visual foundation is correct
- Breaking previously approved work while implementing new features
- Treating desktop as the only target
- Allowing Safari or high-refresh display issues to remain untested
- Accumulating undocumented changes

The project must be built **incrementally, deliberately, and through explicit review gates**.

---

## 2. Governing Documents

The project has five governing documents:

| Document | Responsibility |
|---|---|
| `creative-reference.md` | **WHY** — creative vision, visual language, narrative meaning, aesthetic direction |
| `experience-design.md` | **WHAT** — exact cinematic visitor experience and sequence |
| `technical-architecture.md` | **HOW** — technical implementation and architecture |
| `build-workflow.md` | **HOW WE BUILD** — implementation process, review gates, testing, and development discipline |
| `build-status.md` | **WHERE WE ARE** — current implementation status, approved phase, known issues, and next steps |

### Required reading order

Before making implementation changes, Claude must read:

1. `build-status.md`
2. `creative-reference.md`
3. `experience-design.md`
4. `technical-architecture.md`
5. `build-workflow.md`

The purpose of reading `build-status.md` first is to determine **the Current Phase and the Current Approved Scope** — see `build-status.md`'s Phase Terminology section for precise definitions. On a new project, the Current Phase may not yet have received approval; it is still the authorized starting scope.

Claude must not begin coding until the Current Phase and its Current Approved Scope are understood.

If this is the first session on a new project or the workflow has changed, Claude must read the complete `build-workflow.md`; otherwise, the relevant sections must still be consulted before implementation.

---

## 3. Core Development Principle

The website is not built as one large implementation pass. It is built as a sequence of **small, reviewable cinematic phases**.

Each phase should:

1. Have a clearly defined objective
2. Make only the changes required for that objective
3. Be tested before review
4. Be visually inspected
5. Be compared against the governing documents
6. Be presented for human approval
7. Be recorded in `build-status.md`

### Critical rule

> **Do not build ahead of the approved phase.**

If Phase 1A is approved, work on Phase 1B must not begin until Phase 1A has been reviewed and explicitly approved.

Claude may identify future requirements, but must not implement them early unless explicitly instructed.

---

## 3A. Scope Discipline & Out-of-Scope Issues

During implementation, Claude may discover problems that are real but outside the currently approved phase.

These issues must be identified, documented, reported, and assigned to the appropriate future phase.

They must not be implemented early unless the change is necessary to complete the currently approved phase or the human explicitly authorizes the scope expansion.

### Example

If Phase 1C reveals that Safari has a rendering issue that requires a broader performance optimization pass, Claude should document the issue rather than expanding Phase 1C into the full Phase 5 optimization process.

However, if the Safari issue prevents Phase 1C itself from functioning correctly, the minimum fix required to make Phase 1C valid should be implemented.

> **Fix what is necessary for the current phase. Document what belongs to a later phase. Do not silently expand scope.**

---

## 4. Implementation Philosophy

The implementation should follow this order:

```text
DOCUMENTATION → PROJECT INSPECTION → GIT CHECKPOINT → CURRENT PHASE
→ IMPLEMENT → TEST → VISUAL VERIFICATION → HUMAN REVIEW → APPROVAL
→ UPDATE BUILD STATUS → NEXT PHASE
```

The workflow intentionally separates **building** from **approving**.

Claude is responsible for implementation, testing, reporting, and identifying problems. The human is responsible for final creative approval. Claude must never declare that a phase is creatively approved.

---

## 5. Before Every Implementation Session

Before modifying code, Claude must complete the following.

### 5.1 Read project status

Read `docs/build-status.md`. Determine current phase, current approved scope, completed work, known issues, outstanding tasks, any blocked work, and any previously approved visual decisions.

### 5.2 Read relevant governing documentation

Review the sections of `docs/creative-reference.md`, `docs/experience-design.md`, `docs/technical-architecture.md`, and `docs/build-workflow.md` that relate to the requested change.

### 5.3 Inspect the existing implementation

Before editing, inspect the relevant components, scene structure, animation/timeline code, styles, assets, existing responsive logic, relevant dependencies, and existing browser/performance handling.

Do not rewrite working systems simply because another implementation would be possible.

### 5.4 Establish a Git checkpoint

Before significant implementation work, ensure the repository has a clean or intentionally understood Git state and a recoverable checkpoint. Identify the current commit before beginning major changes. Do not begin a major phase without knowing how to return to the previous approved state.

---

## 6. Phase-Based Development

The cinematic experience should be developed in individually reviewable phases. The initial sequence is:

```text
PHASE 1
├── 1A — Environment Shell
├── 1B — Atmosphere & Light
├── 1C — Camera & Scroll
├── 1D — Digital / Monitor Transition Foundation
└── 1E — Billboard Reveal Foundation (removed 2026-09-15)

PHASE 2
├── Film
├── Digital
└── Campaigns (removed 2026-09-15)

PHASE 3
├── Final MGRT Identity (the hero — now the end of the journey)
└── Explore transition

PHASE 4
├── Portfolio media
├── Audio
├── Responsive composition
└── Interaction refinement

PHASE 5
├── Performance
├── Safari
├── Accessibility
├── Reduced motion
└── Final polish
```

The exact phase boundaries may be refined in `build-status.md`, but the principle remains:

> **Build the cinematic foundation before adding content complexity.**

### Explore transition scope note

The Explore transition listed under Phase 3 is an application-level UI-mode handoff (unpinning scroll, unlocking HTML overlay interactions) — not an extension of the normalized 0.0–1.0 cinematic scroll timeline. See `technical-architecture.md` §5 ("Scope of the normalized timeline") for the technical detail.

### Phase 1 vs. Phase 2 distinction

Phase 1 establishes and proves the **technical and cinematic foundation** of the experience using simplified or provisional content where appropriate.

Phase 1D specifically establishes the **monitor, screen, and Film → Digital transition mechanism as a working foundation**. It is not the final Digital act.

> **Status (2026-09-15):** the Campaigns act, the billboard reveal, the Return and the closing frame were removed from the experience and the codebase. The cinematic journey now ends at the MGRT hero. The Phase 1E and Campaigns notes below are kept as history only.

Phase 1E specifically established the **billboard reveal and dive-back-in mechanism as a working foundation** — the render-to-texture technique, the camera's continuous pull-back and return through the billboard surface, and the boundary crossing between interior and exterior environments — using placeholder or provisional content for the exterior environment. It is not the final Campaigns act, and it does not require final Film or Digital content to be present.

Phase 2 then builds the **final Film, Digital, and Campaigns acts** on top of that proven foundation, replacing provisional elements with the intended final objects, compositions, media, typography, and cinematic treatment.

This prevents the Film → Digital transition, and the billboard reveal, from being designed and implemented for the first time only after the full acts have already been built. The billboard reveal in particular is the single highest-risk mechanism in the project — see `technical-architecture.md` §6 — and should not be attempted for the first time under the pressure of finishing final Campaigns content.

> **Phase 1 proves the cinematic mechanisms. Phase 2 builds the final cinematic content and acts on those mechanisms.**

---

## 7. Phase 1A — Environment Shell

### Objective
Establish the persistent physical environment: architectural shell, floor, walls, structural elements, basic spatial scale, camera starting position, scene composition, and the persistent Three.js environment.

### Do not add yet
Portfolio content, billboard reveal mechanics, complex atmospheric effects, audio, advanced post-processing, complex transitions, final typography systems, or secondary decorative objects.

### Review gate
The environment must establish the intended physical world before proceeding. Review for scale, composition, spatial depth, material direction, camera placement, negative space, and architectural credibility.

---

## 8. Phase 1B — Atmosphere & Light

### Objective
Establish the opening visual language: primary directional light, architectural shadows, initial atmospheric depth, volumetric light where appropriate, dust within illuminated areas, opening darkness, and the light reveal.

The light must feel physically motivated.

### Critical requirement
The environment must not feel like a generic dark Three.js scene. It should communicate:

```text
DARKNESS → LIGHT → DISCOVERY
```

### Review gate
Before continuing, visually verify light direction, contrast, architectural readability, dust subtlety, volumetric quality, atmospheric depth, and overall cinematic tone.

---

## 9. Phase 1C — Camera & Scroll

### Objective
Establish the cinematic camera system and scroll-controlled timeline: continuous camera movement, scroll-to-progress mapping, reversible progression, camera smoothing, camera orientation, timeline state, and the initial Film approach.

### Implementation requirement

Camera and timeline interpolation must be bound directly to object/camera references (for example, `ref.current.position`) or driven inside a `useFrame` loop, per the React/GSAP directive in `technical-architecture.md` §7. Do not dispatch React `useState` updates from scroll animation frames — this is the phase where that mistake would first be introduced, and it must not be baked into the camera system's foundation.

### Critical testing
Test slow scrolling, fast scrolling, trackpad momentum, reverse scrolling, rapid direction changes, sudden stops, mouse wheel, touch scrolling where applicable, 60Hz display, 120Hz display, and mobile address-bar show/hide during active scrolling — verify the canvas does not resize and the camera does not recalculate or snap mid-scroll (see `technical-architecture.md` §16 on viewport units).

### Safari requirement
Safari must be tested during this phase. Do not wait until final polish to discover that the camera system behaves differently in Safari.

### Review gate
The camera should feel **smooth → physical → responsive → deliberate**, not **sticky → delayed → mechanical → jittery**.

---

## 10. Phase 1D — Digital / Monitor Transition Foundation

### Objective
Establish and prove the **technical and cinematic foundation of the Film → Digital transition**: monitor geometry, monitor placement, screen surface, provisional screen content treatment, camera transition, spatial relationship between camera and monitor, continuous lighting relationship, and timeline-driven transition behavior.

The monitor and screen content used here may be **simplified or provisional**. The objective is to prove that the transition mechanism, spatial relationship, and lighting continuity work correctly before final Digital content is introduced.

### Important scope clarification

**Phase 1D does not constitute the final Digital act.** It establishes the underlying transition and monitor system that Phase 2 will build upon.

Phase 2 will refine this foundation with the final Digital composition, selected digital work, typography, materials, screen treatment, and cinematic choreography defined in `experience-design.md`.

Likewise, Phase 1C's Film approach is a camera-system foundation; Phase 2 will build the final Film act and integrate the final cinema-camera object and selected Film work.

### Critical requirement
The transition must feel like:

```text
CAMERA → LENS / FILM → VIEWPOINT EXPANDS → MONITOR EDGE → MONITOR REVEAL
```

It must not feel like:

```text
FILM SECTION → LIGHTING RESET → DIGITAL SECTION
```

### Mandatory verification
Specifically inspect for brightness snap, exposure snap, fog snap, volumetric snap, camera jump, monitor pop-in, scene reset, animation discontinuity, screen-content pop-in, and timeline desynchronization.

If any of these occur, the phase is not ready for approval.

---

## 10A. Phase 1E — Billboard Reveal Foundation (removed)

> **Removed 2026-09-15.** Kept for history; nothing in this section applies to the current build.

### Objective
Establish and prove the **technical and cinematic foundation of the Campaigns billboard reveal and its Act 4 reverse (dive-back-in)**: the render-to-texture technique, a continuous camera pull-back from the interior room into a provisional exterior environment, the boundary crossing at the billboard surface, and the reverse camera movement back into the same interior scene graph.

The exterior environment and any surrounding context used here may be **simplified or provisional**. The objective is to prove that the render-target technique, the camera's continuous movement through the boundary, and the reverse re-entry all work correctly — not to build the final exterior environment or its final composition.

### Important scope clarification

**Phase 1E does not constitute the final Campaigns act.** It establishes the underlying render-to-texture mechanism and camera boundary crossing that Phase 2 will build the final Campaigns act upon.

Phase 1E does not require final Film or Digital content, final typography, or final exterior-environment art direction to be present. A placeholder interior (from Phase 1A–1D) and a placeholder exterior are sufficient to prove the mechanism.

Phase 2 will refine this foundation with the final exterior environment composition, materials, and lighting defined in `creative-reference.md` and `experience-design.md`.

### Critical requirement
The reveal and return must feel like:

```text
MONITOR (CLOSE) → CONTINUOUS PULL-BACK → BILLBOARD SURFACE REVEALED → EXTERIOR CONTEXT
→ CAMERA REVERSES → THROUGH THE SURFACE → SAME INTERIOR SCENE, CONTINUING LIVE
```

It must not feel like:

```text
DIGITAL SCENE → CUT / FREEZE → STATIC IMAGE ON A BILLBOARD → NEW EXTERIOR SCENE
```

### Mandatory verification
Specifically inspect for: the interior render freezing, stuttering, or swapping to a static image at any point during the pull-back; any cut, fade, or load boundary at the billboard surface in either direction; desynchronization between the interior render-target camera and the primary camera; the interior scene being rebuilt or reinstantiated on return rather than being the same persistent scene graph; and any frame-rate cost from the double-render (interior + exterior) that degrades camera smoothness below the standard established in Phase 1C.

If any of these occur, the phase is not ready for approval.

---

## 11. Creative & Technical Discipline

Every implementation decision must be checked against both creative and technical requirements.

### Creative questions
Before adding an element, ask: does it serve the narrative? Does it belong in the physical world? Does it improve the composition? Does it support discovery? Does it communicate scale or meaning? Does it preserve restraint?

### Technical questions
Ask: what is the rendering cost? Does it affect mobile? Does it affect Safari? Does it introduce a new animation state? Does it interfere with the master timeline? Does it create a new source of visual instability? Is the complexity justified?

If an element fails both tests, do not add it.

---

## 12. Testing Requirements

Every implementation phase must be tested before human review.

### Functional testing
Verify the application starts correctly, no runtime errors, no broken imports, no missing assets, no broken routes, no failed media, no unexpected warnings, and the build completes successfully.

### Cinematic testing
Verify camera progression, reverse scrolling, timeline continuity, object reveals, object disappearance, lighting continuity, typography placement, media behavior, and transitions.

### Browser testing
At minimum, test relevant current versions of Chrome and Safari. Where practical, also test Firefox and Edge.

### Device testing
Test across desktop, laptop, and mobile, with particular attention to macOS Safari, high-refresh displays, iPhone-class mobile devices, and lower-powered mobile devices.

Mobile testing must specifically include address-bar show/hide behavior during active scrolling — the canvas must not resize and the camera must not recalculate mid-scroll (see `technical-architecture.md` §16).

---

## 13. Visual Verification

Technical correctness is not sufficient. The implementation must be visually inspected.

### Verify
Composition, camera framing, object scale, lighting, shadows, materials, atmosphere, typography, transitions, spacing, responsive composition, and overall cinematic feeling.

A page can pass every console and build test while still failing the creative brief.

### Reference comparison
Use the governing creative documents as the primary reference. The Musée reference is a **quality benchmark**, not a template.

The question is not: *"Does this look exactly like Musée?"*
The question is: *"Does this achieve the intended level of spatial sophistication, cinematic polish, physicality, and restraint while remaining distinctly MGRT?"*

---

## 14. Debugging & Problem Solving

When a visual or technical problem occurs, identify the underlying cause before changing multiple systems.

### Do not
Randomly adjust unrelated values, add additional animation systems to hide a problem, add CSS hacks without understanding the cause, replace working architecture unnecessarily, change multiple major systems simultaneously, optimize blindly, or declare a problem fixed without testing the original failure case.

### Debugging process

```text
REPRODUCE → ISOLATE → IDENTIFY ROOT CAUSE → MAKE MINIMAL CHANGE → RETEST → CHECK FOR REGRESSION
```

### Safari-specific issues

When a Safari problem is found:

1. Reproduce it in Safari
2. Determine whether it is browser-specific
3. Identify the actual rendering/animation/layout cause
4. Apply the smallest appropriate fix
5. Retest Safari
6. Retest Chrome
7. Verify that the fix does not degrade other devices

Do not introduce Safari-specific code merely because Safari is different.

---

## 15. Performance Workflow

Performance optimization should occur continuously, but **major optimization passes should happen after the visual architecture is correct**.

### Priority order

```text
1. Smooth camera movement    5. Major object quality
2. Stable scroll response    6. Materials
3. Lighting continuity       7. Atmosphere
4. Stable rendering          8. Secondary effects
```

When performance becomes constrained, reduce lower-priority complexity first. Potential reductions include particle count, volumetric quality, texture resolution, shadow resolution, reflection quality, geometry detail, post-processing, and secondary objects.

Do not immediately sacrifice the primary cinematic experience.

### Performance must be tested during
Initial load, camera movement, the Film sequence, the Film → Digital transition, the traversal to the MGRT hero and resting there, reverse scrolling, mobile scrolling, and resize events.

---

## 16. Assets & Content Workflow

Assets should be introduced only when the relevant cinematic phase is ready.

### Before importing an asset
Verify it is required by the experience, has an identified role, is appropriate for the intended camera distance, has justified resolution, uses an appropriate format, has a reasonable file size, and has an intended mobile strategy.

### Portfolio content
Portfolio assets should remain curated. Do not add content simply because more examples are available. The target ranges defined in `experience-design.md` remain the content planning reference:

- Film: approximately 2–4 pieces
- Digital: approximately 2–4 projects

Asset quality and relevance are more important than quantity.

### Provisional vs. final assets

During early foundation phases, temporary or simplified assets may be used when necessary to prove camera movement, spatial relationships, lighting continuity, timeline behavior, transition mechanics, or performance characteristics.

These assets must not automatically be treated as final creative assets. When the relevant full-fidelity phase begins, provisional assets should be replaced or refined according to `creative-reference.md` and `experience-design.md`.

---

## 17. Change Boundaries, Approval & Completion

### One phase at a time
Claude should work only on the currently approved phase unless explicitly instructed otherwise. If implementation reveals a dependency on a later phase, stop and report it rather than silently expanding scope.

### Preserve approved work

Previously approved phases are considered protected foundations. Changes to previously approved systems should only be made when required to support the current phase, fix a regression, or address a confirmed technical issue. When such changes are necessary, Claude must identify the affected approved system and verify that its previously approved behavior has not regressed.

A new phase is not permission to rewrite old phases.

### When a phase is complete
A phase may be presented for review only after: implementation is complete for the defined scope, the build passes, console/runtime errors are checked, relevant browser testing is complete, relevant desktop/mobile testing is complete, scroll behavior is tested, reverse scrolling is tested where applicable, visual verification is complete, and known issues are documented.

### Human approval

Claude must present:

1. What was implemented
2. What was tested
3. What remains known
4. What the human should specifically review
5. Any recommended next step

Then stop. **Do not automatically continue into the next phase.**

### Approval language

Claude must distinguish between **technically complete** and **creatively approved**.

A phase can be technically complete while still requiring human review. Only explicit human approval moves the project to the next phase.

### Build-status update

After approval, update `docs/build-status.md`. Record: phase completed, approval status, major implementation changes, testing performed, known issues, and next approved phase.

### Final rule

> **Never trade cinematic integrity for implementation convenience.**

If the easiest technical solution produces a worse cinematic experience, find a better technical solution or raise the issue for review.

The goal is not simply to make the website function. The goal is to make the intended MGRT experience function **smoothly, continuously, responsively, and convincingly across devices and browsers.**
