# MGRT Media — Technical Architecture

---

## 1. Purpose

This document defines **how the MGRT Media cinematic website is technically built**.

It translates the creative direction in `creative-reference.md` and the visitor experience defined in `experience-design.md` into a maintainable, performant implementation.

This document owns:

- Application architecture
- 3D rendering architecture
- Camera and scroll systems
- Animation systems
- Lighting and atmospheric effects
- Material and rendering strategy
- Portfolio media implementation
- Audio implementation
- Asset loading and optimization
- Responsive and mobile implementation
- Adaptive performance
- Safari and browser compatibility
- Viewport and resize handling
- Accessibility and reduced-motion behavior
- Navigation, skip, and repeat-visit behavior
- Performance budgets
- Technical fallbacks
- Technical implementation constraints

### Document ownership

The project documentation follows this hierarchy:

| Document | Responsibility |
|---|---|
| `creative-reference.md` | **WHY** — creative vision, visual language, narrative meaning, aesthetic direction |
| `experience-design.md` | **WHAT** — exact cinematic visitor experience and sequence |
| `technical-architecture.md` | **HOW** — technical implementation and architecture |
| `build-workflow.md` | **HOW WE BUILD** — development process, phases, review gates, and testing |
| `build-status.md` | **WHERE WE ARE** — current implementation status, known issues, and next steps |

`experience-design.md` is the **single source of truth for the cinematic sequence**.

This document must not redefine the narrative or introduce alternative choreography. If a technical limitation requires a change to the experience, the change should first be evaluated against `experience-design.md` rather than silently altering the intended sequence.

---

## 2. Technical Philosophy

The technology exists to support the cinematic experience, not to become the experience itself.

The implementation should prioritize:

1. Smoothness
2. Visual continuity
3. Physical credibility
4. Responsive behavior
5. Maintainability
6. Performance
7. Progressive enhancement
8. Visual fidelity

When these priorities conflict, **smoothness and experience integrity take precedence over visual complexity**.

A simpler scene running smoothly is preferable to a technically impressive scene that produces stutter, dropped frames, excessive GPU load, or inconsistent scroll behavior.

### Core technical principles

**One world** — the primary 3D environment should be persistent rather than repeatedly destroyed and recreated between acts.

**One camera** — the cinematic sequence should use one coherent camera system whose position, rotation, framing, and field of view evolve through the timeline.

**One timeline** — scroll should control a deterministic cinematic timeline rather than triggering unrelated animations.

**Continuous state** — lighting, atmosphere, camera movement, object transforms, and environmental properties should interpolate continuously. Avoid section-based state changes that create visible jumps.

**Frame-rate independence** — animation must not assume a fixed 60fps update rate. Motion should remain consistent across 60Hz, 90Hz, 120Hz, and higher-refresh displays.

**Progressive enhancement** — the full cinematic experience should be the highest-quality presentation, but the site must remain usable when advanced rendering features cannot be supported efficiently.

**Performance before effects** — do not add an effect merely because it is technically possible. Every expensive rendering feature must justify its visual contribution.

---

## 3. Recommended Technology Stack

The preferred implementation is:

| Layer | Preferred technology |
|---|---|
| Application | React |
| 3D rendering | Three.js |
| React/Three integration | React Three Fiber |
| 3D helpers | Drei where appropriate |
| Animation / timeline | GSAP |
| Scroll orchestration | GSAP ScrollTrigger or an equivalent deterministic scroll timeline |
| Styling | CSS |
| Build tooling | Vite |
| Deployment | Vercel |
| Version control | Git |

These are **recommended technologies, not reasons to add dependencies unnecessarily**. The implementation should use the smallest practical set of libraries required to achieve the experience.

### Three.js / React Three Fiber
Three.js provides the underlying WebGL rendering environment. React Three Fiber should be used where it improves scene organization and maintainability. The 3D scene should not be forced into React component abstractions where doing so creates unnecessary rendering overhead or complexity.

### GSAP
GSAP is preferred for cinematic sequencing because the experience requires precise timeline control, scrubbing, reversible animation, coordinated camera movement, continuous interpolation, scroll-linked progression, and deterministic animation states.

GSAP should control **meaningful cinematic state**, not every tiny visual effect.

### Scroll
Scroll is the primary input mechanism. The scroll system must map scroll position to a normalized cinematic timeline.

```text
SCROLL POSITION
       ↓
NORMALIZED TIMELINE
       ↓
CAMERA / LIGHT / OBJECTS / ATMOSPHERE
       ↓
RENDERED FRAME
```

Scroll should not simply trigger individual animations such as `onEnter → play animation` / `onLeave → hide object` unless those animations are explicitly compatible with continuous forward and reverse navigation.

---

## 4. Application Architecture

The application should separate the **cinematic experience layer** from the **practical website layer**.

### High-level structure

```text
APPLICATION
│
├── Cinematic Experience
│   ├── Environment
│   ├── Camera
│   ├── Lighting
│   ├── Atmosphere
│   ├── Film Object
│   ├── Digital Monitor
│   ├── Typography
│   └── Timeline Controller
│
├── Experience Controls
│   ├── Skip
│   ├── Audio
│   └── Accessibility
│
└── Explore Layer
    ├── Work
    ├── About
    └── Contact
```

The cinematic layer should not become tightly coupled to the practical website layer. This allows the cinematic experience to remain a focused immersive environment while the practical content remains maintainable and accessible.

### Persistent scene
The primary Three.js scene should remain mounted throughout the cinematic sequence. Do not repeatedly mount and unmount the entire WebGL scene as the visitor moves between Film, Digital, and the MGRT hero.

Objects may be moved, hidden through physical occlusion, repositioned, scaled, removed from rendering when appropriate, or revealed progressively — but the underlying environment should remain coherent.

### DOM / WebGL separation
Not every element belongs inside WebGL.

**Use WebGL** for elements that materially benefit from perspective, physical lighting, depth, 3D movement, spatial interaction, or material response.

**Use HTML/CSS** for elements that benefit from accessibility, responsive typography, semantic content, text selection, reliable layout, lower rendering cost, or easier mobile adaptation.

The visual result should feel integrated even when the underlying implementation uses both systems.

---

## 5. 3D Scene Architecture

The 3D environment should be designed as **one persistent architectural world**.

### Scene hierarchy

A conceptual scene hierarchy should resemble:

```text
SCENE
│
├── Environment (Interior Room)
│   ├── Architecture
│   ├── Floor
│   ├── Walls
│   ├── Columns
│   └── Structural Elements
│
├── Lighting
│   ├── Primary Directional Light
│   ├── Ambient / Fill
│   ├── Volumetric Light
│   └── Local Practical Lights
│
├── Atmosphere
│   ├── Dust
│   ├── Fog / Atmospheric Depth
│   └── Environmental Effects
│
├── Film
│   ├── Cinema Camera
│   └── Film / Media Elements
│
├── Digital
│   └── Physical Monitor
│
├── MGRT Hero (wall inscription — the journey's final frame)
│
└── Typography / Spatial UI
```

This is a **logical organization**, not a requirement that every item become a separate React component or scene graph node.

### Persistent architecture
The architectural environment should remain present through the entire cinematic journey. The same floor, structural forms, light source, atmospheric space, material language, and spatial scale should connect the acts.

Changes in visibility should primarily be caused by camera movement, object movement, occlusion, light direction, depth, scale, or atmospheric perspective — rather than swapping environments.

### Object lifecycle
Major objects should have intentional lifecycle states:

```text
HIDDEN → DISCOVERED → PRIMARY → SECONDARY → OBSCURED / DEPARTING → HIDDEN
```

An object should not simply appear because a scroll threshold was crossed. Its reveal should be produced through the cinematic timeline and physical composition.

### Camera architecture
The camera system should support continuous control of position, rotation, field of view, target/look direction, depth of field where appropriate, and near/far clipping planes where necessary.

Camera movement should be deterministic and reversible. The implementation must allow the visitor to scroll forward to progress the timeline and scroll backward to reverse it, without entering invalid intermediate states.

### Former billboard reveal (removed)

The Campaigns act — a render-to-texture billboard reveal onto an exterior highway, the Return dive back through it, and the closing frame after it — was removed on 2026-09-15, together with its exterior environment, assets, loading code and navigation. The experience now ends at the MGRT hero inside the room. See `build-status.md` for the removal record.

### Scene state
The cinematic sequence should use a normalized progress value:

```text
0.0 ────────────────────────── 0.9
OPENING                  MGRT HERO (END)
```

As implemented (`src/experience/timeline/filmActBeats.js`):

```text
0.00 — 0.12    Exterior orbit outside the pillars (intro cinematic)
0.12 — 0.45    Descent to the Film lens (Film at 0.45)
0.45 — 0.60    Film → Digital hand-off (Digital at 0.60)
0.60 — 0.90    Traversal to the MGRT hero (hero at 0.90)
```

The journey ends at `JOURNEY_END_T` (= `HERO_T`, 0.9). These values kept the positions they had when the timeline continued to 1.0, so the pacing of every remaining move is unchanged; the camera path, its distance tables, the scroll-to-progress mapping and the page's scroll length (`3 × 0.9` viewport heights) all end at 0.9, and progress is clamped there.

The important architectural rule is that **the experience is driven by continuous progress rather than independent section triggers**.

### Scope of the normalized timeline

The normalized progress value maps only to the scroll-driven cinematic sequence — the opening through the MGRT hero. It does not extend into the Explore layer.

Reaching the hero (`JOURNEY_END_T`) signals that the cinematic sequence is complete. Any transition into Explore (Work / About / Contact) is a separate application-level state change, consistent with the Application Architecture in Section 4 — not a continuation of the same progress value.

### No unnecessary scene complexity
The scene should not contain geometry, lights, textures, effects, or animation systems that do not contribute meaningfully to the cinematic composition.

Every major technical feature should answer: **what does this add to the visitor's experience?** If the answer is unclear, it should not be implemented.

---

## 6. Camera & Scroll System

The camera is the primary instrument through which the visitor experiences the MGRT world. The entire cinematic sequence should feel like a **single continuous camera journey through one physical environment**, consistent with the spatial interaction model established by the Musée reference. The camera should never feel like it is switching between separate website sections.

### Scroll as a cinematic timeline

Scroll position controls a normalized cinematic progress value.

```text
USER SCROLL
     ↓
NORMALIZED PROGRESS
     ↓
CAMERA / LIGHT / OBJECTS / ATMOSPHERE / TYPOGRAPHY / MEDIA
     ↓
RENDERED FRAME
```

The scroll system should behave like a **scrubbable film timeline**. Scrolling forward progresses the experience; scrolling backward reverses it. The same intermediate states must remain valid in both directions.

### Continuous interpolation
Camera properties should be continuously interpolated from one cinematic state to another. Do not rely on independent trigger-based animations such as `onEnter → play` / `onLeave → reverse` for major cinematic movement. Instead, the camera should derive its state from the current timeline position.

This ensures smooth forward scrolling, smooth reverse scrolling, reliable changes in scroll direction, no animation desynchronization, no one-time animation failures, and no unexpected camera resets.

### Camera movement
The camera should behave like a physical cinema camera mounted on a controlled dolly, crane, or motion-control system. Movement may include forward travel, pull-backs, lateral movement, controlled elevation changes, subtle rotations, changes in framing, and controlled field-of-view changes.

Movement should be deliberate rather than mechanically linear. Use smooth interpolation and carefully controlled acceleration/deceleration.

### Camera look direction
Camera position and camera orientation should be treated as related but independently controllable properties. The camera may travel past an object while looking toward it, approach an object while gradually changing its framing, pull away while maintaining visual attention on a subject, or reveal architectural context through a controlled change in orientation.

Avoid simple "orbit around object" behavior unless specifically required by the cinematic sequence.

### No camera teleportation
The camera must not visibly jump between predefined scene positions.

**Avoid:** `CAMERA STATE A → instant reset → CAMERA STATE B`
**Prefer:** `CAMERA STATE A → continuous movement → CAMERA STATE B`

If a dramatic change in perspective is required, it should be achieved through physical camera movement, occlusion, darkness, architectural framing, or another visually motivated mechanism.

### Scroll smoothing
Scroll input may be smoothed, but smoothing must not create noticeable lag between the visitor's input and the cinematic response. The system should feel **responsive → controlled → physical**, rather than **input → delay → animation catches up**.

Any smoothing should be tuned carefully for both mouse-wheel and touch scrolling.

### Momentum scrolling
Natural browser scrolling behavior should be respected. The cinematic system must remain stable when the visitor scrolls slowly, scrolls quickly, flicks on a trackpad, uses momentum scrolling, changes direction rapidly, stops suddenly, or reverses direction. The experience must not depend on a user scrolling at a particular speed.

### High-refresh displays
Animation must be frame-rate independent. The experience should not assume a 60fps display. Motion must remain visually consistent on 60Hz, 90Hz, 120Hz, and higher-refresh displays.

Do not artificially cap animation quality to 60fps unless required as an adaptive performance measure.

---

## 7. Animation Architecture

Animation should be driven primarily by **cinematic state**, not by a large collection of independent animation systems.

### Single cinematic timeline

The primary experience should have one master timeline representing the visitor's progression through the world.

```text
0.00 ── INITIAL REVEAL ── FILM ── DIGITAL ── MGRT HERO ── 0.90 (end)
```

Individual properties derive their values from this timeline: camera position, camera rotation, camera field of view, object position, object rotation, object scale, light intensity, light position, light color temperature, fog density, particle visibility, screen brightness, and typography opacity/position.

### Deterministic animation
Given the same timeline progress value, the scene should produce the same visual state. This is critical.

Avoid animations that depend on previous frame history, randomized triggers, one-time event listeners, uncontrolled accumulated transforms, or repeated additive animation — unless they are deliberately isolated from the primary cinematic timeline.

### Example

**Prefer:**
```text
timeline = 0.42
camera.position = interpolate(cameraStart, cameraEnd, 0.42)
light.intensity = interpolate(lightStart, lightEnd, 0.42)
monitor.position = interpolate(monitorStart, monitorEnd, 0.42)
```

**Rather than:**
```text
scroll enters section → start animation → animation changes state
→ another trigger modifies it → reverse requires separate cleanup
```

The first architecture is inherently more reliable for cinematic scroll interaction.

### Animation ownership
Each major animated property should have a clear owner:

```text
Camera Controller     → camera position / rotation / FOV
Lighting Controller    → light position / intensity / color
Film Controller        → camera object state / media
Digital Controller     → monitor state / screen content
Atmosphere Controller  → particles / fog
```

Avoid multiple systems attempting to modify the same property simultaneously.

### React state and GSAP

GSAP timelines must mutate Three.js object properties directly via object references (for example, `ref.current.position`) or drive values inside a `useFrame` loop. Do not dispatch React `useState` updates directly from scroll animation frames — updating component state at 60–120fps from a GSAP `onUpdate` callback forces React re-renders on every frame and produces severe layout thrashing.

React state remains appropriate for infrequent, discrete changes (act boundaries, UI visibility, loaded/ready flags) — not for continuously interpolated per-frame values such as camera position, light intensity, or object transforms.

### Physical motion
Object motion should have a physical explanation. Objects may move into light, pass behind architectural elements, become visible through changing perspective, move deeper into the environment, become obscured by darkness, or increase/decrease in apparent scale through camera movement.

Avoid arbitrary floating, spinning, bouncing, or continuous movement.

### Micro-motion
Subtle environmental motion may exist independently from the main cinematic timeline — extremely subtle dust movement, minor atmospheric drift, very subtle environmental animation. However, these effects must remain low-cost and must not interfere with deterministic cinematic state.

### No animation for animation's sake
If an animation does not communicate discovery, transition, scale, spatial relationship, narrative progression, or environmental life, it should probably not exist.

---

## 8. Lighting & Volumetric Effects

Lighting is one of the most important technical systems in the MGRT experience. It must support the physical architectural environment and provide continuity throughout the entire cinematic sequence.

### Primary directional light
The opening directional light should behave like a physically motivated architectural light source. It should enter from a believable direction, illuminate architectural surfaces, create shadows, reveal dust, establish depth, and remain part of the environment throughout the experience.

The primary light should not be treated as a section-specific effect.

### Continuous lighting state
Lighting properties should be derived from cinematic timeline progress — light position, light direction, intensity, color temperature, shadow behavior, volumetric contribution, and atmospheric interaction. These properties must change continuously.

### Critical Film → Digital requirement
The Film → Digital transition must not cause brightness snaps, exposure changes, sudden darkening, sudden brightening, fog jumps, volumetric intensity jumps, color-temperature jumps, or scene reinitialization.

The monitor appearing must be caused by **camera movement and spatial discovery**, not by switching to a different lighting configuration.

### Volumetric light
Volumetric lighting should be used selectively to create visible shafts of light through the architectural space. The effect should communicate "light exists in the physical atmosphere" — it should not look like "a glowing post-processing effect."

Volumetric effects should be soft, directional, subtle, physically motivated, and limited to meaningful areas.

### Performance considerations
Volumetric effects can be expensive, particularly on mobile GPUs. The implementation should support adaptive quality — lower volumetric resolution, reduced sampling, reduced effect range, simplified volumetric approximation, or removing secondary volumetric sources.

The primary cinematic light should remain recognizable even when volumetric quality is reduced.

### Exposure
Exposure should remain stable throughout the cinematic sequence. Do not automatically adjust exposure based on scene brightness in a way that creates visible pumping or adaptation. Any exposure changes must be explicitly controlled and smoothly interpolated.

### Shadows
Shadows should contribute to depth and physical credibility. Prioritize shadows that matter to the composition. Do not create excessive dynamic shadow-casting lights simply because the environment contains many objects.

Where possible: use a limited number of shadow-producing lights, use appropriate shadow map resolution, avoid unnecessary shadow casters, and disable shadows on objects where they provide negligible visual value.

---

## 9. Atmosphere & Dust

Atmosphere provides depth and reinforces the architectural scale of the environment. It should remain subtle.

### Dust particles
Dust should be concentrated primarily within areas illuminated by the main light. Particles should be small, sparse, slow, unevenly distributed, softly illuminated, and physically plausible.

Avoid creating a uniform particle field across the entire scene.

### Particle behavior
Dust should have subtle motion rather than obvious animation. The viewer should notice the atmosphere gradually rather than immediately identify a "particle effect." Particles may use controlled pseudo-random distribution, but the visual state must remain stable enough that the scene does not visibly change every frame.

### Performance
Particle count should be adaptive.

**Desktop** may support higher particle density, more depth variation, and greater atmospheric detail.
**Mobile** may use fewer particles, simpler particle rendering, reduced depth range, and reduced opacity complexity.

The narrative effect must remain intact.

### Volumetric interaction
Dust should be most visible when intersecting the primary light:

```text
DARK SPACE → LIGHT ENTERS → DUST BECOMES VISIBLE
```

rather than dust existing everywhere uniformly.

### Atmospheric depth
Fog or atmospheric depth may be used to create spatial separation and architectural scale. Fog density must remain continuous throughout the cinematic timeline. Never change fog settings abruptly at section boundaries.

### Visual restraint
If the visitor immediately thinks *"there are particles everywhere,"* the effect is too strong. The desired reaction is *"there is something in the air."*

---

## 10. Materials & Rendering

Materials should reinforce the physical architectural character of the MGRT environment.

### Material philosophy
Materials should look physically believable rather than technically elaborate. Preferred materials include cast concrete, architectural stone, dark brushed metal, dark-anodized aluminum, smoked glass, matte surfaces, and light-absorbing architectural finishes.

### Physically based materials
Use physically based rendering where appropriate. Material properties should be controlled through base color, roughness, metalness, normal/detail information, environment reflections, and transmission where necessary.

Do not add complex shader systems unless they create a visible improvement.

### Concrete and stone
Architectural surfaces should contain subtle variation. Avoid perfectly uniform surfaces. Useful detail may include roughness variation, fine surface texture, small imperfections, and subtle tonal variation.

Avoid excessive displacement or extremely high-resolution textures where the viewer cannot perceive the additional detail.

### Metal
Metal should remain restrained. Dark metal should primarily communicate form, reflection, edge definition, and material contrast.

Avoid exaggerated metallic reflections or sci-fi chrome.

### Glass
Glass should be used selectively. Smoked glass and monitor glass should communicate physical depth and reflection.

Avoid expensive transmission/refraction effects if they provide minimal visible improvement, particularly on mobile.

### Texture strategy
Textures should be optimized for actual viewing distance. Use appropriate texture resolution, compressed texture formats where supported, mipmaps, efficient UV layouts, and shared textures where possible.

Do not use 4K/8K textures simply because they are available.

### Geometry strategy
Models should be optimized for the cinematic camera. High geometric detail should be reserved for objects that approach the camera closely, receive important lighting, are visually dominant, or require detailed silhouettes.

Background architectural geometry can use substantially lower complexity.

### Level of detail
Where useful, implement different levels of detail:

```text
CLOSE CAMERA     → HIGH DETAIL
MEDIUM DISTANCE  → MEDIUM DETAIL
BACKGROUND       → LOW DETAIL
```

LOD should not produce visible popping. Transitions between detail levels should remain visually stable.

### Rendering priority

Rendering resources should be prioritized in this order:

```text
1. Camera smoothness
2. Lighting continuity
3. Major object silhouettes
4. Composition
5. Materials
6. Atmosphere
7. Secondary effects
```

If performance becomes constrained, reduce lower-priority rendering complexity before compromising camera movement or the primary lighting system.

### Post-processing
Post-processing should be restrained. Potential effects include subtle color grading, controlled bloom where appropriate, mild depth of field, and very subtle vignette.

Avoid stacking multiple expensive effects. Post-processing should enhance the physical image rather than make the scene look artificially processed.

### Depth of field
Depth of field may be used selectively for cinematic focus. It should never become so strong that text becomes unreadable, important objects disappear into blur, mobile rendering becomes unnecessarily expensive, or the experience feels like a camera filter.

Depth of field should support composition rather than advertise itself as an effect.

### Bloom
Bloom should be subtle and reserved for genuinely bright sources. Avoid the common WebGL "everything glows" aesthetic.

The environment should remain predominantly dark, with light gaining impact through contrast rather than excessive bloom.

---

## 11. Portfolio Media Implementation

Portfolio media is part of the cinematic environment rather than a conventional portfolio component. Film and Digital content should be rendered in ways that preserve the physical relationship between the media and the surrounding environment.

### Film media
Film content may be presented as video surfaces, projected imagery, or media associated with the cinema camera and lens transition.

Film media should load progressively, avoid unnecessary simultaneous playback, use appropriately compressed video, support efficient mobile variants where required, pause when no longer visible or relevant, avoid decoding multiple large videos unnecessarily, and maintain visual quality appropriate to the cinematic composition.

Only media contributing to the current cinematic moment should require active playback.

### Digital media
Digital work should be presented primarily through the physical monitor. The monitor may display website imagery, short screen recordings, digital interface sequences, selected project visuals, or interactive demonstrations where technically appropriate.

The monitor should remain a physical 3D object. Screen content should not cause the monitor to behave like a conventional embedded website.

### Media playback
Media playback should be controlled by cinematic state rather than arbitrary DOM visibility.

```text
CAMERA APPROACHES MEDIA → MEDIA PREPARED → MEDIA PLAYS / BECOMES VISIBLE
→ CAMERA LEAVES MEDIA → MEDIA PAUSES / RELEASES RESOURCES
```

Do not keep every video playing throughout the entire experience.

### Video behavior
Where video is used: prefer muted playback where autoplay is required, use appropriate `playsinline` behavior on mobile, avoid unnecessary audio tracks in video files, use efficient codecs and resolutions, provide poster imagery where appropriate, avoid loading full-resolution media before it is needed, and pause or unload media when appropriate.

The cinematic experience must remain functional if video playback is unavailable or delayed.

### Media fallback
Every important media element should have a fallback representation:

```text
VIDEO AVAILABLE            → PLAY VIDEO
VIDEO UNAVAILABLE/NOT READY → STATIC FRAME / POSTER
MEDIA FAILURE               → CONTINUE CINEMATIC EXPERIENCE
```

A failed portfolio video must never stop the main cinematic timeline.

---

## 12. Audio Implementation

Audio is an optional enhancement to the cinematic experience, not a requirement for understanding or completing it.

### Audio architecture
Audio should remain independent from the primary visual timeline while still responding to cinematic state. Potential audio layers include architectural room tone, environmental atmosphere, subtle reveal cues, and transition cues.

Avoid creating a continuous soundtrack that dominates the experience.

### User control
Audio must never create an unexpected experience. If sound is implemented: provide a clear mute/unmute control, respect browser autoplay restrictions, start audio only when permitted, remember the visitor's audio preference where appropriate, and ensure the cinematic sequence remains complete without audio.

### Audio synchronization
Audio cues should be associated with cinematic progress rather than arbitrary DOM events — for example, a light-reveal timeline position triggering a subtle audio cue. Audio should not drift away from the visual timeline.

### Performance
Audio files should be appropriately compressed and loaded according to their importance. Do not preload unnecessary audio assets simply because they may eventually be used.

### Reduced motion / accessibility
Audio must not be used to compensate for reduced visual motion. Visitors using reduced-motion settings should still receive a coherent experience. Audio controls should remain accessible and understandable independently of the 3D scene.

---

## 13. Asset Loading & Optimization

Loading should be treated as part of the experience rather than as a separate technical event. The visitor should encounter the **void**, not a conventional loading screen.

### Loading philosophy

```text
INITIAL REQUEST → DARKNESS → OPENING IMAGE → ESSENTIAL ASSETS PREPARE → LIVE SCENE READY → CROSSFADE → ACT 0
```

The opening image is the scene's own first frame (see "The opening image and the handover" below), so what appears early is the room itself, never a splash, logo or progress indicator.

The visitor should never see unfinished geometry, broken materials, placeholder objects, or incomplete lighting.

### Asset priorities

Assets should be divided into priority levels.

**Critical** (required for the initial environment and Act 0): core architecture, primary lighting, initial camera, essential environment materials, initial typography.

**Near-term** (required shortly after the opening): cinema camera, Film media, monitor, Digital media.

**Deferred** (required later in the experience): secondary environmental details and lower-priority effects. Every model and surface the room shows is present in the opening frame, but not every one of them is there at full resolution: the two props and the sky arrive at the size the opening composition can actually resolve and are upgraded in place afterwards (below). The chapter videos load only when their beat plays.

### Boot quality and the upgrade (2026-09-16)

The opening shows the film camera at about 3% of the frame's width and the monitor at roughly forty pixels, so their 1024px maps cannot be resolved until the close-ups at `FILM_FOCUS_T` (0.45) and `MONITOR_SNAP_T` (0.60). Those files therefore ship at 256px inside the GLB, with the full-resolution maps beside them as separate files; the sky ships as a 512x256 downsample of the same HDRI. `deferredAssets.js` installs the real ones once the room is on screen, ordered by the beat that needs them:

```text
camera maps (FILM_FOCUS_T) -> sky 1K (FILM_FOCUS_T) -> monitor maps (MONITOR_SNAP_T) -> brass (hero)
```

Three rules make the exchange invisible, and each of them came from a measurement rather than a precaution:

- **Upload one texture per frame.** Sending a model's six maps to the GPU in one callback cost a 170ms frame.
- **Never change `scene.environment`'s identity.** three recompiles every material that samples the environment when that texture changes, which cost sixteen program links and a 192ms frame. The boot sky is upsampled before prefiltering so that both PMREM passes are the same size, and the upgrade re-renders the original into the same render target — see `environmentSource`.
- **Never replace a null texture slot.** Every slot upgraded is one the GLB already filled, so the material's program is unchanged. Shipping the models bare would have meant a recompile the first time each was drawn.

The exchange is one-way: once installed, full-resolution maps stay for the session, so back-scrolling and direct navigation always find them. A jump straight to a section holds the move until that section's own maps exist rather than flying to a degraded close-up (`ensureSectionAssets`); the sky is deliberately not part of that wait, because it is the light on the room rather than the subject of the shot, and including it made a click on a 400kbit connection wait 46 seconds instead of 8.

`asset-sources/` holds the originals, and `scripts/build-prop-assets.mjs` / `scripts/build-sky-boot.mjs` regenerate everything that ships. `digital-stone.glb` carries no textures at all: `useStonePedestal` replaces its material and re-projects its UVs, so the maps it used to embed were downloaded on every visit and never sampled.

### Progressive loading

```text
ESSENTIAL ENVIRONMENT → INITIAL EXPERIENCE → FILM MEDIA → DIGITAL MEDIA
```

The visitor should be able to begin the experience without waiting for every downstream asset to be fully loaded. However, the cinematic timeline must never reveal an asset before its required resources are ready.

### The opening image and the handover (2026-09-19)

The page used to be black until the 3D scene was ready — 4.3s on Fast 4G and
20s on Slow 4G. It now shows the room from about a second in, as an image, and
hands over to the live scene when that is ready.

**The image is the first live frame, not a picture of the room.** It is taken
from the running build by `scripts/capture-opening.mjs` at the moment the
scene is revealed: progress 0, the boot-quality textures and sky the reveal
uses, the same post-processing, before any deferred upgrade begins (the script
refuses to write an image if one has), and with every DOM overlay hidden — the
wordmark, navigation and grain stay real elements. **Re-run it whenever the
opening frame changes** — lighting, props, textures, the camera's start pose —
or the handover will show the difference.

It is captured at DPR 1.75, the renderer's own cap. A first version captured
at DPR 1 was visibly softer than the live frame on a Retina screen, and since
depth of field, GTAO and the dust are sized in device pixels it was not just
softer but differently blurred: the crossfade read as a focus pull.

Three compositions, because the camera's field of view is fixed VERTICALLY: a
frame captured at a wide aspect, shown with `object-fit: cover`, is exactly
what the camera renders at any narrower aspect — the same projection, cropped
at the sides — but never valid for a wider one, where cover would zoom it.

```text
composition   captured (device px)   serves aspects      bytes
ultrawide     5600x1575 (32:9)       above 2:1          157,038
landscape     3150x1575 (2:1)        3:4 to 2:1         122,258
portrait      1108x1477 (3:4)        below 3:4           38,542
```

Only the matching `<source>` is fetched, and it is discovered by the preload
scanner from `index.html`. WebP only: AVIF was 2-4% smaller, not enough for a
second format and a slower decode. An explicit `rel=preload` for the image was
tried and moved its decode by 45ms on Fast 4G while making mobile slower — the
image shares the pipe with the scene's own preloads, and ordering does not
change that — so it was not kept. What does change it is not starting those
preloads until the image has arrived: see "The startup timeline, measured
again" below.

**The handover is the cover's existing fade.** The image lives inside
`#startup-cover`, whose 400ms fade already was the reveal, so fading it now
crossfades the image into the canvas rendering the same frame underneath. The
image occupies exactly the canvas's box — same origin, `100vw`, and the same
`--app-height`, which `index.html` now sets from its first line so the two
agree before any bundle has loaded. Measured against the live frame it
replaces, with UI hidden in both:

```text
viewport            luminance   mean |diff|   best alignment shift   worst tile
1440x900 @2          +0.08%       1.29/255         0,0                 4.7
1920x1080 @1         +0.51%       1.30/255         0,0                 4.7
390x844 @3           +0.24%       1.53/255         0,0                 7.2
1024x1366 @2         +0.05%       1.78/255         0,0                 8.7
2560x1080 @1         +1.09%       1.56/255         0,0                14.0
```

The residual is the dust, which is frozen in the image and drifting in the
scene, plus WebP's smoothing of the finest column texture. Tablet portrait is
the softest match: it enlarges the phone-sized portrait image by ~1.85x.

**Input.** Nothing moves the camera until the crossfade has FINISHED —
`revealStartupCover`'s `onRevealed` — so image and live frame are never on
screen out of register. Until then, input is recorded rather than lost:
`startupCover.js` listens from the main bundle, long before the scene exists,
and keeps only the latest intent, as a direction. Measured: twelve hard wheel
ticks while loading become exactly one step (to the intro alignment) after the
handover, and a section chosen by keyboard before the reveal is flown to once
it completes. The camera stays at the image's pose throughout. There are no
non-3D links on `/` to keep working — the wordmark and side navigation both
drive the timeline.

**Failure** keeps the image and shows the existing retry over it. A missing
image simply leaves the page black until the reveal, as before.

**Cost**, measured locally against the build without it, same serving — an
HTTP/1.1 test server, which production is not; the next section supersedes
these absolute times:

```text
                          image visible   live scene     live scene delayed by
Fast 4G (9 Mbps)              1.43s          4.41s             +100ms
Slow 4G (1.6 Mbps)            5.87s         20.56s             +600ms
phone, Fast 4G                1.01s          4.33s              +40ms
cold local                    0.40s          0.89-1.00s        within noise
warm cache                    0.40s          0.90-0.97s        none
```

The delay is the image's bytes sharing the connection with the scene's; a
smaller, softer image cost less (+66ms / +396ms) but did not match. And the
experience now accepts input about 0.4s later than before, because it waits
for the crossfade to end — deliberately, and without dropping what the visitor
did in the meantime.

### The startup timeline, measured again (2026-09-19)

**Conditions.** Every number here is from these, and the earlier tables in this
document are not comparable with them unless they say the same:

```text
server    HTTP/2 + TLS, brotli on text/GLB/HDR, immutable assets (production: h2,
          verified; production's own Slow 4G run matched the local one to ~0.2s)
Fast 4G   9 Mbps down / 1.5 Mbps up / 60ms latency     (Chrome network emulation)
Slow 4G   1.6 Mbps down / 750 kbps up / 150ms latency
CPU       unthrottled M-series Mac, or 4x throttling where it says "phone 4x"
viewport  desktop 1440x900 @2; phone 390x844 @3, touch
cache     cold = fresh profile per run; warm = same profile, second load
```

Earlier reports mixed labels: some ad-hoc runs called 1.6 Mbps "Fast 4G" and
400 kbps "Slow 4G", and the table above was served over HTTP/1.1. Over
HTTP/1.1 the six-connection limit happened to queue the scene's files behind
the image; over HTTP/2 everything starts at once. That is why the image took
5.87s there and **9.5s** on HTTP/2 and on production.

**Why the image was slow.** Not discovery, decoding, CSS, fonts, JavaScript or
readiness: it was requested at 170ms and decoded in 30ms. It shared the link.
The scene's fourteen preload hints were written into `<head>` and started at
the same instant, so 122 kB competed with ~3.5 MB, and the image finished at
9.5s on Slow 4G. The hints are now `startHeroPreloads()`, which the image's own
load (or error) handler calls. The link stays full either way — the image's
bytes were always on it — so the scene loses at most one round trip, and only
where nothing else is downloading at that moment (the phone, where the
portrait image is small). The image never waits for three.js, the app bundle
or the scene — with the experience's chunk blocked it still appears — only for
its own decode, which a one-line inline handler reports.

**What the frame before the reveal was doing.** A trace attributed the 364ms
long frame just before the reveal (not after it: the frame ends before the
fade starts, so it delayed the reveal rather than freezing a visible frame):

```text
work in that frame                                   before    after
nine stone maps decoded synchronously by texImage2D   120ms      0  (decoded to
                                                                     ImageBitmaps
                                                                     on workers)
~20 shader programs linked one at a time              ~180ms   ~80ms wait (compiled
                                                                     in one batch
                                                                     beforehand)
```

- The stone maps are fetched and decoded to `ImageBitmap`s in
  `scannedStone.js`. `img.decode()` was tried first and does nothing here: the
  upload decodes again. Bitmaps are flipped at decode, since WebGL ignores
  `flipY` for them, and the browser is TESTED for that rather than assumed from
  its user agent (a 1x2 image must come back flipped); one that fails keeps the
  `<img>` path. Both paths were compared against the previous build, pose-locked
  and median-combined, and differ from it no more than it differs from itself.
  The bytes are read with `arrayBuffer()`: `response.blob()` on a response
  served from one of the HTML's preloads failed ("Failed to fetch") in every
  throttled Chrome run, which silently fell back to procedural stone and
  downloaded every map twice (+1.5s).
- `SceneReady` compiled the scene with no render target bound. three keys a
  program on that (tone mapping, output colour space), and the composer draws
  the scene into a target, so every program `gl.compile` built was the wrong
  variant and the first frame linked the right ones again, serially. It now
  binds a 1x1 target for the compile.

Found in the same traces, both of them after the handover, in full view:

- **The brass wordmark** gained `map` and `roughnessMap` when its deferred maps
  arrived, which changed its program: a 74ms link ~1.8s after the reveal. It now
  starts with one-texel stand-ins that change nothing (the scan's own mean,
  which the aged-brass shader divides out, and a roughness of 1), so the swap is
  a reference assignment — the same "never fill a null slot" rule as the props.
- **Cormorant** is only downloaded when something uses it, which was the scene
  mounting; its arrival repainted the wordmark's maps, a ~100ms task that landed
  on the crossfade. `index.html` now asks for both weights once the stylesheet
  and the opening image have arrived, and the inscription paints once when the
  face is already loaded instead of painting twice.

**Results**, the build before this work against the build after, same server:

```text
                              image visible     live 3D ready       interactive
Slow 4G desktop               9.56 -> 2.06s    20.04 -> 19.94s    20.45 -> 20.34s
Fast 4G desktop               1.83 -> 0.34s     4.32 -> 4.05s      4.72 -> 4.45s
phone 4x, Fast 4G             0.72 -> 0.25s     6.27 -> 5.34s      6.66 -> 5.75s
phone 4x, Slow 4G             3.38 -> 0.81s    20.67 -> 19.95s    21.08 -> 20.36s
cold, unthrottled        0.09 -> 0.06-0.09s   1.01-1.29 -> 0.72s   1.33-1.67 -> 1.10-1.11s
```

(A "warm cache" row stood here and was wrong: the local HTTP/2 server uses a
self-signed certificate, and Chrome does not cache responses from an origin
with a certificate error, so those "warm" loads were cold. Measured cached
loads are in "Release verification" below.)

"Image visible" is the first frame the image is drawn at non-zero opacity; its
fade then takes 350ms. Only the matching image downloads in every run.

```text
around the handover (Fast 4G desktop)          before     after
frame containing the reveal                     191-203ms   67-70ms
main-thread work in the 4s before the reveal    1174ms      874ms
worst frame during the crossfade                22ms        22ms
worst frame in the first 1.5s live               23-24ms     23-25ms
queued input -> first scroll write               at handover end (0ms), drawn +21ms
input just after handover -> first write         65ms, drawn +20-21ms (both builds)
```

**Remaining.**

- The frame before the reveal still waits ~80ms for the GPU process to finish
  the batch compile, and the post-processing passes (built by the composer
  after the scene) link ~10 programs on their first use (~50ms). Both are
  behind the image. `compileAsync` does not help on this platform: its status
  query is itself a synchronous round trip into the same GPU queue.
- The React commit that builds the scene (~400ms unthrottled, including the
  wordmark's canvas maps) is unchanged, also behind the image.
- Rotating a phone mid-load starts the other composition's image while the
  scene's files are downloading. Over HTTP/2 it arrives in ~0.45s (0.35s
  before); over HTTP/1.1 it queues behind six busy connections and took 13s.
  Production is HTTP/2.
- On an unthrottled local load the font can still arrive after the scene has
  mounted, and the wordmark then repaints (~50-100ms) around the reveal. On
  every throttled profile it arrives first.
- Chrome's own FCP does not register the image while it fades from opacity 0,
  and LCP never can — see "What FCP and LCP measure on this page" below.
- Safari: see "Release verification" below. The bitmap path is guarded by a
  runtime test rather than a version number because it could not be verified.

### Release verification (2026-09-19)

**Version.** `9f2ce3b`, clean working tree, one commit ahead of `origin/main`.
Production (mgrtmedia.com) still serves `9ee9645` — its entry chunk is
`index-B7L5Saqj.js` and its HTML has no `startHeroPreloads` — so everything
below labelled HEAD is local, and production numbers are the previous build.
**Deploying `9f2ce3b` is what brings the HEAD numbers to production.**

**Startup** (Chrome, conditions as above; cached = second load in the same
profile, over plain HTTP locally so the cache works):

```text
                          image starts   image full   scene files done   live 3D    interactive
HEAD  Fast 4G cold           0.33s          0.63s          3.59s          4.03s        4.44s
prod  Fast 4G cold           1.94s          2.25s          3.77s          4.49-4.56s   4.91-4.97s
HEAD  Slow 4G cold           2.05s          2.35s         19.78s         19.95s       20.37s
prod  Slow 4G cold           9.71s         10.02s         20.29s         20.56s       20.98s
HEAD  cached (either)        0.07s          0.35s          0.03s (0 B)    0.71-0.73s   1.11-1.14s
prod  cached (either)        0.28-0.32s*    —              0.22s          1.18-1.23s   1.58-1.65s
```

"Starts" and "full" are from trace filmstrips, which agreed with the page's
own opacity readings to within 10ms on cold loads (* production's cached
start is the page's own reading; no filmstrip was taken there). On cached loads the page's
reading is late (the scene's mount task starves it), and the filmstrip — the
image full by ~350ms — is the one to trust. The crossfade shows no brightness
step in the filmstrip. Production is a real network behind the emulation, so
it is not a like-for-like comparison with local; the earlier local A/B is.
HEAD starts the scene's downloads only when the image arrives (0.29s / 2.0s),
and they still finish earlier than production's, which start at ~0.2s.

**The preloads still start** after an image that fails (404: started 6ms
after the failure), from a cached image (at 11ms), and after a responsive
switch before the first image loaded (landscape to portrait: only the portrait
image was fetched, the preloads started when it arrived, each file once).

**Section click right after the handover** waits until that section's
full-resolution maps are installed (`ensureSectionAssets`), identically in
HEAD and production. Nothing on screen acknowledges the click meanwhile:

```text
click 0.3s after handover   Film            Digital
Fast 4G                     0.50s (0.78)    0.95s (0.93)       (production)
Slow 4G                     2.14s (2.14)    4.05s (4.07)
```

**Input during the long loading interval** (Slow 4G, 5s in, trusted events):
there is nothing to click or focus — until the scene's files have arrived,
`Home` renders nothing, so the image is the only thing on the page. A click
where the section marks will be lands on the image and does nothing, and no
navigation happens later. Twelve wheel ticks (or Arrow/Space) become one step,
drawn the moment the handover ends — 15.8s after the input. Forward then back
cancels. This is queued intent, not interaction.

**Also verified (Chrome):** reduced motion (no fade, instant handover), the
failed experience chunk (image kept, message, focused retry), a failed image
(normal reveal), stale intent from `/work`, keyboard navigation to a section
during warm-up, leaving `/` for `/work` during the load and coming back
(no errors, no stray scroll, one canvas), and rotation — the other image
arrives in 0.40-0.45s over HTTP/2 (production: 0.55s).

**Not verified, and why:**

- **Safari** — verified afterwards, see "Safari 27 (macOS)" below; only
  reduced motion remains untested there.
- **Real mobile.** No iPhone or iPad was connected and Xcode (so the iOS
  Simulator) is not installed. Every mobile number in this document is Chrome
  device emulation.

### In production (deployed 2026-09-19)

`4074288` is live on mgrtmedia.com (code identical to `9f2ce3b`). The deployed
`index.html` and all 26 files it references — every JS chunk, the stylesheet,
the three opening images and the fourteen scene files — are byte-identical to
the tested build. Measured against production itself, Chrome, same profiles;
"before" is the previous deployment measured the same morning:

```text
                      image starts         live 3D                 interactive
Fast 4G cold       1.93-1.96 -> 0.41s   4.49-4.56 -> 4.41-4.53s   4.91-4.97 -> 4.85-4.98s
Slow 4G cold            9.71 -> 2.06-2.11s  20.55-20.58 -> 20.61-20.69s  ~21.0 -> 20.99-21.09s
cached (both)      0.28-0.32 -> 0.26-0.35s  1.18-1.23 -> 0.92-1.01s  1.58-1.65 -> 1.32-1.43s
phone 4x, Fast 4G          -> 0.36s                  -> 5.80s                 -> 6.21s
```

- The image is fully in by 0.70s (filmstrip, Fast 4G cold).
- On Slow 4G production the live scene is ~0.05-0.14s later than before: the one
  round trip the scene's downloads now wait for, which the local HTTP/2 A/B did
  not show. Everything else is the same or earlier.
- Handover against the live frame: 1440x900 @2 mean 1.29/255, 390x844 @3 1.53,
  best shift 0,0 in both — as locally.
- A section click right after the handover moves after 0.63s (Film) and
  1.36-1.38s (Digital) on Fast 4G, 4.49s (Digital) on Slow 4G. The old and new
  builds wait the same locally over HTTP/2 (1.33-1.38s); it is the wait for
  that section's full-resolution maps.
- Wheel input during the load: one step at the handover (15.6s after the
  input on Slow 4G); forward then back cancels. Failed experience chunk, failed
  image and reduced motion behave as locally.
- A normal visit with three section jumps: no failed requests except
  `/favicon.ico` (404 — the site has none) and the chapter videos' own range
  requests being aborted by the player, which is normal.

### Safari 27 (macOS), verified 2026-09-19

Measured from inside Safari by a same-origin harness page (the site in an
iframe, results posted back to the test server) — Safari's own automation is
off and was left off. Local build of `935aa68` (identical output to
`9f2ce3b`), plain HTTP/1.1 with server-side shaping to the same two profiles,
fresh port per cold run. Safari is slower than Chrome on this server with the
old build as well, so compare within this table only.

```text
                                     old build (prod)   HEAD
Fast 4G cold: image starts                3.95s          0.31s
Fast 4G cold: live 3D                     6.81s          6.55s
Fast 4G cached: image starts / live       0.22s / 1.24s  0.22s / 1.18s
```

- Background decoding: the runtime flip test passes, so Safari takes the
  `ImageBitmap` path; the stone renders the right way up.
- Handover (1728x994 @2): luminance +0.03%, mean difference 1.39/255, best
  shift 0,0, worst 32px tile 11.9 — the same match as Chrome.
- Each file is requested ONCE (server log). Safari's resource timing lists a
  preloaded file twice, once for the preload and once for its reuse; do not
  read those entries as a second download.
- First scroll after the handover moves the camera in the next frame. A section
  click right after the handover moves after 213ms (unthrottled) / 624ms
  (Fast 4G) — the wait for that section's maps, as in Chrome; a later click,
  with the maps in, moves in 1-2ms. Input during loading: one step at the
  handover, nothing clickable before it.
- Image failure (preloads start 11ms after the 404, normal reveal), experience
  chunk failure (image kept, message, focused retry), responsive switch
  (portrait only, preloads after it) and leaving `/` mid-load all behave as in
  Chrome, with no errors.
- **The crossfade is cut short in Safari — before and after this work.**
  WebKit dates a CSS transition from the start of the frame in which the class
  changed, and the reveal is triggered at the end of a long render, so by the
  next paint most of the 400ms has "elapsed": the cover reads 0.12-0.21
  opacity 2-19ms after the class is added and is removed after 81-220ms.
  Production's build is worse (removed after 5-55ms, no intermediate frames).
  Because image and live frame match, it reads as a slight pop, not a jump.
  Likely fix, not yet made: run the fade with the Web Animations API, whose
  start time is taken at the next frame, instead of a class transition.
- Not tested: reduced motion (Safari follows the system setting, not changed).

### What FCP and LCP measure on this page

- **LCP is the wordmark, under the cover.** `BUTTON.site-mark`, 2,127 px², is
  painted when the scene mounts, beneath the startup cover; LCP ignores
  occlusion. Its time is therefore when the scene's files were ready — 3.4s
  cold on Fast 4G, 18.3s on Slow 4G, 0.17s cached — not anything the visitor
  sees.
- **The opening image can never be the LCP.** Chrome ignores an image that
  fills the viewport. Isolated test: the same file at 50% of the viewport is
  reported at 68ms; at 100%, with or without `<picture>`, `alt`,
  `aria-hidden`, a parent's opacity or `object-fit`, it is not reported at all.
- **FCP** misses the image while it fades from opacity 0 (it reports 1.0s or
  3.4s when the filmstrip shows it at 0.33s); with the fade removed it is the
  image, at 0.34-0.37s.

So for this page: visual readiness is the image (filmstrip), interactive
readiness is the end of the crossfade, and LCP/FCP in field data describe
neither. Not changed — the image's full-viewport size is the design, and the
fade was asked for.

### No visible loading interruptions
Do not introduce loading screens between Film, Digital, and the hero. If an asset is not ready when its cinematic moment approaches, the implementation should use an appropriate fallback or controlled pacing rather than exposing a broken state.

### 3D asset optimization
Models should be optimized before entering the application: polygon reduction, mesh compression, texture compression, removal of invisible geometry, material consolidation, efficient UV layouts, shared materials, removal of unused animation data, and appropriate LOD generation.

Measured, and worth knowing before reaching for any of the above again: these GLBs are already meshopt-compressed and quantized, and their textures are already WebP. Re-encoding those textures at their native size made two of the three files LARGER, so on this project resolution is the only remaining lever on texture bytes — and geometry, not texture, is the bulk of every prop file.

### A lighter opening computer — tested and rejected, 2026-09-19

The Digital computer is 64,440 triangles and about forty pixels tall at the
opening, so an opening-only simplified version, swapped for the detailed one
before the approach, looked like an obvious saving. Measured, it is not worth
having, for three independent reasons. Recorded so it is not re-attempted
without new information.

The ceiling was lower than it looked. This model had already been through a
hidden-geometry pass (see `Monitor.jsx`), so there was no internal geometry
left to strip, and its geometry is 505,456 bytes over brotli; the rest of the
751,259-byte file is the 256px boot maps, which are unaffected.

```text
                         tris   startup file (br)   geometry (br)   fit
current                64,440        751,259 B        505,456 B
border-locked LOD      27,414        569,422 B        324,717 B    exact
aggressive LOD         11,885        413,608 B        168,546 B    pedestal footprint moves ~5.7mm/side
```

Simplification stalls near 27k triangles with the border locked, because this
mesh has almost one vertex per triangle — dense UV and normal seams that
meshopt will not collapse across. Unlocking the border reaches 11.9k but moves
the vertices `contactFootprint` reads, which would resize the pedestal at the
swap. `SparkScreen` was left exact in every variant, since its normals and
bounds set the model's yaw, scale and position.

1. **It makes Digital navigation worse, structurally.** A jump to Digital lands
   on the close-up, which must use the detailed model, so the gate would have
   to wait for the detailed geometry as well as the monitor's full maps.
   Measured on a blank same-origin page so nothing else competes (and matching
   the app's own gate within 0.3s): textures alone 15.5s on a 400 kbps link and
   3.8s on Slow 4G (1.6 Mbps); with the detailed geometry 25.4s and 6.3s —
   **+9.9s and +2.4s.** On Fast 4G (9 Mbps) the same 505kB is estimated, not
   measured, at roughly +0.45s. (Corrected 2026-09-19: these were first
   recorded as "Slow 4G" and "Fast 4G" because the probe that took them defined
   those names one step slower than `gpuaudit.mjs` does. Every before/after
   pair shared one profile, so the comparisons stand; only the labels were
   wrong. The canonical profiles are Fast 4G = 9 Mbps / 60ms and Slow 4G =
   1.6 Mbps / 150ms.)
2. **It is visible at the opening.** Pose-locked, median-combined captures:
   the border-locked LOD's worst tile is 7.84 at the computer against a 0.68
   noise floor — the copper casing's front edge catches a brighter, glossier
   highlight, because collapsing faces changes which normals and tangents
   interpolate across them. The aggressive LOD reaches 25.03, opens a hole at
   the casing's front corner and turns the metal silvery.
3. **The startup gain does not pay for either.** Border-locked: 178 KiB less
   before the reveal, Fast 4G 4390 -> 4233ms, Slow 4G 20.1 -> 19.4s. Aggressive:
   330 KiB, 4390 -> 4114ms, 20.1 -> 18.4s. Against that, total-session bytes
   rise by 323,619 B (border-locked) or 167,805 B (aggressive), because the
   detailed geometry still has to follow. Frame time did not change at all —
   the scene's GPU cost is not in this model's triangles.

The runtime swap was therefore not built. None of the three reasons depends on
how well the swap is engineered: the navigation cost is set by bytes that must
arrive before the close-up, and the opening regression is in the asset itself.

### Encoding the room's stone — 2026-09-17

The nine 1024px maps under `public/textures/` are the largest single block in the
startup. Six of them were re-encoded, saving **252.6 kB** with no change of
resolution, and `scripts/build-stone-textures.mjs` rebuilds them from
`asset-sources/textures/`.

**The saving is the quality setting.** Normals at 90 and ORM at 85, against
originals encoded higher than these maps need. Encoder: libwebp 1.6.0 through
sharp 0.35.4 (libvips 8.18.6); every output is a lossy VP8 keyframe, 1024x1024,
no alpha chunk, verified from the RIFF/VP8 bitstream rather than from the
decoded channel count.

**A correction.** The first version of this section, and of the generator's
comments, claimed `smartSubsample` gave 4:4:4 chroma. It does not, and it
cannot: lossy WebP is VP8, and VP8 is always YUV 4:2:0 — there is no
subsampling field in the bitstream. The option maps to libwebp's
`use_sharp_yuv`, a better-conditioned 4:2:0 downsample. Measured on an
alternating-column image whose two colours differ only in chroma, the default
encoder retains 0% of that per-pixel chroma, `use_sharp_yuv` retains 6.6%, and
true 4:4:4 (lossless VP8L) retains 100%.

The option is kept, on measurement rather than on the wrong story that
introduced it: at MATCHED FILE SIZE it is the better encode for five of the six
maps (walls/normal 1.534 vs 1.594 degrees of angular error, columns/normal 1.43
vs 1.844, floors/normal 0.785 vs 0.821, columns/orm 1.570 vs 1.703, floors/orm
1.377 vs 1.469), the exception being walls/orm at 1.123 vs 1.079. It costs about
93kB across the six at a given quality, so the quality drop alone would have
saved ~345kB and this trades ~93kB back for lower chroma error.

Chroma matters here because in these files the channels ARE the data: a normal
map's red and green are the surface's X and Y tilt, and the ORM's red and green
are ambient occlusion and roughness (bound to `aoMap` AND `roughnessMap`; see
`stoneWallMaterial.js`).

```text
                    before      after    saved   setting
walls/normal       496,038    435,256  -60.8kB  q90 4:4:4
columns/normal     423,108    360,716  -62.4kB  q90 4:4:4
floors/normal      185,342    142,680  -42.7kB  q90 4:4:4
walls/orm           69,550     44,508  -25.0kB  q85 4:4:4
columns/orm        201,184    178,176  -23.0kB  q85 4:4:4
floors/orm         171,732    133,024  -38.7kB  q85 4:4:4
TOTAL            1,546,954  1,294,360  -252.6kB
```

Quality is per map type, chosen from how each is used. NORMALS hold at 90:
shading the maps directly under the room's own sun, q85 doubles the share of
texels whose luminance moves by more than 8/255 (walls 4.6% -> 12.8%, columns
5.3% -> 13.8%), and that is the micro-relief the stone is made of, so the extra
~259kB q85 offered was refused. ORM drops to 85 because the same test says it
costs nothing — a q85 ORM moves the wall's mean shading error from 2.623 to
2.655 of 255 — since occlusion and roughness are low-frequency terms.

**Albedo maps are untouched and should stay that way.** Walls' and columns'
re-encode LARGER at any faithful quality, and the floor's saves 4.6kB, which is
not worth a second encoding of a colour map the camera sits inches from.

### Verifying a texture change in this scene

Comparing renders between texture builds is harder than it looks, and two
different measurement mistakes were made here before the numbers meant anything.
Smaller textures load faster, which changes the camera's pose at capture, and
that difference dwarfs the texture's. A first pass "showed" q85 failing badly
(hero worst tile 58.7 against a 0.94 noise floor) purely for that reason.
Choosing the best-matching frame pair to compensate is also not sound: it lets
the comparison pick its own evidence.

The protocol that does work, and what `stoneverify.mjs` in the perf scratchpad
implements:

- prime the HTTP cache first, so both builds load at the same speed
- wait for `prop:camera:swapped`, `sky:swapped` and `prop:monitor:swapped` in
  both, so deferred readiness is identical
- reach beats through the app's own section targets, which land on exact scroll
  positions — record them as evidence (both builds: 0 / 765 / 1020 / 1530 of a
  2430px document)
- hide the DOM UI for material frames and capture it separately
- five frames per beat at fixed spacing, median-combined, which cancels dust and
  grain without freezing the scene
- compare PREDEFINED matching beats, never a best-matching pair
- and run the whole thing baseline-against-baseline first, for a noise floor

Against that floor, the adopted encode measures:

```text
beat      frame mean   worst tile   >8/255      noise floor (mean / worst)
opening        0.221         0.72       0%           0.035 / 0.67
film           0.356         4.71    0.23%           1.091 / 23.47
digital        1.089         8.07    1.12%           4.752 / 35.68
hero           0.481         0.86       0%           0.032 / 0.50
```

Film and Digital sit below their own noise floors — those beats play video, so
they are noisy between any two runs. Opening and hero are the stable ones, and
there the difference is a diffuse ~0.2-0.5/255 across the stone with no
localized artifact at all: worst tile at the noise floor, and not one pixel
differing by more than 8/255. That is what a mild quality reduction should look
like, and it is what grazing-light crops of the hero wall show at 3x zoom —
identical micro-relief, highlight placement and roughness character. UI was
checked separately and is unchanged (fullscreen button max 3/255; the caption's
peak is its fade state at capture, not its glyphs).

The standalone shading test above is supporting evidence for choosing between
candidates, not the acceptance check; the renderer comparison is.

**KTX2 was measured and rejected** (2026-09-16), for the record rather than as a verdict for all time. ETC1S barely moved the bytes (2106KB to 2071KB) while the Basis transcoder adds 260KB gzipped to the critical path, and UASTC was four times worse at 9284KB. In its favour: transcode and upload took 103ms against WebP's 152ms, and VRAM fell from about 48MB to 12MB. If mobile GPU memory ever becomes a demonstrated bottleneck, that trade becomes interesting; while hero readiness is the objective, it is a regression.

### Asset formats
Use modern, efficient formats where browser support permits. 3D assets should generally use optimized glTF/GLB workflows. Textures should use compressed formats appropriate to the target browsers and devices. Video should use efficient web-compatible encoding and appropriately sized variants.

### Caching
Static assets should be cacheable where appropriate. Asset versioning must prevent stale files from being used after deployment.

### Delivery compression — measured in production, 2026-09-16

**Vercel already serves the GLBs compressed. Nothing needs to be added, and pre-compressed siblings would be wasted work.**

This was checked because Vercel's published compression allowlist does not include `model/gltf-binary` — or any `model/*` type — which made it look as though 898 kB of geometry was shipping uncompressed on every first visit. The documentation is not what production does. Measured against https://mgrtmedia.com with a browser `Accept-Encoding`:

```text
                          identity      br (prod)    saved
spark-computer.glb       1,340,544        771,509  569,035
movie-camera.glb           660,572        467,004  193,568
camera-stand.glb           143,096         62,939   80,157
digital-stone.glb          202,360        169,503   32,857
TOTAL                    2,346,572      1,470,955  875,617 B = 875.6 kB
```

Every one comes back `content-encoding: br`, `content-type: model/gltf-binary`,
`cache-control: public, max-age=31536000, immutable`, from the CDN edge. The
`.hdr` boot sky is compressed too (as `application/octet-stream`), and the
WebP textures correctly are not — they are already compressed formats.

Content negotiation is correct: `Accept-Encoding: identity` returns the full
1,340,544 bytes with no encoding, `gzip` returns gzip, `br` returns brotli. The
four files decompress to bytes IDENTICAL to the ones in `public/models`,
verified by SHA-256. No `Vary: Accept-Encoding` is emitted, which is worth
knowing but is not a defect here: Vercel keys its own edge cache by encoding,
which the per-encoding responses above demonstrate.

The startup total before the opening is visible is therefore **4,250,696 B
(4250.7 kB / 4151.1 KiB) across 24 unique network transfers** in production,
against 5,138,865 B locally where `vite preview` sends the GLBs uncompressed.
The difference is entirely this compression.

Units, since an earlier report got them wrong: `kB` is decimal (1000 B) and
`KiB` is binary (1024 B). The transfer counts exclude the ~25 zero-byte
`blob:` and `data:` requests that `GLTFLoader` makes for textures embedded
inside the GLBs; those never touch the network.

---

## 14. Responsive & Mobile Implementation

Mobile is not implemented as a scaled desktop scene. The mobile experience is a separate composition of the same cinematic world.

### Shared narrative
The same sequence must remain:

```text
ACT 0 → FILM → DIGITAL → MGRT HERO
```

The implementation may change camera framing, object placement, scale, visibility, environmental detail, and rendering quality.

### Responsive camera
The camera must respond intelligently to viewport dimensions and aspect ratio. Do not simply apply the desktop camera position to a narrow viewport.

Mobile may require different camera positions, different camera targets, different field of view, shorter or longer camera travel, closer object framing, reduced environmental visibility, or alternative compositions.

### Aspect-ratio changes
The cinematic composition must remain stable across common aspect ratios — portrait phones, landscape phones, tablets, desktop monitors, ultrawide displays. Important objects and typography must not become unintentionally cropped or positioned outside the viewport.

### Mobile object composition
Major objects should remain identifiable on small screens. If an object becomes too small to read visually, the composition should change rather than simply accepting the reduced visibility.

### Mobile typography
Typography must remain readable while preserving the architectural character of the experience. Use responsive sizing and positioning rather than fixed desktop dimensions.

### Touch interaction
The primary interaction remains natural page scrolling. The experience must behave correctly with slow touch scrolling, fast flick gestures, momentum scrolling, direction changes, partial scroll gestures, and interruptions during transitions.

The cinematic timeline must remain synchronized with the actual scroll position.

---

## 15. Adaptive Performance & Quality Scaling

The full desktop experience represents the highest intended rendering quality. Lower-powered devices may require intelligent reduction of visual complexity. Quality reduction must be **progressive rather than binary**.

### Quality hierarchy

```text
LEVEL 1  Full cinematic quality
LEVEL 2  Reduced secondary effects
LEVEL 3  Reduced atmosphere / reflections / post-processing
LEVEL 4  Simplified materials / geometry / particles
LEVEL 5  Essential cinematic fallback
```

The goal is to preserve the story at every level.

### Features that may be reduced
Particle count, volumetric resolution, shadow resolution, reflection quality, texture resolution, geometry complexity, post-processing, depth-of-field quality, secondary lights, atmospheric effects, and screen effects.

### Features that should be protected
Core camera movement, major object visibility, narrative progression, lighting continuity, the Film → Digital transition, the final MGRT identity, and basic typography hierarchy.

### Adaptive quality should be measured
Quality changes should be based on meaningful performance signals rather than arbitrary device labels whenever practical — sustained frame-rate degradation, rendering time, GPU pressure indicators where available, device capability, viewport size, or memory constraints.

Do not repeatedly change quality settings during normal interaction in a way that becomes visible to the visitor.

### Performance stability
A stable lower-quality experience is preferable to a constantly fluctuating high-quality experience. Quality adaptation should therefore use controlled thresholds and avoid rapid switching.

---

## 16. Viewport, Resize & Orientation Handling

Viewport changes are a critical part of the technical implementation, particularly on Safari and mobile browsers.

### Resize behavior
The scene must respond correctly when browser dimensions change, desktop windows are resized, device orientation changes, browser UI expands or collapses, mobile viewport dimensions change, or device pixel ratio changes.

### No resize jumps
Resizing must not cause camera teleportation, object jumps, incorrect aspect ratio, lighting changes, typography displacement, scene reinitialization, or scroll position resets.

### Resize architecture
Viewport dimensions should be treated as application state:

```text
VIEWPORT CHANGE → UPDATE CAMERA → UPDATE RENDERER → UPDATE RESPONSIVE COMPOSITION → PRESERVE CINEMATIC PROGRESS
```

The current cinematic timeline position must remain valid during a resize.

### Browser viewport instability
Mobile browsers may dynamically change the visible viewport when browser chrome appears or disappears. The implementation must avoid interpreting every transient browser UI change as a meaningful cinematic layout change.

Viewport calculations should use appropriate modern browser viewport APIs and be tested against real mobile browser behavior.

### Viewport units

Pin the WebGL container using fixed dimensions or dynamic viewport units (`100dvh`) rather than `100vh`, or cache `window.innerHeight` on initialization and reuse it rather than reading it continuously during scroll. Prevent dynamic URL bar collapse or expansion from triggering a global canvas resize and camera recalculation while the visitor is actively scrolling — this is a common source of visible camera snaps on mobile Safari and Chrome.

### Device pixel ratio
Rendering resolution should account for device pixel ratio without allowing extremely high-density displays to create excessive GPU load. Where necessary, cap effective rendering resolution while maintaining visual quality.

---

## 17. Safari & Cross-Browser Compatibility

Safari is a first-class target and must not be treated as a final compatibility check. The cinematic experience should be tested throughout development on Safari macOS, Safari iOS, Chrome macOS, Chrome Android, and other major Chromium-based browsers where relevant.

### Safari priorities
Particular attention should be given to WebGL performance, resize behavior, dynamic viewport dimensions, scroll behavior, momentum scrolling, video playback, autoplay restrictions, color management, high-refresh displays, WebGL texture limits, memory pressure, GPU performance, and CSS/WebGL synchronization.

### Safari animation stability
Do not add browser-specific hacks unless an actual reproducible issue requires them. If Safari behaves differently, first identify whether the root cause is excessive rendering cost, layout thrashing, resize handling, scroll synchronization, animation architecture, browser-specific WebGL behavior, video decoding, or CSS/WebGL coordination. Fix the underlying architecture where possible.

### No Safari-only visual compromises without reason
Do not unnecessarily reduce the experience for Safari simply because it is Safari. Performance reductions should be based on measured capability or reproducible browser limitations.

### Browser fallback
If a browser cannot support the intended WebGL experience reliably, provide a functional fallback rather than exposing a broken or unstable 3D environment.

---

## 18. Accessibility & Reduced Motion

The cinematic experience must remain usable and understandable without requiring visitors to tolerate continuous motion.

### Semantic content
Important information must remain available through accessible HTML where practical. Core service information should not exist exclusively as inaccessible 3D geometry or canvas pixels.

### Keyboard access
Interactive controls must be keyboard accessible, including audio controls, skip controls, Explore controls, navigation, and contact links.

### Focus management
Focus states must remain visible and understandable. The 3D environment must not interfere with keyboard navigation or trap focus.

### Reduced motion
The implementation must respect the user's `prefers-reduced-motion` preference. Reduced motion should provide a substantially simplified cinematic presentation while preserving MGRT identity, Film/Digital structure, major objects, content hierarchy, lighting language, and practical navigation.

### Reduced-motion strategy

```text
FULL MOTION     camera travel, object movement, atmospheric movement, scroll choreography
        ↓
REDUCED MOTION  simplified camera movement, minimal object transitions,
                reduced atmospheric animation, simplified scroll progression
```

### Accessibility fallback
If WebGL cannot be rendered reliably, essential information should still be available through accessible HTML content and practical navigation. The cinematic environment is an enhancement to the website, not the only means of accessing its content.

---

## 19. Navigation, Skip & Repeat-Visit Behavior

The cinematic experience should be immersive without becoming a barrier to practical website use.

### Skip
A discreet skip mechanism may allow visitors to bypass the cinematic introduction. Skipping must place the visitor into a valid application state. It must not expose unloaded geometry, leave animations halfway through, break scroll position, produce lighting discontinuities, create invalid camera positions, or leave audio playing unexpectedly.

### Entering the practical experience
After the cinematic sequence reaches its final stillness, the visitor should be able to enter the Explore layer, with clear access to Work, About, and Contact.

The exact information architecture is defined by the website's practical content structure, while this document defines the technical mechanisms required to transition into it.

### Repeat visits
The implementation may store a lightweight local preference indicating that the visitor has previously experienced the introduction:

```text
FIRST VISIT     → FULL ACT 0 REVEAL
RETURNING VISIT → SHORTENED REVEAL → CINEMATIC EXPERIENCE
```

This behavior must never prevent visitors from accessing the experience.

### Storage
Any repeat-visit state should use appropriate browser storage and should fail gracefully if storage is unavailable. Do not require cookies or persistent tracking simply to determine whether the cinematic introduction has previously been viewed.

### Back / forward navigation
Browser history navigation must not leave the application in an invalid cinematic state. The experience should remain coherent when visitors navigate backward, navigate forward, return from another page, refresh, or restore a browser tab.

---

## 20. Performance Budgets & Technical Fallbacks

Performance is a core design requirement. The site should be evaluated not only by whether it technically runs, but by whether it **feels smooth**.

### Performance priorities

```text
1. Input responsiveness       5. Lighting continuity
2. Camera smoothness          6. Asset loading
3. Scroll synchronization     7. Visual fidelity
4. Stable frame rendering     8. Secondary effects
```

### Performance targets
The implementation should target a stable experience appropriate to the visitor's device rather than assuming one universal frame rate. High-refresh displays should be allowed to benefit from higher frame rates when the device can sustain them.

A stable 60fps experience is preferable to an unstable attempt at 120fps.

### Frame-time awareness
Performance should be considered in terms of frame time, not only nominal FPS: 60fps ≈ 16.7ms per frame, 90fps ≈ 11.1ms per frame, 120fps ≈ 8.3ms per frame. The experience should avoid unnecessary work that consumes the available frame budget.

### Main-thread performance
Avoid unnecessary main-thread work during scrolling and rendering. Particular care should be taken with layout reads/writes, repeated DOM measurement, excessive React re-renders, large JavaScript computations, synchronous asset processing, excessive event handlers, and unnecessary object allocation.

### GPU performance
Monitor expensive rendering features including high-resolution shadows, volumetric effects, multiple render passes, high-resolution reflections, transmission, large textures, excessive transparent materials, excessive particle counts, and complex post-processing.

### Memory
Memory usage should remain controlled. Do not retain large media buffers, unused textures, duplicate geometries, or unnecessary render targets after they are no longer required.

### Fallback hierarchy

```text
REDUCE SECONDARY EFFECTS → REDUCE ATMOSPHERE → REDUCE REFLECTION / POST-PROCESSING
→ REDUCE MATERIAL COMPLEXITY → REDUCE GEOMETRY DETAIL → PRESERVE CAMERA + NARRATIVE + LIGHTING
```

The implementation should never respond to performance pressure by randomly disabling major cinematic elements.

### Technical failure

```text
ADVANCED EXPERIENCE → FEATURE FAILURE → GRACEFUL FALLBACK → ACCESSIBLE CONTENT → WORK / ABOUT / CONTACT
```

The visitor must never encounter a blank page, broken canvas, frozen scroll state, or inaccessible contact path because one advanced feature failed.

### Measured baseline (Group A, 2026-09-16)

The numbers below replace the pre-optimization checkpoint (`b3f9dc6`) as the reference every later performance change is compared against. Conditions: M2 Pro, Chrome, production build, 1440x900, DPR 2 against the renderer's 1.75 cap, measured to the reveal of the opening frame. Network conditions are Chrome's own throttling profiles; runs were interleaved with the previous build to cancel machine drift.

```text
Cold local, cold DNS          1.061 s
Fast 4G                       6.51 s
Slow 4G                       33.47 s
Phone viewport, Fast 4G       6.47 s
Warm cache                    1.10 s
Hero-critical transfer        6.705 MB over 25-26 requests
Draw calls per frame          186
Triangles per frame           1.60 M
Frame time, median / p95      22-25 ms / 23-27 ms
Programs linked               49, all at boot
```

Per-frame work by render target: composer at 2520x1575 is 123 draws / 1.065 M triangles, the 1440x900 output and GTAO passes are 63 draws / 0.534 M triangles, and the 4096x4096 shadow map is drawn once when the room is complete rather than every frame (see `shadowUpdates.js`).

Two known characteristics of this baseline, both deliberate: the hero preload hints raise DOMContentLoaded on throttled links (218 ms to 543 ms on Fast 4G) because they share bandwidth with the application bundle, which is a trade made in favour of hero readiness; and roughly 180 ms before the reveal is spent waiting on a command-buffer flush attributed to program linking, which `compileAsync` was measured against and did not improve.

### Measured in production (Group B, 2026-09-16)

The figures above are local. These are https://mgrtmedia.com, same viewport and
DPR, Chrome's own throttling profiles over the real network, so they include
real RTT to the CDN edge and are not directly comparable with a localhost run.

```text
Cold, unthrottled              1.35-1.41 s
Cold, Fast 4G                  4.82 s
Cold, Slow 4G                  21.3 s
Warm cache (second load)       1.30 s, 0 bytes transferred
Transferred before the reveal  4,250,696 B (4250.7 kB / 4151.1 KiB), 24 transfers
```

The stone re-encode above landed after those production figures were taken, and
is not in them. Measured locally against the same build without it, interleaved:

```text
                        baseline        stone re-encode
transferred (reveal)   5,103,034 B      4,850,435 B   -252,599 B
cold local               1068/1083 ms      977/947 ms
Fast 4G                  5337/5323 ms    4978/4972 ms
Slow 4G                     25,189 ms       23,993 ms
phone viewport Fast 4G       5232 ms          4868 ms
warm cache                1066/1004 ms     996/987 ms
draws / frame                     186              186
```

Deployed savings will differ: these files are WebP, which the CDN does not
compress further, so the production reduction should track the file sizes —
but that is an estimate until measured after the next deploy.

No failed requests and no decoding errors. One 404 remains: `/favicon.ico`,
which the site does not ship, so every load logs one console error. Harmless,
but it is the only error in a clean load and is worth removing.

### Testing
Performance should be tested during development rather than only before launch, including desktop high-refresh displays, standard desktop displays, modern laptops, iOS devices, Android devices, Safari, Chrome, slow network conditions, resize operations, rapid scroll direction changes, long sessions, repeat visits, and reduced-motion mode.

The final performance assessment should consider both measured metrics and subjective smoothness.

---

## 21. Technical Implementation Principles

The following rules govern implementation decisions across the project:

1. Preserve the experience before preserving complexity.
2. Keep the primary 3D world persistent.
3. Drive major cinematic state from one deterministic timeline.
4. Do not use section triggers as substitutes for cinematic state.
5. Never allow lighting to snap between narrative acts.
6. Never allow camera position to visibly reset.
7. Treat resize behavior as part of the experience, not an afterthought.
8. Treat Safari as a first-class browser target.
9. Treat mobile as a recomposed cinematic experience, not a desktop fallback.
10. Load assets according to cinematic necessity.
11. Do not keep unnecessary media or effects active.
12. Reduce rendering complexity progressively when performance requires it.
13. Protect camera movement, narrative continuity, major objects, and primary lighting before secondary visual effects.
14. Use HTML where it improves accessibility, responsiveness, or performance.
15. Use WebGL where physical depth, lighting, materiality, and spatial composition materially improve the experience.
16. Make advanced features fail gracefully.
17. Never allow a technical failure to prevent practical access to Work, About, or Contact.
18. Do not introduce browser-specific workarounds without a reproducible reason.
19. Do not optimize for benchmark numbers at the expense of perceived cinematic smoothness.
20. Technology serves the cinematic experience — never the other way around.

---

## 22. Technical Definition of Done

The technical architecture is considered successfully implemented when:

- The cinematic environment remains a coherent persistent world.
- The camera behaves as one continuous physical camera.
- Scroll deterministically controls the cinematic timeline.
- Forward and reverse scrolling remain stable.
- Film → Digital contains no visible lighting, exposure, fog, or scene snap.
- The MGRT hero is the stable final frame: scrolling past it leaves camera and lighting unchanged.
- The cinematic sequence can transition into the practical website.
- Portfolio media does not overwhelm rendering or network performance.
- Audio, if implemented, remains subtle and optional.
- The initial void functions as the loading experience.
- Mobile is intentionally recomposed.
- Resize and orientation changes do not break the scene.
- Safari remains stable and visually coherent.
- Reduced-motion users receive a valid experience.
- WebGL or media failures do not produce a broken website.
- Performance remains stable across representative devices.
- No unnecessary technical complexity has been introduced.

> **Core technical principle:** Build the simplest architecture capable of delivering the intended cinematic experience reliably, then spend complexity only where it creates a visible and meaningful improvement.
