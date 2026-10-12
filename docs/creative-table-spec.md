# MGRT Creative Table — Creative & Experience Specification

This document is the single source of truth for **what the visitor sees**: the creative direction, the room, and the six-stage sequence. It replaces the archived `creative-reference.md` and `experience-design.md`.

How it is built is in `technical-architecture.md`. Where the build stands is in `build-status.md`.

Lines marked *Proposed* are suggestions written during Phase 0 that have not been approved. Everything else comes from the approved brief.

---

## 1. Vision

A high-end cinematic production environment: a warm creative studio at night, lit like a film set. The visitor arrives in a dim room, the MGRT MEDIA name is lit on the back wall, then the creative table is revealed, and the work is laid out on it as physical objects.

The scene must feel **art-directed and photographed, not procedurally assembled**. Every decision is judged against that sentence.

### It should feel like

- A film set dressed by a production designer
- Warm, directional, physically believable light with deep shadows
- Tactile materials with natural imperfections
- Restrained atmosphere: a little haze in the light, nothing theatrical

### It must not feel like

- A generic office, showroom or product configurator
- An evenly lit 3D render
- A symmetrical or grid-arranged display
- A tech demo: no effect exists because it is possible

---

## 2. The room

| Element | Direction |
|---|---|
| Walls | Warm textured plaster with subtle aging and imperfections. Scanned PBR. |
| Floor | Dark stone or concrete. Stays the darkest surface in the frame. |
| Table | Large, solid, dark walnut. The centre of the composition. Scanned PBR tabletop. |
| Lettering | Physical MGRT MEDIA letters mounted on the back wall, behind the table. |
| Light | Warm architectural spotlight on the lettering; a large soft directional source on the table; very low ambient. |
| Atmosphere | Light haze visible only inside the beams; fine dust; film grain. |

### Materials

- High-quality scanned PBR textures for the plaster and the walnut.
- Priority order: believable roughness, normal detail, real-world scale, natural variation. Exaggerated displacement is a failure, not a feature.
- Surfaces should show wear where hands and objects would cause it, not uniformly.

### Wall lettering

- A custom 3D model (GLB) derived from the **exact existing MGRT wordmark**. Typography and proportions are preserved. No substitute font.
- Shallow, realistic extrusion with a subtle bevel that catches the spotlight.
- Brushed dark metal or aged bronze; the choice is made on screen during visual development.
- *Proposed:* mounted slightly off the wall so it casts a soft contact shadow onto the plaster.
- Whether the wall carries the stacked form (MGRT over MEDIA) or one line is an open decision; see `build-status.md`.

### Lighting

- Light is motivated: every source could exist as a real fixture in the room.
- Contrast is cinematic. Shadows are allowed to go deep; nothing is filled flat.
- Colour temperature is warm throughout. No coloured accent lights.
- Lighting changes between stages are continuous, never a cut.

---

## 3. The table layout

Described from the overview camera (stage 2 and stage 5):

| Zone | Position | Contents |
|---|---|---|
| Film | Left | The Film collection: physical materials that represent film work. |
| MGRT | Centre | An architectural project sheet, creative sketches, and a subtle MGRT identity card. |
| Digital | Right | The Digital collection: physical materials that represent digital work. |

- The table must look **naturally composed**: overlapping sheets, slight rotations, uneven spacing, objects that look put down by a person. Not symmetrical, not aligned to a grid.
- The identity card is understated. The wall lettering is the brand statement; the card is a detail to be discovered.
- The collections are **not built during the environment phases**. They arrive in the table-population phase. Until then the zones exist only as positions in the layout definition.

---

## 4. The sequence

Six stages. Scroll moves between them one stage per gesture.

| # | Stage | Light | Camera |
|---|---|---|---|
| 0 | **Dim** | Room barely lit. Lettering faintly visible. Table in silhouette. | Wall identity framed with the table in the foreground. |
| 1 | **Lettering** | Warm architectural spotlight rises on MGRT MEDIA. | Subtle push toward the wall. |
| 2 | **Table** | Large soft directional light rises on the table. | Cranes up and tilts down to an elevated three-quarter view of the whole table. |
| 3 | **Film** | Table light holds; emphasis shifts left. | Moves in to explore the Film side. |
| 4 | **Digital** | Table light holds; emphasis shifts right. | Travels across to the Digital side. |
| 5 | **Overview** | Full table lit. | Returns to the complete table overview. |

### Rules for the sequence

- **Stage 0 framing is fixed in intent:** the wall identity is the subject and the table is foreground. It is also the frame the startup image shows.
- **Stage 1 to stage 2 is one natural move.** The crane-and-tilt should feel like a single operator decision, not two motions joined.
- **Stage 5 and stage 2 are the same view.** The sequence ends where the table was first revealed, now understood.
- Every stage is reversible. Scrolling back replays the lighting and camera in reverse.
- *Proposed, awaiting confirmation:* no intro animation plays on its own, and no scroll lock holds the visitor against their input. The previous site had both.

### Camera character

- Restrained, physically motivated, and relatively quick. A dolly, a crane, a pan. Nothing a real camera could not do.
- No roll, no fly-throughs, no passing through objects.
- Movement has weight: it eases out of rest and settles into the next frame.

### Direct navigation

Visitors must be able to move directly between **Film**, **Digital** and **Overview** without replaying the opening. Stages 0 to 2 are the opening and play once on arrival; after that the three destinations are peers.

---

## 5. Interface

- The persistent marks stay minimal: the MGRT wordmark, the section indicator, the global navigation, film grain.
- The section indicator's destinations become Film, Digital and Overview.
- The existing video presentation (fullscreen modal, captions) is **preserved but not part of the environment build**. It is adapted when the collections are populated.
- Typography remains Cormorant, as on the current site.

---

## 6. Responsive direction

- The same room, the same sequence and the same light on every device.
- What may change is framing: camera distance, elevation and field of view adapt so each stage's subject is fully in frame on a portrait phone.
- Mobile is composed, not scaled down. Each stage is checked on a portrait phone before it is called done.

---

## 7. Accessibility and reduced motion

- With reduced motion, stage changes are immediate or near-immediate; the lighting states and content are unchanged.
- The work, the about page and the contact page are always reachable without the 3D scene.
- A browser that cannot run the scene gets a clear message and working navigation, never a blank page.

---

## 8. Out of scope until later phases

- Table collections and their objects (table-population phase)
- Video playback, project presentation, captions (interaction phase)
- Audio

---

## 9. Definition of success

A visitor should believe, for a moment, that they are looking at footage of a real room. The lettering should look like metal that was fabricated and mounted. The table should look like someone was just working at it.
