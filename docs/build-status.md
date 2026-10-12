# MGRT Creative Table — Build Status

The current state of the redesign. Read this first, every session. Keep it short: Git history is the change log.

---

## 1. Current state

| | |
|---|---|
| **Project** | MGRT Creative Table, replacing the Greek-room homepage |
| **Branch** | `redesign/creative-table` |
| **Branched from** | `main` at `112f5a3` (2026-10-12) |
| **Current phase** | 0 — Documentation |
| **Phase status** | TECHNICALLY COMPLETE, awaiting review |
| **Approved scope** | Phase 0 only. No source, asset or dependency changes. |
| **Next phase** | 1 — Foundations. Not approved to start. |

`main` is production (mgrtmedia.com) and is unchanged.

---

## 2. Phase progress

```text
0  Documentation                        TECHNICALLY COMPLETE
1  Foundations                          NOT STARTED
2  Blockout and framing                 NOT STARTED
3  Visual development (light+material)  NOT STARTED
4  Table population                     NOT STARTED
5  Interaction                          NOT STARTED
6  Loading and startup                  NOT STARTED
7  Performance, Safari, accessibility   NOT STARTED
8  Cutover and cleanup                  NOT STARTED
```

Phase definitions and review gates are in `build-workflow.md` §3.

Status values: NOT STARTED, IN PROGRESS, TECHNICALLY COMPLETE (built and tested, not yet reviewed), APPROVED, BLOCKED, DEFERRED.

---

## 3. Approved decisions

Approved 2026-10-12, at the audit review. These are protected; raise any conflict before changing one.

**Creative**

- Warm cinematic production environment; art-directed and photographed, not procedurally assembled.
- Table layout: Film left, MGRT centre (architectural project sheet, creative sketches, subtle identity card), Digital right. Naturally composed, not symmetrical.
- Physical MGRT MEDIA lettering on the wall behind the table.

**Lettering**

- Custom GLB derived from the exact existing wordmark. Original typography and proportions. No substitute font.
- Shallow extrusion, subtle bevel, brushed dark metal or aged bronze.

**Materials**

- Scanned PBR textures for plaster and walnut tabletop. Believable roughness, normal detail, real scale and variation over exaggerated displacement.
- Existing texture-loading optimisations retained; assets compressed and sized appropriately.

**Sequence**

- Six stages: 0 dim, 1 lettering lit, 2 table revealed, 3 Film, 4 Digital, 5 return to overview.
- Direct navigation between Film, Digital and Overview without replaying the opening (built in phase 5).

**Camera**

- Existing damped rig kept where appropriate.
- No complex paths until room proportions and framing are validated.
- Opening frame shows the wall identity with the table in the foreground. The second reveal moves naturally into an elevated three-quarter view of the whole table.
- Movement restrained, physically motivated, relatively quick.

**Architecture**

- Camera poses, lighting states and transitions configured through central layout and beat definitions.
- Video and project presentation systems preserved, not integrated until the collections are populated.
- Lighting and materials developed as one phase. Dedicated table-population and interaction phases.

---

## 4. Open decisions

These need an answer before the phase shown.

| # | Decision | Needed by |
|---|---|---|
| 1 | **Wordmark source.** No vector file of the wordmark exists in the repository. See §5. | Phase 3 (a placeholder is enough for phase 2) |
| 2 | **Lettering arrangement.** The current wall version stacks MGRT over MEDIA; the site mark is one line, "MGRT Media". Which goes on the wall? | Phase 2 |
| 3 | **Texture sources.** Which scanned plaster and walnut sets, and who supplies them. Downloading third-party files needs approval per file. | Phase 3 |
| 4 | **How the two scenes coexist.** Proposed: both in the build, selected by one switch in `Home`, old scene the default until cutover. | Phase 1 |
| 5 | **Old timeline behaviours.** Proposed: the automatic intro, the scroll locks and the automatic final beat are not carried into the new sequence. | Phase 1 |
| 6 | **Lettering finish.** Brushed dark metal or aged bronze. Best decided on screen under the real spotlight. | Phase 3 |
| 7 | **Table contents.** Source material for the project sheet, sketches, identity card and both collections. | Phase 4 |

---

## 5. Flag: the wordmark has no source file

The approved direction is a GLB derived from the exact existing wordmark. The audit found:

- There is no SVG, AI, EPS or font file for the wordmark anywhere in the repository or `asset-sources/`.
- The wall wordmark is drawn at runtime as text: **Cormorant, weight 500**, two lines, `MGRT` with 0.22 em tracking and `MEDIA` with 0.36 em tracking (`src/experience/architecture/wallInscription.js`).
- Cormorant is loaded from Google Fonts. No font file is stored locally.

So "the exact wordmark" currently means Cormorant Medium with those tracking and line proportions. Two ways forward:

1. **You supply the brand's vector wordmark** (SVG or AI). This is the reliable route if a designed logo exists outside the codebase.
2. **Derive the outlines from Cormorant Medium** using the existing tracking and proportions. Cormorant is licensed under the SIL Open Font License, which permits this. It reproduces what the site shows today.

Either way the GLB has to be authored in a modelling tool (extrusion and bevel), or generated by a one-off script using `--no-save` pipeline packages. Neither adds an app dependency.

---

## 6. Known issues

| Issue | Severity | Action | Target |
|---|---|---|---|
| Safari cuts the reveal crossfade short, reading as a slight pop | Low | Likely fix: Web Animations API for the fade | Phase 7 |
| No testing on a real iPhone or iPad; mobile figures are Chrome emulation | Medium | Test on devices | Phase 7 |
| `npm audit` moderate advisory in esbuild / Vite dev server (GHSA-67mh-4wv8-2f99) | Low | Needs a Vite major upgrade; dev server only | Deferred |
| `@react-three/drei` is installed but unused | Low | Remove | Phase 8 |
| `/favicon.ico` returns 404 | Low | Add a favicon | Phase 8 |
| 22 source comments cite the archived docs by their old path | Low | Comments only; resolved when Greek-room code is removed | Phase 8 |
| Startup cover images show the Greek room | Expected | Re-capture from the new scene | Phase 6 |

---

## 7. Active constraints

- `main` is not modified.
- No Greek-room source or asset is deleted before phase 8.
- No new dependencies without a stated reason.
- The existing site keeps working on this branch until the replacement is approved.
- Scroll progress never drives React state. Lights and materials read progress through `contentValue()`.
- The measured rules in `technical-architecture.md` §7 to §10 hold unless a new measurement replaces them.

---

## 8. Phase record

### Phase 0 — Documentation (2026-10-12)

**Changed**

- Moved the five Greek-room documents to `docs/archive/greek-room/` with `git mv`, and added a README there.
- Added a project `CLAUDE.md`.
- Added `docs/creative-table-spec.md`.
- Rewrote `docs/technical-architecture.md` for the new scene, carrying over the measured findings.
- Reset `docs/build-status.md` and `docs/build-workflow.md`.

**Not changed**

Source code, assets, dependencies, `main`.

**Testing**

`npm run build` succeeds (149 modules). No file that affects the build was touched.
