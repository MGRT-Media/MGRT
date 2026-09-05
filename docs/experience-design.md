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

### Act 3 — Campaigns
The camera pulls back to reveal that the entire world so far has been displayed on a billboard.

### Act 4 — Return
The camera dives back through the billboard into the original room, closing the loop.

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
CAMPAIGNS
     ↓
RETURN
     ↓
MGRT MEDIA
     ↓
BRIEF STILLNESS
     ↓
EXPLORE / WORK / ABOUT / CONTACT
```

The experience should feel like **one continuous camera journey**, not five separate website sections.

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
BILLBOARD REVEAL → held, quiet — no musical sting; let the visual carry it
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
The monitor remains the visitor's focus through the end of Digital. There is no early hint of what Act 3 reveals — the transition into the pull-back should feel like a natural continuation of the camera's movement around the monitor, not a signal that something is about to change.

---

## 9. Act 3 — Campaigns

### Narrative purpose
**Campaigns amplify.**

Campaigns is not demonstrated through curated examples of past work. It is demonstrated structurally: the visitor discovers that the entire world they have been standing inside — the Room, the camera, the monitor, everything from Act 0 through Act 2 — is itself a campaign. This is the largest spatial and conceptual moment of the experience.

### The pull-back

The camera begins a single continuous pull-back from the monitor. Nothing about the interior room changes — no new objects, no additional screens, no separate campaign displays are introduced into the space. Instead, as the pull-back continues, the edges of the room become visible for the first time, and the visitor sees that those edges are the frame of a physical billboard.

The pull-back reads as three legible stages within that one continuous movement, not a single undifferentiated recession into the distance:

```text
MONITOR (CLOSE)
→ PULL-BACK THROUGH THE PILLAR RING (room's own architecture becomes the threshold)
→ FULL ROOM + PILLAR RING READ AS ONE COMPLETE STRUCTURE
→ STRUCTURE REVEALED AS A BILLBOARD FACE
→ BILLBOARD SEEN ON THE RIGHT SHOULDER OF A 4-LANE HIGHWAY, CURVING AWAY RIGHT
```

The first stage passes the camera back out through the same pillar ring that has framed the room since Act 0 — the pillars are not repositioned or duplicated for this moment, they are simply revisited from the other side, so the passage feels like leaving through a threshold rather than a new object appearing. The second stage holds long enough for the room and its ring of pillars to be legible as one complete, self-contained structure before that structure's true context is revealed. Only in the third stage does the billboard framing and the highway become visible.

The entire interior — everything the visitor has experienced since Act 0 — remains visible on the billboard surface throughout the pull-back. It does not cut, fade, or swap to a static image. What the visitor is looking at right now continues to be what they see, at a steadily increasing distance, until its true scale and context become clear.

### Campaign reveal

The visual language should communicate a single realization: **the world was the campaign.** There is no separate "campaign work" to browse — Film and Digital have just been demonstrated to combine into one integrated piece of MGRT's own campaign capability, proven by the structure of the experience itself rather than described in a gallery.

### Scale
The pull-back moves through a clear spatial hierarchy:

```text
FILM       — Personal / intimate
     ↓
DIGITAL    — Interactive / constructed
     ↓
CAMPAIGNS  — The intimate world revealed at billboard, then city, scale
```

The exterior environment surrounding the billboard is a four-lane highway, gently curving away to the right, with the billboard positioned on the road's right-hand shoulder as a real roadside structure would be. It should read as a believable stretch of road — lane markings, shoulder, a sense of continuing distance — not an abstract void or a generic street/plaza. It should be composed with the same restraint as the rest of the experience: enough to establish scale and context, not a fully detailed environment competing for attention.

### Campaign typography
Primary: **CAMPAIGNS**
Supporting: **Advertising · Commercials · Creative Direction**

Typography here should be minimal to the point of near-absence — the reveal itself is the statement. If used at all, it should appear only once the billboard is fully legible as a billboard, not during the pull-back itself.

### Visual payoff
The payoff is the moment the visitor understands what they are looking at — not a moment of added spectacle. Avoid introducing new visual effects, additional screens, crowds, traffic, or other environmental incident at the reveal. The environment should become impressive because of what it reveals, not because of what is added to it.

---

## 10. Act 4 — Return

### Narrative purpose
The visitor returns to where the experience began — but by diving back into the billboard they just discovered, not by a separate camera movement in the exterior world. This provides closure through the same surface that just delivered the reveal: the visitor re-enters MGRT's own world through MGRT's own campaign.

### Beginning of return
Having established the billboard within its exterior environment, the camera's outward movement stops and reverses. The camera moves back toward the billboard surface, retracing the pull-back rather than cutting or resetting to a new position.

```text
EXTERIOR ENVIRONMENT → BILLBOARD SURFACE → THROUGH THE SURFACE → INTERIOR ROOM
```

### Re-entering the room

As the camera crosses the billboard surface, the exterior environment falls away and the interior room becomes the entirety of the frame again — the same room, the same objects, the same light, at the same scale as it was before the pull-back began. This must read as one continuous camera movement, not a cut, fade, or scene swap.

### Objects settle
Having re-entered, the camera settles into a final resting composition. The monitor and cinema camera may remain visible in the environment or recede from frame — whichever is physically motivated by camera position — but neither should abruptly disappear.

### Return to original space
The visitor reaches the same architectural environment established during Act 0. The original directional light is still present; the same spatial language returns. However, the environment now carries a second meaning it did not have at the opening: the visitor understands they are standing inside the very thing that was just revealed as MGRT's campaign. The visitor has effectively completed a journey through MGRT and arrived back where it began, seeing it differently.

### Final identity
The final identity appears: **MGRT MEDIA**
Optional supporting line: **FILM · DIGITAL · CAMPAIGNS**

The final moment should have a brief period of stillness. The experience should not immediately introduce another large visual sequence.

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
Work provides access to MGRT's portfolio and case studies. It may contain Film work, Digital projects, Campaigns, and integrated projects combining multiple disciplines.

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

### Campaigns
Campaigns has **no curated portfolio content of its own**. It does not display selected campaign pieces, poster mockups, social feeds, or a gallery of past work. The campaign concept is demonstrated entirely by the structural reveal in Act 3 — the visitor's own preceding journey through Film and Digital, shown to have been a campaign.

**Avoid:** video grids, poster/mockup displays, social-post feeds, project cards, or any curated gallery of campaign work. Introducing browsable content here would compete with, rather than support, the reveal.

### General rule
> **Portfolio content should feel discovered inside the world, not inserted on top of it.**

Curate for **impact and narrative relevance**, not quantity.

---

## 13. Typography & Information Hierarchy

The cinematic environment remains the primary visual element. Typography should communicate the discipline without explaining everything.

### Primary hierarchy

```text
FILM · DIGITAL · CAMPAIGNS
```

Secondary service descriptions remain short:

```text
FILM
Cinematography · Videography

DIGITAL
Web Design · Digital Experiences

CAMPAIGNS
Advertising · Commercials · Creative Direction
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
REVEAL → FILM → DIGITAL → CAMPAIGNS → RETURN → EXPLORE
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

### The billboard reveal on mobile

The general mobile principle — closer framing, reduced environmental breadth — works against the billboard reveal specifically, since the reveal's entire effect depends on a visible jump in scale from an intimate interior to an expansive exterior. Do not compress this act to keep it "close" the way Film or Digital are compressed.

On mobile, the pull-back should still read as a real change in scale — a narrower field of view and a more vertical framing (favoring the phone's aspect ratio) are appropriate, but the distance and the sense of the room becoming small within a larger exterior must remain legible. If the exterior environment must be simplified for mobile performance, simplify its detail before compromising the sense of scale itself.

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
→ BILLBOARD REVEAL → DIVE BACK IN → RETURN → FINAL MGRT MEDIA → EXPLORE
```

Exact scroll ranges and animation timings are defined during implementation and performance testing. The sequence should remain concise.

---

## 17. First Visit & Returning Visit Behavior

The cinematic reveal is an important part of the MGRT identity, but repeat visitors should not be forced through the full introduction every time.

### First visit
The full experience should play:

```text
DARKNESS → LIGHT REVEAL → MGRT MEDIA → FILM → DIGITAL → CAMPAIGNS → RETURN
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

## 19A. Digital → Reveal Transition (Billboard)

This is the single most important transition in the experience, and the primary technical risk of the project. It must not feel like:

```text
DIGITAL SCENE → CUT → EXTERIOR SCENE WITH A BILLBOARD ON IT
```

It should feel like:

```text
MONITOR (CLOSE) → CONTINUOUS PULL-BACK → ROOM EDGES APPEAR → ROOM REVEALED AS BILLBOARD → EXTERIOR CONTEXT
```

The interior room — everything the visitor has seen since Act 0 — must remain the same live, continuously rendered content throughout the pull-back. It does not cut, fade, freeze, or swap to a static image at any point. The visitor is looking at the same evolving scene the entire time; only the framing and distance change.

> **Critical rule:** The interior environment must be visibly live for the full duration of the pull-back — not a pre-rendered image applied once the billboard framing is reached. If the interior appears to "freeze" or swap to a still image as the reveal begins, the illusion is broken.

The return dive-back-in in Act 4 is this same transition in reverse, into the same environment — not a new or separately built scene. Whatever technique renders the interior onto the billboard surface must support the camera re-entering it seamlessly.

---

## 20. Ending & Closure

The ending should mirror the opening — but through the billboard, not around it.

**Opening:**
```text
DARKNESS → LIGHT → MGRT
```

**Ending:**
```text
CAMPAIGNS (BILLBOARD REVEAL) → DIVE BACK THROUGH THE SURFACE → RETURN → LIGHT → MGRT → STILLNESS → EXPLORE
```

The same environment and light source should create a visual bookend. The visitor should recognize the space from the opening — and additionally recognize it as the same space that was just revealed as MGRT's own campaign. The cinematic sequence should feel complete before practical navigation appears.

---

## 21. Experience Principles

The following principles should guide every implementation decision:

1. **One world** — the experience should feel like one physical environment.
2. **One journey** — the visitor is moving through a story, not navigating disconnected sections.
3. **One light** — the primary light is a visual thread through the entire experience.
4. **Objects have meaning** — camera = Film, monitor = Digital, the room itself (revealed as a billboard) = Campaigns, architecture = MGRT.
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

**MGRT captures. MGRT builds. MGRT amplifies.**

They should not necessarily remember every interaction or technical detail. They should remember the **feeling of moving through MGRT's world**.

The cinematic experience should create curiosity, communicate capability, and naturally lead the visitor toward exploring MGRT's work or making contact.

The experience succeeds when the website feels less like a website and more like a short cinematic installation controlled by the visitor's movement.

> **Core experience principle:** The visitor should feel as though they entered MGRT's world, experienced its creative disciplines, and emerged with a reason to explore further.
