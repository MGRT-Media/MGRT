# MGRT Media — Experience Design & Cinematic Sequence

---

## 1. Purpose

This document defines the **exact visitor experience** for the MGRT Media website.

It translates the creative direction in `creative-reference.md` into a concrete cinematic sequence:

- What the visitor sees
- What the camera does
- What objects are revealed
- How the environment evolves
- When typography appears
- How portfolio content is introduced
- How each discipline transitions into the next
- How sound supports the experience
- What happens after the cinematic sequence
- How the experience is compositionally adapted for mobile
- How first and returning visits behave

This document is the **single source of truth for the act-by-act cinematic experience**.

- `creative-reference.md` defines **why** the experience should feel the way it does.
- `experience-design.md` defines **what** the visitor experiences.
- `technical-architecture.md` defines **how** the experience is technically built.

If there is a conflict between this document and a detailed sequence described elsewhere, **this document controls the cinematic experience**.

---

## 2. Experience Structure

The experience consists of:

### Act 0 — Initial Reveal
A short, non-scroll-driven opening that establishes the environment and reveals MGRT Media.

### Act 1 — Film
The camera and the captured image.

### Act 2 — Digital
The captured image becomes a digital experience.

### Act 3 — MGRT Hero (final frame)
The camera leaves the monitor, crosses the room and settles square-on to the MGRT MEDIA wordmark on the far wall. This is the end of the cinematic journey.

> **Removed (2026-09-15):** the former Campaigns act (the billboard pull-back onto a highway), the Return dive back through the billboard, and the closing frame after it have been removed from the experience and the codebase. The journey now ends at the hero.

### Post-Experience — Explore
The cinematic sequence transitions into the practical website experience.

### Overall sequence

```text
INITIAL LOAD
     ↓
DARKNESS
     ↓
LIGHT REVEAL
     ↓
MGRT MEDIA
     ↓
────────────── SCROLL ──────────────
     ↓
FILM
     ↓
DIGITAL
     ↓
MGRT MEDIA (HERO — FINAL FRAME)
     ↓
STILLNESS
```

The experience should feel like **one continuous camera journey**, not separate website sections.

---

## 3. Global Experience Rules

These rules apply throughout the entire sequence.

### One continuous world
The architecture, lighting, atmosphere, and spatial language should persist throughout the experience. Objects may enter, leave, move, or become obscured, but the underlying environment should remain coherent. The visitor should never feel that a new 3D scene has simply replaced the previous one.

### One continuous camera
The camera should feel like the same physical camera throughout the experience.

**Avoid:** hard camera resets, obvious teleportation, abrupt position changes, unmotivated rotations, or independent camera systems for each section.

Camera movement should feel intentional and physically motivated.

### Scroll controls time
Scrolling acts as the primary cinematic timeline. The visitor should feel as though their movement is **scrubbing through a film with physical depth**. Scroll should control progression rather than simply triggering independent animations.

Forward scrolling progresses the narrative. Reverse scrolling should naturally reverse the cinematic progression. The experience must not depend on one-time animations that break when the visitor scrolls backward.

### No scroll filler
The experience is intentionally short. Do not create additional scroll distance simply to make the website feel longer. Every major scroll movement must produce a meaningful visual change.

### Cinematic beats
Each act should contain a clear progression:

```text
ANTICIPATION
     ↓
APPROACH
     ↓
DISCOVERY
     ↓
PAYOFF
     ↓
BRIEF STILLNESS
     ↓
TRANSITION
```

Not every moment needs movement. Stillness creates contrast and makes important reveals feel cinematic.

---

## 4. Initial Load & Act 0 — Initial Reveal

### Loading philosophy

**The void is the loader.**

The visitor should enter the experience immediately rather than seeing a conventional loading interface.

**Avoid displaying:** loading bars, percentage counters, spinners, "Loading..." messages, or technical progress indicators.

The initial blackness should feel like an intentional part of the cinematic experience. Technical asset preparation may occur during this period, but the visitor should not see the underlying loading machinery.

*The technical implementation of asset readiness and progressive loading is defined in `technical-architecture.md`.*

### Purpose
Introduce MGRT Media and establish the physical world before the visitor begins scrolling. The visitor should immediately understand that this is **not a conventional website**.

### Starting state
The page begins almost completely dark. The architectural environment exists but is initially difficult to perceive. Only extremely subtle forms should be visible.

**Do not begin with:** a flat hero image, standard website hero, large centered website typography immediately visible, or a visible 3D scene waiting for the user.

The environment should first be **discovered**.

### Light reveal
A strong directional beam enters the environment. The beam progressively reveals:

- Architectural surfaces
- Floor
- Columns / structural elements
- Atmospheric depth
- Dust particles suspended within the light

The light should feel physically motivated, as though sunlight is entering an architectural space. Dust should become visible primarily where the light passes through the atmosphere.

### MGRT reveal
As the environment becomes visible, the MGRT identity gradually emerges. The reveal should feel like the light has **found MGRT**, rather than like text has simply faded onto the screen.

The final opening state should establish: **MGRT MEDIA**

The identity should remain visible long enough to register before the visitor begins the main scroll sequence.

### Transition into scroll
The opening light should remain physically present as the visitor begins scrolling.

There should be **no flash, exposure reset, scene reload, sudden camera movement, abrupt fog change, or abrupt change in light intensity**.

The initial light becomes the lighting foundation for the Film sequence.

---

## 5. Persistent Interface During the Cinematic Sequence

The cinematic environment should remain visually clean. During Acts 0–4, there should be **no conventional persistent website navigation**.

**Avoid:** header navigation bars, large logos fixed to the viewport, social media icons, conventional menus, floating UI panels, persistent text blocks, conventional agency website chrome.

The 3D environment should occupy the visitor's attention.

### Permitted controls
A very discreet control layer may exist when necessary:

- Sound mute / unmute
- Skip / enter experience control where appropriate

Controls should be visually minimal and should never compete with the cinematic composition.

*Detailed accessibility and control behavior are defined in `technical-architecture.md`.*

---

## 6. Sound Design

Sound is an **optional but intentional layer** of the cinematic experience. If implemented, it should behave as environmental sound design rather than a conventional website soundtrack.

### Sound philosophy
Sound should be subtle, atmospheric, physical, minimal, and spatially motivated. Potential elements include:

- Very low architectural room tone
- Subtle environmental ambience
- Soft atmospheric movement
- Restrained reveal cues
- Quiet transitions
- Carefully chosen moments of silence

Sound should reinforce the sense that the visitor is inside a physical architectural environment.

### Reveal cues
Major discoveries may receive extremely subtle sound cues:

```text
LIGHT REVEAL     → subtle environmental emergence
CAMERA DISCOVERY → restrained physical cue
MONITOR REVEAL   → subtle tonal transition
HERO ARRIVAL     → held, quiet — no musical sting; let the visual carry it
```

These cues should never become obvious "UI sounds."

### Silence
Silence should be used deliberately. Brief visual stillness should also be allowed to become moments of acoustic stillness. This reinforces pacing and prevents the experience from becoming overstimulating.

### Audio rules
Do not add a continuous music track simply to make the experience feel more cinematic. Do not use audio to compensate for weak visual storytelling. The experience must remain complete and effective without sound.

If audio is used, it must not autoplay in a way that violates browser behavior or creates an unexpected experience. A clear mute/unmute mechanism must be available.

*Detailed audio implementation, browser behavior, loading, and accessibility are defined in `technical-architecture.md`.*

---

## 7. Act 1 — Film

### Narrative purpose
**Film captures.**

The visitor moves from discovering the MGRT environment to discovering the physical tool used to capture the world. The cinema camera is the first major object.

### Opening state
The architectural environment is already established. The camera is initially obscured or distant. The visitor should first perceive its **presence and silhouette**, rather than immediately seeing every detail.

### Camera discovery

```text
ENVIRONMENT → DISTANT SILHOUETTE → CAMERA BECOMES RECOGNIZABLE → LENS CATCHES LIGHT → CAMERA FULLY REVEALED
```

The light should naturally reveal the camera. The lens may catch a controlled highlight as the camera becomes visible. Avoid exaggerated lens flares.

### Camera approach
The camera gradually moves toward or around the cinema camera. Movement should feel like a real cinematic camera observing another camera — the visitor should feel physically present in the environment. The camera should not simply rotate around the object like a product viewer. The composition should remain editorial and cinematic.

### Lens transition
The lens becomes an important visual transition point. The viewer may approach the lens closely enough that it becomes a dark circular visual field. This provides an opportunity to transition from the physical camera into captured imagery. The transition should feel motivated by the object itself.

### Portfolio footage
Target approximately **2–4 selected Film pieces**. Selected Film work should be highly curated. Not all pieces need to appear simultaneously.

Portfolio footage should:

- Feel physically connected to the camera
- Support the cinematic narrative
- Remain visually subordinate to the overall composition
- Avoid becoming a conventional video gallery
- Avoid overwhelming the visitor with multiple videos or cards

The work should feel like **evidence of what the camera captures**, not a portfolio page inserted into the experience.

### Film typography
Primary: **FILM**
Supporting: **Cinematography · Videography**

Typography should appear as part of the environment and should not interrupt the visual payoff of the camera discovery.

### Act transition
The Film sequence should not end with a hard cut. The camera, footage, and environment should naturally lead toward Digital. The visitor should begin to understand that what they have just seen through the camera is **being displayed somewhere**.

---

## 8. Act 2 — Digital

### Narrative purpose
**Digital builds.**

The captured image becomes an experience displayed on a physical screen. The visitor moves from **Capture → Creation**.

### Transition from Film
The Film imagery remains present. The camera begins to move away or the viewpoint expands. The viewer gradually discovers that the footage exists within a larger physical environment. A monitor begins to emerge.

```text
FILM FOOTAGE → VIEWPOINT EXPANDS → EDGE OF MONITOR → MONITOR REVEALED → SCREEN BECOMES DOMINANT
```

The monitor should feel as though it has **always existed within the environment**. It should not suddenly spawn into the scene.

### Monitor
The monitor is a physical object. It should have realistic depth, realistic glass, physical reflections, appropriate shadows, and a believable relationship to the surrounding architecture. Avoid a floating futuristic holographic screen — the monitor should feel like a premium physical display inside an architectural installation.

### Digital work
Target approximately **2–4 selected Digital projects**. The monitor may display websites, interactive experiences, digital design, or immersive interfaces. The work should be carefully selected rather than presented as a conventional portfolio grid. The screen itself remains part of the composition.

### Lighting transition
The lighting may subtly evolve toward a cooler tonal character as the experience enters Digital. However: **the environment must not suddenly become darker, brighter, cooler, or warmer.** The transition should be continuous. The original directional light remains part of the scene. The visitor should perceive an evolution of atmosphere rather than a lighting state change.

### Digital typography
Primary: **DIGITAL**
Supporting: **Web Design · Digital Experiences**

Typography should feel physically integrated into the environment.

### Act transition
The monitor remains the visitor's focus through the end of Digital. The move to the hero should feel like a natural continuation of the camera's movement around the monitor, not a signal that something is about to change.

---

## 9. Act 3 — MGRT Hero (Final Frame)

### Narrative purpose
The journey ends where the brand is named. After Film and Digital, the camera travels the length of the room and comes to rest square-on to the MGRT MEDIA wordmark on the far wall.

### The traversal
From the Digital shot the camera eases back off the screen, passes between the film camera and the computer, and turns steadily onto the wall's axis before a final straight dolly onto the wordmark. Height rises gradually across the whole move; the camera stays level throughout.

### Final frame
The hero is the last position in the scroll timeline and the last mark in the side navigation. Scrolling or swiping further forward leaves the camera, lighting and composition exactly as they are — there is no further movement, blank space, or fade.

The hero uplight holds at full while the camera rests on the wordmark. The MGRT MEDIA wordmark in the top-left corner returns the visitor to the opening view outside the pillars.

---

## 10. Act 4 — Return (removed)

The former Return act — diving back through the billboard into the room, followed by a closing frame with links — was removed together with Campaigns. The hero is now the end of the experience.

---

## 11. Post-Experience — Explore

The cinematic sequence should **not simply end at the final MGRT MEDIA frame**. After the final moment of stillness, the experience should transition naturally into a practical exploration layer. This layer is part of the website, but should remain visually connected to the cinematic world.

### Purpose
The cinematic sequence creates the impression. The Explore layer provides the visitor with a practical way to understand MGRT's work, studio, and services — and ultimately make contact.

### Explore structure
The practical website should provide three primary destinations:

```text
WORK · ABOUT · CONTACT
```

These may be presented as a restrained navigation layer or as a continuation of the MGRT environment. The exact visual implementation may evolve during production, but the information architecture should remain intentionally simple.

### Work
Work provides access to MGRT's portfolio and case studies. It may contain Film work, Digital projects, and integrated projects combining multiple disciplines.

The Work experience may become more conventional than the cinematic sequence where appropriate. Usability, project discovery, and detailed case-study presentation take priority once the visitor enters this layer.

### About
About provides context about MGRT Media, its approach, capabilities, and creative philosophy. It should maintain the visual language of the cinematic experience without requiring the visitor to continue through another elaborate 3D sequence.

### Contact
Contact provides a clear and immediate path for potential clients to begin a conversation with MGRT. Contact should not be hidden behind the cinematic experience.

### Transition philosophy
The final MGRT MEDIA identity remains the visual anchor. The surrounding environment may gradually become quieter and more functional. The visitor should feel:

```text
CINEMATIC EXPERIENCE → STILLNESS → MGRT MEDIA → EXPLORE
```

rather than:

```text
3D EXPERIENCE → SUDDEN WEBSITE HEADER → CONVENTIONAL GRID
```

The transition should preserve the visual language of MGRT.

---

## 12. Portfolio Content Strategy

Portfolio content exists to support the cinematic story. It should never turn the experience into a conventional portfolio website.

### Film
Target: **2–4 selected pieces**. Use selected footage as evidence of what MGRT captures.

**Prefer:** cinematic clips, short sequences, strong visual moments, carefully curated work.
**Avoid:** large video grids, multiple simultaneous videos, long descriptions, conventional project cards.

### Digital
Target: **2–4 selected projects**. Use selected website and digital work inside the physical monitor.

**Prefer:** strong homepage compositions, interactive moments, visually distinctive projects, short curated selections.
**Avoid:** turning the monitor into a scrolling portfolio website within the website.

### General rule
> **Portfolio content should feel discovered inside the world, not inserted on top of it.**

Curate for **impact and narrative relevance**, not quantity.

---

## 13. Typography & Information Hierarchy

The cinematic environment remains the primary visual element. Typography should communicate the discipline without explaining everything.

### Primary hierarchy

```text
FILM · DIGITAL
```

Secondary service descriptions remain short (as implemented in the section captions):

```text
FILM
Stories made to move people.
Brand films · Commercials · Creative production

DIGITAL
Ideas brought to life in pixels, motion, and interaction.
Websites & e-commerce · 3D animation · Interactive experiences
```

Avoid paragraphs during the primary cinematic sequence. More detailed service descriptions and case studies may exist outside the cinematic sequence.

---

## 14. Desktop Composition

Desktop should emphasize architectural scale, depth, negative space, long camera movement, large object relationships, and environmental perspective. The visitor should sometimes see the object and environment simultaneously.

The wide viewport should be used to create **spatial tension and anticipation**. Objects should not always be centered — off-axis composition and controlled asymmetry are encouraged when they improve the cinematic framing.

---

## 15. Mobile Composition

Mobile should tell the same story but be **re-composed rather than scaled down**. The sequence remains:

```text
REVEAL → FILM → DIGITAL → MGRT HERO
```

However, the camera composition may change substantially. Mobile should emphasize closer object relationships, stronger subject framing, lens and material detail, intimacy, controlled depth, and reduced environmental breadth.

**Example — Film act:**

Desktop:
```text
ARCHITECTURE

                 CAMERA

                         LIGHT
```

Mobile:
```text
      CAMERA
       LENS

      LIGHT
```

The same narrative is preserved while the composition changes.

> **Mobile rule:** Never simply shrink the desktop camera framing to fit the phone. Reposition and re-compose the cinematic shots intentionally.

### Mobile performance
When necessary, mobile may reduce geometry complexity, texture resolution, particle count, volumetric complexity, reflection quality, environmental detail, and secondary objects.

However, preserve narrative, major objects, lighting progression, camera movement, spatial hierarchy, and cinematic atmosphere.

**Same story. Same world. Different composition and rendering fidelity.**

The experience should remain smooth and immersive during natural touch scrolling, including momentum scrolling and changes in scroll direction.

---

## 16. Scroll Experience

Scrolling should feel like controlling the camera through a cinematic timeline. The visitor should always understand that their scroll is causing the environment to evolve.

### Scroll direction
Forward scrolling progresses the narrative. Reverse scrolling should naturally reverse the cinematic progression. The experience should not rely on one-time entrance animations that break when the user scrolls backward.

### Progression

```text
INITIAL REVEAL → FILM DISCOVERY → FILM PAYOFF → DIGITAL REVEAL → DIGITAL PAYOFF
→ MGRT HERO (END)
```

Exact scroll ranges and animation timings are defined during implementation and performance testing. The sequence should remain concise.

---

## 17. First Visit & Returning Visit Behavior

The cinematic reveal is an important part of the MGRT identity, but repeat visitors should not be forced through the full introduction every time.

### First visit
The full experience should play:

```text
DARKNESS → LIGHT REVEAL → FILM → DIGITAL → MGRT HERO
```

### Returning visit
The initial reveal may be shortened. The visitor should be able to enter the cinematic sequence more quickly. The shortened version should preserve the visual identity of the opening without requiring the visitor to wait through the full first-visit reveal.

### Skip
A discreet skip / enter mechanism may allow visitors to bypass the initial reveal when appropriate. Skipping should place the visitor into a valid visual state rather than abruptly exposing unfinished geometry or an incomplete environment.

### Reduced motion
Visitors who request reduced motion should receive a substantially simplified experience while retaining MGRT identity, narrative structure, core objects, lighting language, and content hierarchy.

*Detailed reduced-motion behavior is defined in `technical-architecture.md`.*

---

## 18. Transition Principles

Transitions are among the most important elements of the experience. They should feel **physical rather than interface-driven**.

**Preferred transition mechanisms:** camera movement, light movement, occlusion, depth, scale, reflections, architectural framing, objects moving through the camera's field of view, gradual environmental exposure.

**Avoid relying primarily on:** crossfades, section-based opacity toggles, full-screen color transitions, abrupt scene replacement, independent animation timelines, visible loading states between acts.

A transition should ideally have a **physical explanation within the world**.

---

## 19. Film → Digital Transition

This transition deserves particular attention. It must not feel like:

```text
FILM SCENE → CUT → DIGITAL SCENE
```

It should feel like:

```text
FILM FOOTAGE → CAMERA / LENS → VIEWPOINT EXPANDS → MONITOR EDGE → MONITOR REVEALED → DIGITAL
```

The same environment, light, atmosphere, and spatial logic should remain present.

> **Critical rule:** There must be no visible brightness, exposure, fog, or lighting snap during the Film → Digital transition. The light should evolve continuously. The monitor should appear because the camera's viewpoint changes — not because a Digital section has been activated.

---

## 20. Ending & Closure

The experience ends on the MGRT hero: the camera settles square-on to the wordmark and holds there. The ending is stillness rather than a further move — no pull-back, no closing overlay, and nothing beyond the hero to scroll into.

---

## 21. Experience Principles

The following principles should guide every implementation decision:

1. **One world** — the experience should feel like one physical environment.
2. **One journey** — the visitor is moving through a story, not navigating disconnected sections.
3. **One light** — the primary light is a visual thread through the entire experience.
4. **Objects have meaning** — camera = Film, monitor = Digital, architecture and the wordmark on its wall = MGRT.
5. **Content is discovered** — portfolio work appears naturally inside the world.
6. **Movement has purpose** — camera movement must communicate discovery, transition, scale, or narrative progression.
7. **Restraint creates impact** — not every moment needs movement, sound, particles, or effects.
8. **Sound supports, never leads** — audio should deepen immersion without becoming the primary attraction.
9. **Mobile is re-composed** — the mobile experience tells the same story through intentionally different framing.
10. **Scroll is the timeline** — scrolling controls the cinematic progression rather than triggering unrelated UI animations.
11. **The void is the loader** — loading should feel like part of the experience rather than an interruption.
12. **The cinematic sequence is not the entire website** — it creates the impression; the practical website provides exploration, work, information, and contact.
13. **Never break the illusion** — avoid visible resets, scene swaps, loading interruptions, lighting snaps, or interface behaviors that remind the visitor they are simply scrolling through a webpage.

---

## 22. Definition of the Experience

The visitor should leave with a simple understanding:

**MGRT captures. MGRT builds.**

They should not necessarily remember every interaction or technical detail. They should remember the **feeling of moving through MGRT's world**.

The cinematic experience should create curiosity, communicate capability, and naturally lead the visitor toward exploring MGRT's work or making contact.

The experience succeeds when the website feels less like a website and more like a short cinematic installation controlled by the visitor's movement.

> **Core experience principle:** The visitor should feel as though they entered MGRT's world, experienced its creative disciplines, and emerged with a reason to explore further.
