# MGRT Creative Table — Build Workflow

How the redesign is built: the phases, the review gates and the testing each phase needs.

---

## 1. Governing documents

| Document | Answers |
|---|---|
| `build-status.md` | Where are we, and what is approved? |
| `creative-table-spec.md` | What does the visitor see? |
| `technical-architecture.md` | How is it built? |
| `build-workflow.md` | How do we work? |

Read `build-status.md` first, every session. Read the others as the task requires. `archive/greek-room/` is reference only.

---

## 2. Principles

1. **One approved phase at a time.** Do not build ahead. Note future requirements; do not implement them.
2. **Stop at the end of each phase.** Present the work and wait for explicit approval.
3. **Technically complete is not approved.** Only a human review moves the project forward.
4. **Fix what the current phase needs. Document what belongs to a later one.** Do not silently expand scope.
5. **Approved work is protected.** Change it only to support the current phase or fix a regression, and say so.
6. **Never trade cinematic integrity for implementation convenience.** If the easy solution looks worse, find a better one or raise it.

### Branch rules

- All work happens on `redesign/creative-table`. Confirm the branch before editing.
- `main` is production and is not modified until the cutover is approved.
- The Greek-room experience keeps working on this branch until cutover. Its source and assets are not deleted before then.
- Commit at the end of each phase so every approved state is recoverable.

---

## 3. Phases

| # | Phase | Objective | Review gate |
|---|---|---|---|
| 0 | **Documentation** | Archive the old docs; write the spec, architecture, status and workflow; add `CLAUDE.md`. | Docs reviewed; open decisions answered. |
| 1 | **Foundations** | Scene switch in `Home`; `studioLayout.js` and `beats.js`; six-stage scroll skeleton; empty studio scene mounting behind the switch. | Old scene unchanged by default; six stages step forward and back in the new one. |
| 2 | **Blockout and framing** | Untextured room, table and lettering placeholder at real scale; camera poses for all six stages; portrait framing. | Room proportions and every stage's framing approved, desktop and phone. |
| 3 | **Visual development** | Lighting and materials together: plaster, floor, walnut, lettering GLB and finish, the three light states, haze, shadows, depth of field. | The empty room reads as photographed at every stage. |
| 4 | **Table population** | Film, MGRT and Digital collections placed on the table as physical objects. | Table reads as naturally composed; each zone holds up in its close view. |
| 5 | **Interaction** | Direct navigation between Film, Digital and Overview; adapt the video and project presentation; captions and section indicator. | Every destination reachable without replaying the opening; presentation works. |
| 6 | **Loading and startup** | New critical and deferred asset lists; boot-quality variants; re-captured opening images. | Startup figures within the previous build's; handover has no visible step. |
| 7 | **Performance, Safari, accessibility** | Frame-time and memory pass; Safari macOS and iOS; reduced motion; keyboard; real devices. | Meets the targets in `technical-architecture.md`. |
| 8 | **Cutover and cleanup** | New scene becomes the default; Greek-room code and unused assets removed; merge to `main`. | Explicit approval to replace production. |

Phase 3 treats lighting and materials as one coordinated phase because each is tuned against the other.

Phases 2 and 3 are expected to take several review passes. That is the process working, not a failure.

---

## 4. Before each session

1. Read `build-status.md` and confirm the current phase and approved scope.
2. Confirm the branch is `redesign/creative-table` and note the current commit.
3. Inspect the code the task touches before changing it.

---

## 5. Testing before a phase is presented

**Always**

- `npm run build` succeeds.
- No console errors or failed requests in the running scene.
- The Greek-room scene still runs by default (until cutover).
- Scroll forward and back through every stage.

**When the phase changes what is on screen**

- Visual check at each stage, desktop and portrait phone.
- Resize and orientation change mid-sequence: the camera holds its place.
- Reduced motion.

**When the phase changes loading, assets or rendering cost**

- Startup timing on the Fast 4G and Slow 4G profiles defined in `technical-architecture.md` §8.
- Frame time during a scroll burst, compared with the recorded baseline.
- Texture changes verified with the protocol in §9 of that document.

**Browsers**

Chrome and Safari on macOS for every visual phase. Safari iOS and Chrome Android on real devices in phase 7 at the latest. State plainly what was not tested and why.

---

## 6. Presenting a phase

1. What was implemented
2. What was tested, and what was not
3. Known issues
4. What to look at specifically
5. Recommended next step

Then stop.

---

## 7. After approval

Update `build-status.md`: the phase's status, the approved decisions it produced, the commit, known issues, and the next approved scope. Keep that file short; it records the current state, not a narrative of every change. Git history is the change log.

---

## 8. Assets

- Originals go in `asset-sources/`; only optimised derivatives ship from `public/`.
- Record the source and licence of every third-party asset in `asset-sources/README.md`.
- Mark provisional assets as provisional. They do not become final by staying.
- Do not delete or replace an existing asset without checking where it is used.
