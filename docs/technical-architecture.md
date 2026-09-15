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
INITIAL REQUEST → DARKNESS → ESSENTIAL ASSETS PREPARE → ENVIRONMENT BECOMES READY → ACT 0 REVEAL
```

The visitor should never see unfinished geometry, broken materials, placeholder objects, or incomplete lighting.

### Asset priorities

Assets should be divided into priority levels.

**Critical** (required for the initial environment and Act 0): core architecture, primary lighting, initial camera, essential environment materials, initial typography.

**Near-term** (required shortly after the opening): cinema camera, Film media, monitor, Digital media.

**Deferred** (required later in the experience): secondary environmental details and lower-priority effects. (Everything the room shows is visible in the opening frame, so all models and surfaces load before the reveal; the chapter videos load only when their beat plays.)

### Progressive loading

```text
ESSENTIAL ENVIRONMENT → INITIAL EXPERIENCE → FILM MEDIA → DIGITAL MEDIA
```

The visitor should be able to begin the experience without waiting for every downstream asset to be fully loaded. However, the cinematic timeline must never reveal an asset before its required resources are ready.

### No visible loading interruptions
Do not introduce loading screens between Film, Digital, and the hero. If an asset is not ready when its cinematic moment approaches, the implementation should use an appropriate fallback or controlled pacing rather than exposing a broken state.

### 3D asset optimization
Models should be optimized before entering the application: polygon reduction, mesh compression, texture compression, removal of invisible geometry, material consolidation, efficient UV layouts, shared materials, removal of unused animation data, and appropriate LOD generation.

### Asset formats
Use modern, efficient formats where browser support permits. 3D assets should generally use optimized glTF/GLB workflows. Textures should use compressed formats appropriate to the target browsers and devices. Video should use efficient web-compatible encoding and appropriately sized variants.

### Caching
Static assets should be cacheable where appropriate. Asset versioning must prevent stale files from being used after deployment.

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
