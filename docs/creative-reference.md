# MGRT Media — Creative Reference & Creative Brief

---

## 1. Project Vision

MGRT Media is a cinematic creative studio built around three disciplines:

| Discipline | Focus |
|---|---|
| **Film** | Cinematography and videography |
| **Digital** | Web design and immersive digital experiences |
| **Campaigns** | Advertising, commercial production, and integrated creative strategy |

> **Film captures. Digital builds. Campaigns amplify.**

The website should function as a **short, scroll-driven cinematic experience**, not a conventional agency website. The visitor moves through MGRT's creative world, with the browser viewport treated as an environment rather than a stack of flat UI sections.

The experience is intentionally concise: **4 major scroll-driven cinematic acts after the initial page-load reveal.** Each act is a distinct cinematic beat within one continuous physical environment. The goal is a short, immersive experience — not a long scrolling website.

---

## 2. Scope & Companion Documents

This document defines **creative direction only**: visual language, narrative meaning, spatial composition, atmosphere, motion principles, pacing, sound philosophy, interaction philosophy, and creative constraints.

Technical and detailed choreographic decisions live in separate documents.

| Document | Covers |
|---|---|
| `creative-reference.md` *(this document)* | Creative vision, visual identity, aesthetic direction, lighting language, materials, motion principles, high-level narrative meaning, spatial metaphors, cinematic pacing, sound philosophy, interaction philosophy, creative constraints, mobile creative direction |
| `experience-design.md` | **Single source of truth** for the act-by-act visitor experience: scene progression, camera choreography, scroll progression, object reveals and interactions, cinematic beats, typography placement, transitions, portfolio integration, post-experience transition, first/returning visit experience, desktop and mobile composition |
| `technical-architecture.md` | Technology stack, Three.js / React Three Fiber architecture, GSAP / scroll implementation, rendering strategy, mobile implementation, performance budgets, adaptive quality, Safari compatibility, accessibility, reduced-motion behavior, navigation and skip mechanisms, audio implementation, asset loading/optimization, asset production requirements |
| `build-workflow.md` | Development phases, review gates, testing process, browser testing, performance testing, implementation workflow |
| `build-status.md` | Completed work, current phase, known issues, outstanding tasks |

The narrative progression in this document is intentionally high-level.

**Do not duplicate detailed choreography between documents.** If the exact sequence, timing, camera movement, or object interaction changes, update `experience-design.md`, not this document.

Likewise, **do not introduce technical implementation decisions here** unless they directly affect the creative outcome.

---

## 3. Creative & Lighting References

### Primary inspiration — Musée
**https://musee.barvian.me/**

Use as a **quality benchmark**, not a template. Take inspiration from:

- Spatial composition and scroll-driven camera paths
- Dramatic architectural scale
- Restrained typography and subtle depth
- Physical object relationships, seamless scene transitions
- Environmental storytelling, high-quality 3D presentation, cinematic pacing

**Do not** copy Musée's layouts, assets, artwork, typography, compositions, interactions, or visual identity. MGRT needs its own visual language. The goal is comparable **spatial sophistication and cinematic polish** — not reproduction.

### Environmental lighting reference

The opening environment draws on dark architectural spaces cut by strong directional light:

- Dark architectural voids
- Strong directional sunlight through high apertures, with visible volumetric rays
- Floating dust particles, deep shadows, stark contrast
- Atmospheric depth

**Narrative function:** light is not decorative. It is the primary agent that reveals MGRT's world.

> Something exists within the darkness, and is progressively discovered through light.

---

## 4. Visual & Aesthetic Guidelines

### Tone & style

The visual language draws on high-end production studios, fine-art photography exhibitions, architectural installations, short-form auteur cinema, and premium editorial design.

**Target feel:** premium · architectural · atmospheric · restrained · tactile · mysterious · editorial · cinematic · physically believable

The website should feel confident and sophisticated rather than visually busy.

### Design boundaries

| ✅ Do | ❌ Don't |
|---|---|
| Rich dark neutrals — charcoal, slate, warm greys | Bright neon or highly saturated accent colors |
| Physically believable materials | Excessive gloss or plastic-looking shaders |
| Concrete, architectural stone, dark metal, glass, matte surfaces | Sci-fi metallic sheens or generic futuristic materials |
| Slow, deliberate camera paths with physical inertia | Bouncy UI-style physics or rapid spins |
| Large spatial typography | Dense blocks of copy |
| Strong negative space | Traditional agency grids dominating the composition |
| Subtle atmospheric effects | Excessive particles, fog, or visual noise |
| Cinematic lighting | Constantly changing colored lights |
| Purposeful 3D objects | Decorative 3D assets with no narrative purpose |
| Continuous visual transitions | Hard scene cuts or obvious animation resets |
| Portfolio work integrated into the environment | Portfolio content overwhelming the cinematic experience |
| Restrained sound design | Constant background music or intrusive sound effects |
| Minimal interface | Persistent navigation bars or conventional website chrome during the cinematic sequence |
| Intentional mobile composition | Simply shrinking the desktop experience |

---

## 5. Environment & Materiality

### Color palette

**Base environment:** near-black (`#0D0D0D`), charcoal, slate, warm grey neutrals.

**Illumination:** warm white, natural sunlight (~4500K–5500K), soft amber highlights.

The Digital act may introduce subtly cooler tones, but the Film → Digital transition must remain visually continuous. There should be no abrupt lighting or exposure change simply because the narrative has moved to a different discipline.

### Materiality

Surfaces should read as physically real. Preferred materials include:

- Cast concrete, architectural stone
- Dark brushed metal, dark-anodized aluminum
- Smoked glass, matte light-absorbing finishes

Use appropriate roughness, reflectivity, and subtle surface imperfection. Prioritize **visual believability over shader complexity** — material complexity should only be introduced when it creates a visible improvement in the final composition.

---

## 6. Motion & Typography

### Motion principles

The camera behaves like a physical cinema camera operating on a heavy dolly, crane, or motion-control rig. Movement should communicate physical weight, smooth acceleration, controlled deceleration, deliberate framing, subtle inertia, and spatial awareness.

**Avoid:** rapid rotations, bouncy transitions, UI-style spring physics, unnecessary camera shake, constant or unmotivated movement, and effects that draw attention to the animation system itself.

Movement should always have a narrative or compositional reason.

### Spatial typography

Typography should feel embedded in the physical environment, not layered on top as conventional website UI.

- Large architectural scale, strong spatial presence
- Minimal supporting copy, clear hierarchy, significant negative space
- Strong integration with lighting and architecture
- HTML/CSS or true 3D text, chosen per context — **visual integration matters more than forcing everything into WebGL**
- Prefer HTML/CSS where it wins on accessibility, responsiveness, performance, or readability; use true 3D type when it materially contributes to the physical composition
- Never crowd the screen with prose

---

## 7. Narrative Arc & Spatial Progression

The website is one continuous cinematic environment.

It should feel like one physical world with one camera moving through it — not a series of independently loaded or disconnected scenes.

The environment should persist throughout the experience. The visitor should never feel that the website has abruptly changed to an unrelated scene.

### Overall narrative

```text
INITIAL LOAD
     ↓
DARK VOID
     ↓
LIGHT REVEAL
     ↓
MGRT MEDIA
     ↓
FILM
     ↓
DIGITAL
     ↓
CAMPAIGNS
     ↓
RETURN TO ORIGINAL SPACE
     ↓
MGRT MEDIA
     ↓
STILLNESS
     ↓
EXPLORE / CONTACT / WORK
```

This is the **creative narrative only**. The exact camera choreography, scroll ranges, timings, object movements, transitions, typography placement, and cinematic beats are defined exclusively in `experience-design.md`.

### Act 0 — Initial Reveal

The page begins in darkness. A directional beam progressively reveals the architectural environment; dust becomes visible within the beam. The MGRT identity emerges from the interplay between darkness and light. The initial reveal occurs before the visitor begins the major scroll-driven sequence — short, cinematic, and immediately transitioning into the interactive experience. The visitor should understand the MGRT identity before needing to navigate deeper into the page.

**Loading philosophy — the void is the loader.** The visitor should not be presented with conventional loading UI.

**Avoid:** loading bars, percentage counters, spinners, "Loading..." text, technical progress indicators.

The darkness should feel intentional rather than like the website is waiting to load. Technical asset preparation may occur behind this experience, but the loading machinery should remain invisible.

### Act 1 — Film

Film represents **capturing moments and stories**. The physical cinema camera is the primary object.

**Services:** cinematography, videography.

Selected portfolio footage may be integrated into the Film experience. Portfolio content should remain carefully curated and visually subordinate to the overall cinematic composition and pacing. The Film experience should communicate the act of **capture**, not become a conventional video portfolio.

### Act 2 — Digital

Digital represents **building experiences and environments**. The physical monitor becomes the primary object.

**Services:** web design, digital experiences.

Selected examples of MGRT's digital work may be integrated naturally into the monitor. Digital work should feel like part of the physical cinematic world rather than a conventional portfolio displayed inside a screen. Lighting continuity between Film and Digital is essential.

### Act 3 — Campaigns

Campaigns represent **amplifying ideas and bringing them into the world**. The environment expands to reveal larger screens or billboard-like surfaces carrying selected campaign work.

**Services:** advertising, commercial production, creative direction, campaign strategy.

Campaign work may demonstrate advertising, commercial production, photography, digital, social, and brand communication together — how multiple creative disciplines can contribute to one larger idea. Campaigns should feel like the largest spatial expression of the MGRT world, without becoming visually excessive.

### Act 4 — Return

The Campaign environment recedes. The visitor returns to the original architectural space — same visual language, same primary light source as the opening — for a sense of narrative closure. The environment should now feel more understandable and visible than it did at the beginning.

The final identity appears: **MGRT MEDIA**
Optional supporting line: **FILM · DIGITAL · CAMPAIGNS**

The ending should feel like a return to the beginning — not the introduction of a new scene.

After a brief period of stillness, the cinematic experience should naturally give way to practical exploration of MGRT's work and services.

---

## 8. Spatial & Object Metaphors

Every major 3D asset must justify its narrative presence — no decorative objects added purely for visual impressiveness.

| Object | Represents |
|---|---|
| Darkness & directional light | Discovery; the beginning of an idea |
| Cinema camera | Film, capture, visual storytelling |
| Film frame | The captured moment becoming a story |
| Monitor / digital display | Digital creation, interaction, experience |
| Billboard / commercial screen | Campaigns, communication, amplification |
| Original architectural space | The world of MGRT itself |

Objects should feel physically connected to one another — camera, monitor, screens, architecture, lighting, and atmosphere all belong to the same visual world.

---

## 9. Lighting Continuity

Lighting is a primary storytelling system and must evolve continuously through the experience — especially across **Film → Digital**.

**Avoid:** independent per-section lighting states, bright→sudden-dark or dark→sudden-bright cuts, abrupt exposure or fog changes, visible scene resets, light toggles tied purely to section state, or reinitializing the environment between acts.

**Instead:** lighting properties should evolve continuously through the cinematic timeline. The visitor should feel that the same physical environment and light are evolving.

**Light acts as the visual thread connecting the entire experience.**

---

## 10. Atmosphere & Dust

Dust and atmospheric particles exist primarily within areas touched by light, behaving like real suspended particles:

- Small, sparse, slow, subtle
- Unevenly distributed
- Most visible inside volumetric light

Dust should reinforce the physical environment — it should never become a generic particle-field background.

> If the particles become visually obvious as an "effect," they are too prominent.

Atmosphere exists to create depth and physicality, not spectacle.

---

## 11. Sound & Acoustic Direction

Sound may be used as a **restrained cinematic layer**. It should deepen the feeling of being inside a physical architectural environment without turning the website into a music-driven experience.

### Sound philosophy
If implemented, sound should be subtle, atmospheric, physical, minimal, and spatially motivated. Potential elements include very low architectural room tone, subtle environmental ambience, atmospheric movement, restrained reveal cues, quiet transitions, and carefully chosen moments of silence.

### No conventional soundtrack
A continuous music track should not be added simply to make the experience feel cinematic. The visual experience must remain strong without music. Sound should **support the image rather than lead it**.

### Silence
Silence is an intentional creative tool. Brief periods of stillness should be allowed to become moments of acoustic stillness — this creates contrast and prevents the experience from becoming overstimulating.

### Audio interaction
If audio is used: it must not create an unexpected autoplay experience, visitors must have a clear way to mute/unmute it, and the experience must remain fully functional without audio.

*Detailed audio implementation is defined in `technical-architecture.md`.*

---

## 12. Interface & Interaction Philosophy

During the cinematic sequence, the interface should be **nearly invisible**. The 3D environment should be the interface.

**Avoid persistent:** navigation bars, conventional headers, social icons, large fixed logos, menus, floating panels, conventional website chrome.

A discreet sound control may be present if audio is implemented. A discreet skip mechanism may also be available where appropriate. Controls should never dominate the composition.

The visitor should feel that they are **moving through an environment**, not operating a website interface.

---

## 13. Cinematic Pacing & Restraint

The experience should be short and intentional — the visitor shouldn't need to scroll through dozens of minor interactions. Each act should contain a meaningful visual progression:

**anticipation → movement → discovery → visual payoff → brief stillness**

Not every moment needs movement. Stillness creates contrast and makes major transitions feel cinematic. Avoid adding animation simply to fill scroll distance — every major movement should communicate a change in story, environment, object, scale, discipline, or perspective.

The experience should feel **edited**, like a short film. There should be no unnecessary scroll distance simply to make the website appear longer.

---

## 14. Portfolio Content Direction

Portfolio work exists to demonstrate MGRT's capabilities while supporting the cinematic narrative. The homepage should prioritize **curation over quantity**.

**Approximate starting ranges:**

| Discipline | Suggested selection |
|---|---:|
| Film | 2–4 pieces |
| Digital | 2–4 projects |
| Campaigns | 3–5 campaign examples |

These are creative guidelines rather than fixed production requirements. Not every selected project needs to be visible simultaneously.

Portfolio work should be highly curated, support the narrative, feel naturally integrated into the environment, remain subordinate to composition and pacing, and demonstrate quality rather than quantity.

**Avoid transforming the cinematic sequence into:** a video gallery, a project grid, a conventional case-study index, a collection of cards, a portfolio dashboard.

> **Portfolio content should feel discovered inside MGRT's world, not inserted on top of it.**

More detailed case studies and project information may exist outside the cinematic sequence.

---

## 15. Responsive & Mobile Creative Direction

Mobile is a **first-class creative experience**, not a fallback or a scaled-down version of desktop. It should tell the same story and preserve the same four-act structure, but be intentionally recomposed for the smaller viewport — think of it as the same film **re-composed for a different aspect ratio**, not the desktop experience compressed into a phone.

### What stays consistent

Narrative · four-act structure · MGRT reveal · Film → Digital → Campaigns progression · core 3D objects · lighting language · atmospheric character · typography hierarchy · final return to MGRT Media · overall cinematic tone

### What may change

Camera position, framing, and field of view · object scale and placement · spatial depth · typography scale · camera travel distance · environmental visibility · atmospheric density · visual complexity

Desktop may emphasize **scale and architectural space**; mobile may emphasize **proximity, intimacy, and subject detail**. For example, the Film act might show the camera within a large architectural environment on desktop, while mobile brings the camera and lens much closer to the viewer. Same narrative purpose, different composition.

> **Mobile creative principle:** Do not make mobile smaller. Make mobile intentional.

### Performance without losing the story

When visual complexity must be reduced for mobile or lower-powered devices, preserve narrative, camera choreography, major object relationships, lighting progression, spatial hierarchy, and cinematic atmosphere. Reduce visual fidelity intelligently rather than removing the cinematic experience.

Potentially reduced elements include geometry complexity, texture resolution, particle count, volumetric complexity, reflection quality, and secondary environmental detail.

> **Same story. Same world. Different composition and rendering fidelity.**

*Detailed performance strategy and adaptive rendering are defined in `technical-architecture.md`.*

---

## 16. Repeat-Visit Creative Direction

The initial reveal is an important part of MGRT's identity, but repeat visitors should not be forced through the full introductory sequence every time.

### First visit
The complete reveal should establish: **Darkness → Light → MGRT Media → Film → Digital → Campaigns → Return**

### Returning visits
The opening reveal may be shortened so returning visitors can reach the cinematic sequence more quickly. The shortened experience should retain the visual character of the opening without requiring the visitor to wait through the full reveal again.

### Skip
A discreet skip mechanism may allow visitors to bypass the initial reveal when appropriate. Skipping should preserve the cinematic environment rather than abruptly exposing an unfinished or incomplete state.

### Reduced motion
Visitors who request reduced motion should receive a substantially simplified version of the experience while retaining MGRT identity, narrative structure, core objects, lighting language, and content hierarchy.

*Detailed reduced-motion behavior is defined in `technical-architecture.md`.*

---

## 17. Post-Experience Direction

The cinematic sequence is **not the entire website**. Its purpose is to create recognition, curiosity, emotional impact, understanding of MGRT's disciplines, a desire to explore the work, and a reason to make contact.

After the final MGRT Media moment and brief stillness, the visitor should naturally be able to continue into the practical website experience. The transition should remain visually restrained.

The website may then provide access to areas such as **Work**, **About**, and **Contact**. The exact information architecture is defined outside this creative brief.

The important creative principle is:

> **The cinematic experience creates the impression. The practical website turns that impression into exploration and inquiry.**

The visitor should never feel trapped inside the cinematic sequence.

---

## 18. Definition of Success

The finished website should disappear behind the experience. A visitor should feel they have entered an architectural cinematic installation, not browsed a conventional agency site. The technology is not the story.

**The story:**
Light reveals MGRT. MGRT captures through Film. MGRT builds through Digital. MGRT amplifies through Campaigns. Everything returns to MGRT.

Success comes from composition, lighting, physicality, camera movement, pacing, spatial storytelling, narrative continuity, restraint, sound discipline, and mobile immersion — not from maximizing the number of visual effects.

> **Core principle:** Technology serves narrative depth at all times. Every camera movement, light change, object, transition, sound cue, interface element, and effect must have a reason to exist.
