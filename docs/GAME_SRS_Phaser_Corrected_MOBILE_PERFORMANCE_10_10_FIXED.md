# Palanty Shooter 2D — Software Requirements Specification

---
project: Palanty Shooter 2D
version: 1.2-mobile-performance
status: draft
performanceProfile: mobile-webview-high-performance
targetFps: 60
minimumFpsLowEnd: 45
platforms: [mobile-web, desktop-browser]
stack: [typescript, phaser, vite]
optionalStack: [howlerjs]
audioDefault: phaser-sound
defaultProof: L2
---

## 1. Product Contract

### PILLAR-001: Expressive control
type: pillar
status: active

Player input must feel personal and skill-based. The draw gesture is the central product differentiator — this is not a left/right penalty selector.

### PILLAR-002: Fairness
type: pillar
status: active

Outcomes must be understandable and must not be secretly forced. If a player scores or misses, they understand why.

### PILLAR-003: Emotional escalation
type: pillar
status: active

The match must feel more intense near the end. The final shots must feel cinematic and stressful compared to the opening shots.

### PILLAR-004: Micro-cinematics
type: pillar
status: active

Cinematic motion must amplify gameplay without stopping it. Short camera, timing, and FX enhancements lasting under 700ms that never remove player agency.

### PILLAR-005: Mobile speed
type: pillar
status: active

The game must support short sessions and fast retries. Portrait-first, mobile-web-first, playable inside an app WebView.

### PILLAR-006: Performance is gameplay
type: pillar
status: active

Mobile smoothness is part of the product, not a polish item. If cinematic effects, particles, audio, or art density threaten input responsiveness, frame rate, battery, or WebView stability, the game must degrade presentation first while preserving fair gameplay.

## 2. Glossary

- Gesture: The player's touch or pointer path used to define shot intent.
- Shot intent: Interpreted gameplay data extracted from the gesture (target, force, curve, quality).
- Raw path: The original input points captured from the player.
- Trajectory: The generated ball movement path after smoothing and interpretation.
- Controlled variation: Small deterministic or seeded offsets to avoid repetitive behavior without unfairly overriding player skill.
- Micro-cinematic: A short camera, timing, or FX enhancement lasting less than 700ms and not removing player agency.
- Hero moment: A shot or save classified as unusually dramatic because of match context, trajectory quality, near-contact, or decisive outcome.
- Match point: A shot where success can decide the match outcome.
- Pressure: A normalized value from 0 to 1 representing emotional and competitive intensity.
- Frame budget: The maximum safe time spent per frame so gameplay can target 60 FPS on mobile devices.
- Low-end mode: A deterministic visual fallback that reduces effects, not gameplay rules or fairness.
- Texture atlas: A packed sprite sheet used to reduce texture swaps and improve mobile rendering performance.
- Object pool: A reusable set of particles, trails, and temporary objects to avoid runtime allocation spikes.
- Hot path: Code executed during active drawing, ball flight, collision, goalkeeper movement, camera, or FX updates.

## 3. Product Scope

### In Scope
- Portrait-first responsive gameplay in mobile WebView and desktop browser
- Draw-to-shoot gesture input with live trail feedback
- Gesture interpretation into shot intent (target, force, curve, quality)
- Curved ball trajectory with depth illusion
- Goal/save/miss collision resolution
- Five-shot match flow with scoring and immediate restart
- Goalkeeper AI with emotional mood states and adaptive prediction
- Emotional pressure system with cinematic escalation
- Hero moment detection and enhanced presentation
- Micro-cinematic camera (zoom, tracking, shake, slow-motion)
- Procedural visual effects (trails, impacts, screen effects)
- Goalkeeper animation with emotional facial overlays
- Adaptive audio system with pressure-scaled intensity using Phaser Sound by default; Howler.js is optional only if Phaser Sound proves insufficient
- Difficulty presets as data-driven configuration
- Centralized tuning constants registry
- Telemetry event hooks (implementation deferred)
- Localization-ready UI (Arabic + English)
- Mobile WebView performance gates, low-end mode, and frame-time instrumentation
- Texture atlas based asset pipeline with load priority and memory budgets
- Object pooling for trails, particles, impact FX, temporary markers, and reusable display objects
- Manual UAT scenarios and device/browser acceptance matrix for vendor handover

### Out of Scope
- Multiplayer
- Backend accounts or user profiles
- Real-money rewards or monetization
- Leaderboard or tournament system
- Final brand art or full sound mix
- Replay export
- Full skeletal animation runtime
- Rigid-body physics engine
- Heavy full-screen post-processing on every shot
- Multiple canvas renderers or DOM-heavy gameplay overlays during active play
- Runtime skeletal animation middleware unless performance gates prove it is safe
- Large uncompressed assets loaded before first playable state

## 4. Game Requirements

### REQ-LOOP-001: Core match flow and state machine
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §6-8

#### Intent
The game runs a complete penalty match through explicit states: boot, ready, aiming, drawing, shot commit, ball flight, resolution, reset, and match end. Five shots per match, immediate restart.

#### Rationale
The state machine is the gameplay backbone. Every system reads match phase to decide behavior. Without clean state transitions, nothing else works.

#### Scope Hints
likelyEdit:
- src/systems/match/**
- src/core/state-machine.*
likelyTest:
- src/systems/match/**/*.test.*
forbidden:
- renderer implementation
- input capture logic

#### Non-Goals
- Do not implement sudden-death or tournament modes.
- Do not add menu screens or navigation beyond restart.

#### Acceptance Criteria
- AC1 [must] Game transitions through states: boot → ready → aiming → drawing → shot_commit → ball_flight → resolution → reset → (aiming | match_end).
- AC2 [must] Match ends after 5 shots or when result is mathematically decided before the fifth shot.
- AC3 [must] Goal = player +1. Save or miss = goalkeeper +1.
- AC4 [must] Player can restart from match_end with one action, no navigation required.
- AC5 [must] shot_commit completes within 100ms. Resolution lasts 600-1200ms. Reset lasts 300-600ms.
- AC6 [must] Invalid gesture in drawing returns to aiming without penalty or state corruption.
- AC7 [must] Visibility loss transitions any active state to pause; restore returns to previous safe state.
- AC8 [should] Player can take next shot within 1.8 seconds of a normal outcome.

#### Proof Requirements
minimum: L3
commands:
- npx vitest run src/systems/match/
markers:
- PASS AC1
- PASS AC2

---

### REQ-INPUT-001: Draw-to-shoot input system
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §9

#### Intent
The player draws an upward path from the ball area toward the goal. The system captures the gesture, validates it, and shows a live trail during drawing.

#### Rationale
The draw gesture is the core product differentiator (PILLAR-001). Input must feel responsive and forgiving.

#### Scope Hints
likelyEdit:
- src/systems/input/**
likelyTest:
- src/systems/input/**/*.test.*
forbidden:
- gesture interpretation logic (REQ-SHOT-001)
- ball trajectory logic

#### Non-Goals
- Do not implement gesture recording/replay.
- Do not add gesture tutorial beyond first-use hint.

#### Acceptance Criteria
- AC1 [must] Touch, pointer, and mouse input are all captured.
- AC2 [must] Gesture must start inside valid shot zone centered on ball with minimum radius 44 CSS px and recommended 12-16% viewport width.
- AC3 [must] Gesture sampler enforces 4px minimum distance and 16ms minimum time interval between points with a maximum of 48 points per gesture.
- AC4 [must] Gesture is valid only with ≥ 3 points, ≥ 28px total distance, final point ≥ 10px above start, and duration 50-1200ms.
- AC5 [must] Invalid gesture returns to aiming without penalty.
- AC6 [must] Live energy trail appears within same frame or next frame after input begins.
- AC7 [must] Trail fades within 120-260ms after shot commit.
- AC8 [should] Trail visually communicates curve direction and force without blocking goal visibility.

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npx vitest run src/systems/input/

---

### REQ-SHOT-001: Gesture interpretation into shot intent
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §10

#### Intent
The raw gesture is interpreted into shot intent: target position, force, curve, gesture quality. The game does not replay the raw gesture literally.

#### Rationale
Interpretation is the bridge between player expression and ball behavior. It must feel fair: good gestures produce good shots, poor gestures reduce precision but never fully steal control.

#### Scope Hints
likelyEdit:
- src/systems/shot/**
likelyTest:
- src/systems/shot/**/*.test.*
forbidden:
- input capture logic (REQ-INPUT-001)
- ball trajectory logic (REQ-BALL-001)

#### Non-Goals
- Do not add shot assist modes.
- Do not implement aim prediction visualization.

#### Acceptance Criteria
- AC1 [must] Interpreter outputs: targetX, targetY, force, curve, gestureQuality, durationMs, pathComplexity.
- AC2 [must] Force derived from gesture speed, normalized and clamped to 0.55-1.35. Speed range: 0.25-1.20 CSS px/ms.
- AC3 [must] Horizontal endpoint maps to goal width. Upward height maps to shot height. Target clamped inside or near goal frame.
- AC4 [must] Curve extracted from lateral deviation using center-weighted offset, clamped -1 to 1. Reference width 110-140px.
- AC5 [must] Gesture quality 0.0-1.0 based on jitter, reversals, length, speed. Minimum effective quality 0.35.
- AC6 [must] Poor quality reduces precision but does not fully steal control. Small jitter is smoothed.

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npx vitest run src/systems/shot/
markers:
- PASS AC2
- PASS AC4

---

### REQ-BALL-001: Ball trajectory and collision resolution
type: functional
lane: T2_STANDARD
risk: high
priority: must
source: SRS §11

#### Intent
The ball follows a curved arcade trajectory generated from shot intent, with depth illusion via scaling. Collisions are deterministic and resolve as goal, save, or miss.

#### Rationale
Trajectory and collision are the outcome engine. They must feel physically believable (arcade, not simulation) and be deterministic for fairness.

#### Scope Hints
likelyEdit:
- src/systems/ball/**
- src/systems/collision/**
likelyTest:
- src/systems/ball/**/*.test.*
- src/systems/collision/**/*.test.*
forbidden:
- goalkeeper AI logic
- FX/camera logic

#### Non-Goals
- Do not implement full rigid-body physics.
- Do not add ball spin or wind.

#### Acceptance Criteria
- AC1 [must] Trajectory uses cubic Bézier from ball start to interpreted target, with curve offset applied to control points.
- AC2 [must] Max curve offset 80-160px depending on viewport. Flight duration 450-850ms, higher force = shorter.
- AC3 [must] Ball scales during flight: larger near shooter, smaller near goal.
- AC4 [must] Collision is deterministic for same shot intent and same AI state.
- AC5 [must] Ball inside goal and not saved = goal. Ball intersects keeper reach during save window = save. Ball outside goal frame = miss.
- AC6 [must] Save visually shows keeper contact — no invisible-logic saves.
- AC7 [must] Post/crossbar hits produce miss or rebound per tuning.
- AC8 [should] Slight misses allowed outside goal frame when gesture quality is poor.

#### Proof Requirements
minimum: L3
commands:
- npx vitest run src/systems/ball/ src/systems/collision/
markers:
- PASS AC4
- PASS AC5

---

### REQ-GOALIE-001: Goalkeeper AI with emotional behavior
type: functional
lane: T3_HIGH_RISK
risk: high
priority: must
source: SRS §12

#### Intent
The goalkeeper is an expressive semi-adaptive opponent with four AI layers (emotional, tactical, physical, animation), five mood states, tunable prediction and reaction, and readable saves.

#### Rationale
The goalkeeper is the opponent. It must feel alive, fair, and emotionally responsive. The AI must never cheat in ways that invalidate valid player shots.

#### Scope Hints
likelyEdit:
- src/systems/goalkeeper/**
likelyTest:
- src/systems/goalkeeper/**/*.test.*
forbidden:
- ball trajectory logic
- camera/FX logic

#### Non-Goals
- Do not implement multiplayer goalkeeper control.
- Do not add goalkeeper selection or customization.

#### Acceptance Criteria
- AC1 [must] AI operates through 4 layers: emotional (mood/tension), tactical (predict target/choose dive), physical (move/reach), animation (face/pose/recovery).
- AC2 [must] 5 mood states with distinct visual and gameplay behavior: calm (baseline), focused (better reading), nervous (delayed reaction), aggressive (early commit, more wrong guesses), desperate (risky dives, high variance).
- AC3 [must] Mood transitions driven by pressure, score lead/deficit, consecutive outcomes, and match point status per documented rules.
- AC4 [must] Prediction accuracy depends on mood, difficulty, shot quality, and curve strength.
- AC5 [must] Reaction timing ranges per mood: calm 140-190ms, focused 105-155ms, nervous 170-240ms, aggressive 80-130ms, desperate 70-180ms.
- AC6 [must] Reach represented by body/hand animation, expands during dive peak, weaker when wrong-footed, never teleports.
- AC7 [should] Goalkeeper appears to learn from repeated shot patterns (improved prediction on same direction, anticipation pose on repeat corner).

#### Proof Requirements
minimum: L3
commands:
- npx vitest run src/systems/goalkeeper/
markers:
- PASS AC2
- PASS AC5

---

### REQ-PRESSURE-001: Emotional pressure and hero moment detection
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §13, §37

#### Intent
A normalized pressure value (0-1) drives cinematic intensity. An escalation floor prevents flat early shots while respecting match context. Hero moments classify exceptional shots for maximum emphasis.

#### Rationale
Pressure is the emotional engine. It makes the final shot feel dramatically different from the first. Hero moments reward exceptional play with cinematic payoff.

#### Scope Hints
likelyEdit:
- src/systems/pressure/**
- src/systems/hero/**
likelyTest:
- src/systems/pressure/**/*.test.*
- src/systems/hero/**/*.test.*
forbidden:
- shot outcome logic
- goalkeeper AI prediction

#### Non-Goals
- Do not let pressure force gameplay outcomes.
- Do not add player-facing pressure meter UI.

#### Acceptance Criteria
- AC1 [must] Pressure = clamp(shotProgress×0.55 + scoreTension×0.25 + matchPointBonus + finalShotBonus, 0, 1).
- AC2 [must] Escalation floor per shot (0.10, 0.18, 0.30, 0.45, 0.50) scaled by context multiplier. Decided matches get multiplier 0.3; close matches up to 1.0.
- AC3 [must] Pressure affects mood, camera, FX, audio, trail brightness, UI urgency. Pressure never directly forces goal/save/miss.
- AC4 [must] Hero moments detected: final_decider (final shot, score diff ≤1), near_save_goal (ball scores within 5% of keeper reach), fingertip_save (save in outer 15% of reach), extreme_curve_goal (|curve| ≥ 0.85 + goal), post_and_in (post contact + goal), wrong_foot_curve (keeper dives right direction but ball curves away and scores).
- AC5 [must] Hero moments trigger enhanced camera/FX/audio but never change an already-resolved outcome.
- AC6 [must] Hero moment result display: max 1000-1500ms vs normal 600-1200ms.

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npx vitest run src/systems/pressure/ src/systems/hero/
markers:
- PASS AC1
- PASS AC4

---

### REQ-CINEMA-001: Cinematic camera system
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §14

#### Intent
The camera enhances gameplay through layered behaviors: base framing, ball tracking, tension zoom, impact shake, slow-motion pulse, and emotional focus. All driven by pressure.

#### Rationale
Micro-cinematics (PILLAR-004) make the match feel like a sports broadcast. Camera intensity must scale with drama without interrupting flow.

#### Scope Hints
likelyEdit:
- src/systems/camera/**
likelyTest:
- src/systems/camera/**/*.test.*
forbidden:
- gameplay state mutation
- collision logic

#### Non-Goals
- Do not implement replay camera.
- Do not add user-controlled camera.

#### Acceptance Criteria
- AC1 [must] Camera supports 6 layers: base framing, ball tracking, tension zoom, impact shake, slow-motion pulse, emotional focus.
- AC2 [must] Zoom range 1.00 normal to max 1.12. Zoom never crops ball, keeper, or goal frame.
- AC3 [must] Ball tracking strength scales with pressure: low 0.05-0.10, medium 0.10-0.18, high 0.18-0.30.
- AC4 [must] Shake duration: light 80-140ms, strong 160-260ms, final-shot max 350ms.
- AC5 [must] Slow-motion triggers only on final shot, match point, near save, or post contact. Duration 180-450ms, time scale 0.35-0.70. Does not trigger every shot.
- AC6 [must] Camera interpolated with exponential damping: position damping 8-14, zoom damping 6-10.
- AC7 [should] Slow-motion does not delay reset beyond acceptable pacing.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run src/systems/camera/

---

### REQ-FX-001: Visual effects system
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §15

#### Intent
Procedural-first, pool-based FX system for ball trail, drawing trail, goal/save/miss impacts, screen-space effects, and hit stop. Intensity scales with pressure and hero moments.

#### Rationale
FX make shots feel powerful and outcomes feel dramatic. They must enhance readability, not obscure it.

#### Scope Hints
likelyEdit:
- src/systems/fx/**
likelyTest:
- src/systems/fx/**/*.test.*
forbidden:
- gameplay outcome logic
- collision detection

#### Non-Goals
- Do not implement sprite-based confetti or branded celebration for MVP.
- Do not add FX settings menu.

#### Acceptance Criteria
- AC1 [must] FX system is procedural-first and pool-based. FX read gameplay state but never decide outcomes.
- AC2 [must] Ball trail during flight: 180-450ms lifetime, opacity decreases with age, width scales with force/pressure, draws behind ball.
- AC3 [must] Goal FX: net pulse/stretch + ball impact burst, scaled by shot importance. Hero goal gets extended net ripple.
- AC4 [must] Save FX: contact spark/burst + ball deflection, originating at visual contact point. Contact burst 120-220ms.
- AC5 [must] Miss FX quieter than goal/save unless post/crossbar hit.
- AC6 [must] Screen effects (vignette, flash) do not obscure ball or goal frame. Disabled or reduced in reduced-motion and low-end modes.
- AC7 [should] Hit stop 40-90ms on strong saves, post hits, or decisive goals. Must not make input feel delayed.
- AC8 [should] Low-end devices can reduce FX density without changing gameplay.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run src/systems/fx/

---

### REQ-ANIM-001: Goalkeeper animation and emotional display
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §16

#### Intent
The goalkeeper has full animation support for gameplay actions and emotional overlays that reflect mood state through facial expression and body language.

#### Rationale
The goalkeeper must feel alive (PILLAR-003). Animation must align with gameplay collision results — visual and logic must never contradict.

#### Scope Hints
likelyEdit:
- src/systems/animation/**
- src/assets/goalkeeper/**
likelyTest:
- src/systems/animation/**/*.test.*
forbidden:
- AI decision logic
- collision logic

#### Non-Goals
- Do not implement full skeletal runtime animation for MVP.
- Do not add goalkeeper skin/costume selection.

#### Acceptance Criteria
- AC1 [must] Goalkeeper supports animations: idle, focus stance, nervous stance, pre-dive anticipation, dive left/right/center, save contact, miss reaction, goal conceded, reset.
- AC2 [must] Facial expressions reflect mood: eye shape, brow angle, mouth expression, and body tension change per mood state.
- AC3 [must] Dive animation aligns with gameplay reach timing. Animation shows save only when collision resolves save. Animation shows failure only when collision resolves goal.
- AC4 [must] No long non-interactive celebration animations during normal flow. Readability over realism.
- AC5 [should] MVP uses sprite-sheet or lightweight rig for body, procedural overlays for facial emotion, procedural squash/stretch for dive impact.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run src/systems/animation/

---

### REQ-UI-001: In-game UI and outcome clarity
type: functional
lane: T1_MICRO
risk: low
priority: must
source: SRS §17, §24

#### Intent
Minimal in-game UI displays score, shot count, match result, and restart action. Outcomes (goal, save, miss) are clearly distinguishable within 500ms of resolution.

#### Rationale
UI must inform without cluttering. The player must always understand what happened and what to do next.

#### Scope Hints
likelyEdit:
- src/ui/**
likelyTest:
- src/ui/**/*.test.*
forbidden:
- gameplay logic
- camera/FX logic

#### Non-Goals
- Do not add settings screens or menus for MVP.
- Do not display long instructions during active play.

#### Acceptance Criteria
- AC1 [must] UI displays: player score, goalkeeper score, current shot number, match result text, restart action.
- AC2 [must] UI does not cover ball start zone, goal corners, goalkeeper body, or gesture drawing path.
- AC3 [must] Goal clearly shows: ball crossing into goal + net feedback + positive score update.
- AC4 [must] Save clearly shows: keeper contact/reach + ball deflection/stop + save feedback.
- AC5 [must] Miss clearly shows: ball outside frame or post hit + distinct feedback from save.
- AC6 [must] Player understands outcome within 500ms of resolution.
- AC7 [should] First-use hint ("Draw your shot" or Arabic equivalent) shown, disappears after first valid gesture.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run src/ui/

---



### REQ-SCREEN-001: Mobile game screen inventory and composition
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: original SRS §4, §17, §22, §24

#### Intent
The game uses a small set of mobile-first screens and overlays that keep the player inside the penalty experience with no heavy navigation.

#### Rationale
A mobile football penalty game must be instantly playable. Screen composition must protect the ball zone, goal corners, goalkeeper body, score clarity, and restart flow.

#### Scope Hints
likelyEdit:
- src/ui/**
- src/scenes/**
- src/core/layout.*
likelyTest:
- src/ui/**/*.test.*
- src/tests/mobile/**
forbidden:
- long menu navigation before first shot
- UI covering the ball start zone
- DOM overlays for active gameplay controls

#### Non-Goals
- Do not implement a full multi-screen menu system in MVP.
- Do not add store, profile, leaderboard, tournament, or account navigation.
- Do not move active gameplay controls outside the Phaser canvas.
- Do not redesign the game around landscape-first composition.

#### Screen Inventory
| Screen / Overlay | State | Required Elements | Performance Notes |
|---|---|---|---|
| Boot / Loading | boot | loading indicator, critical asset progress | load only critical assets before ready |
| Ready / Aiming | ready, aiming | ball, goal, goalkeeper, score, shot count, short hint | no heavy animation loop beyond idle |
| Drawing | drawing | live trail, ball zone feedback | no allocations per pointer event |
| Ball Flight | ball_flight | ball, keeper, trail, camera/FX | single canvas, pooled FX only |
| Result Overlay | resolution | goal/save/miss text, score update | max normal display 600-1200ms |
| Reset | reset | quick repositioning | no long celebration lock |
| Match End | match_end | final score, restart action | one action restart |
| Pause / Restore | pause | paused/safe state | no score corruption after resume |

#### Acceptance Criteria
- AC1 [must] All required screens/overlays are reachable through the documented state machine.
- AC2 [must] Active gameplay controls are rendered inside the Phaser canvas, not as DOM-heavy overlays.
- AC3 [must] UI never covers the valid shot zone, goal corners, goalkeeper save area, or drawing path.
- AC4 [must] Player can reach first aiming state after critical assets load without menu navigation.
- AC5 [must] Restart from match end requires one clear action.

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npx vitest run src/ui/ src/tests/mobile/

### REQ-ASSET-001: Asset and audio manifest for mobile production
type: functional
lane: T2_STANDARD
risk: medium
priority: must
source: original SRS §18, §21, §23

#### Intent
The vendor must deliver a clear asset and audio manifest so the game can be optimized for mobile WebView instead of relying on uncontrolled placeholder or oversized files.

#### Rationale
Performance cannot be guaranteed if art and audio files are unmanaged. The manifest defines critical assets, optional polish, memory budget, load order, and fallback behavior.

#### Scope Hints
likelyEdit:
- src/assets/**
- src/core/assets.*
- public/assets/**
likelyTest:
- src/tests/performance/**
forbidden:
- large uncompressed images in critical path
- loading optional cosmetics before first playable state
- audio loading blocking gameplay

#### Non-Goals
- Do not require final brand art, final character polish, or final sound mix for MVP acceptance.
- Do not include monetization cosmetics, skin shop assets, replay export assets, or event-specific art in MVP.
- Do not block first playable state on optional stadium polish, advanced cinematic FX, or non-critical audio.
- Do not use this requirement as approval for oversized production assets outside the stated budgets.

#### Required Asset Groups
| Group | Examples | Load Priority | Requirement |
|---|---|---:|---|
| Critical Gameplay | ball, goal frame, net layers, goalkeeper core poses, score UI | 1 | must load before ready |
| Input / Shot FX | drawing trail, ball trail, contact marker | 2 | procedural or atlas-backed |
| Goalkeeper Emotion | face overlays, mood eyes/brows/mouth, pose variants | 3 | may stream after first playable if placeholders exist |
| Stadium | background, crowd, field, sky | 4 | optimized texture atlas, no huge background before ready |
| Cinematic FX | vignette, flash, hero particles, net ripple highlights | 5 | reduced in low-end mode |
| Audio | kick, whoosh, goal, save, post, crowd, tension swell | 6 | unlock after user gesture, never block play |

#### Acceptance Criteria
- AC1 [must] Repository includes an asset manifest listing file name, group, dimensions, compressed size, load priority, and critical/optional status.
- AC2 [must] Critical first-play assets are separated from optional polish assets.
- AC3 [must] Gameplay sprites use texture atlases where practical to reduce texture switches.
- AC4 [must] Audio has fallback behavior if unlock or playback fails.
- AC5 [must] Missing optional polish assets do not prevent a complete five-shot match.

#### Proof Requirements
minimum: L2
commands:
- npm run build
- npx vitest run src/tests/performance/

---

### REQ-AUDIO-001: Adaptive audio system
type: functional
lane: T2_STANDARD
risk: low
priority: must
source: SRS §18

#### Intent
Audio acts as an emotional amplifier with pressure-scaled intensity. Uses Phaser Sound by default, with Howler.js allowed only as an explicit optional replacement if Phaser Sound proves insufficient. Audio failure must never block gameplay.

#### Rationale
Sound makes goals feel powerful and near-saves feel tense. Adaptive audio transforms the match from flat repetition into escalating drama.

#### Scope Hints
likelyEdit:
- src/systems/audio/**
likelyTest:
- src/systems/audio/**/*.test.*
forbidden:
- gameplay logic
- collision logic

#### Non-Goals
- Do not implement full music score for MVP.
- Do not add audio settings UI beyond mute.

#### Acceptance Criteria
- AC1 [must] Audio events: kick, ball whoosh, curve/air, goal net impact, save impact, post impact, crowd reaction, tension swell.
- AC2 [must] Audio intensity scales with pressure: low pressure = light ambience; high pressure = stronger crowd, tighter whoosh, higher impact; final shot = tension swell + crowd anticipation.
- AC3 [must] Audio initializes only after user interaction (Web Audio autoplay policy).
- AC4 [must] If audio fails to initialize, game remains fully playable — no blocked input, rendering, or match progression.
- AC5 [must] Kick sound triggers immediately on shot commit. Tension loops fade in/out, never restart abruptly.
- AC6 [should] Result sounds do not delay gameplay reset.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run src/systems/audio/

---

### REQ-BALANCE-001: Difficulty, fairness, and anti-frustration
type: functional
lane: T3_HIGH_RISK
risk: high
priority: must
source: SRS §19

#### Intent
Difficulty is tunable via data-driven presets. The game is fair: no forced outcomes, no invisible saves, no stolen shots. Anti-frustration patterns ensure fast retry and clear feedback.

#### Rationale
Fairness is a pillar (PILLAR-002). Players must trust the system. Difficulty must scale through visible goalkeeper behavior, not hidden manipulation.

#### Scope Hints
likelyEdit:
- src/config/difficulty.*
- src/systems/goalkeeper/**
likelyTest:
- src/config/**/*.test.*
forbidden:
- collision resolution logic changes
- FX/camera logic

#### Non-Goals
- Do not implement competitive/ranked difficulty modes.
- Do not add difficulty selection UI for MVP (use single default preset).

#### Acceptance Criteria
- AC1 [must] Difficulty tunable via: prediction error, reaction time, reach radius, wrong-commit chance, shot quality tolerance, curve difficulty multiplier.
- AC2 [must] Presets stored as data configuration, not hard-coded logic. Changing values does not require rewriting algorithms.
- AC3 [must] Game never forces a miss on a valid high-quality shot.
- AC4 [must] Game never forces an impossible save for drama.
- AC5 [must] Target never changes after shot commit except through documented quality/error rules.
- AC6 [must] Controlled variation (reaction timing, prediction offset, animation variant) is bounded, seedable, and visible through behavior.
- AC7 [must] Same shot intent + same AI seed = same outcome (deterministic).
- AC8 [should] Goalkeeper skill multiplier increases per shot (0.85, 0.95, 1.00, 1.05, 1.10).
- AC9 [should] Anti-frustration: forgiving input detection, clear save contact, clear miss reason, fast retry, no long failure animations.

#### Proof Requirements
minimum: L3
commands:
- npx vitest run src/config/ src/systems/goalkeeper/
markers:
- PASS AC3
- PASS AC7

## 5. Non-Functional Requirements

### NFR-PERF-001: Runtime performance and memory
type: non-functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §21

#### Scope Hints
likelyEdit:
- src/core/game-loop.*
- src/systems/fx/**
likelyTest:
- src/tests/performance/**
forbidden:
- gameplay logic changes for performance

#### Non-Goals
- Do not add GPU profiling UI.
- Do not implement dynamic quality auto-detection for MVP.

#### Acceptance Criteria
- AC1 [must] 60 FPS during active gameplay on target devices.
- AC2 [must] 45 FPS minimum on lower-end devices with reduced FX.
- AC3 [must] Object pooling for trail points, particles, impact effects, temporary visual markers.
- AC4 [must] Single canvas. No multiple canvas layers unless measured performance need exists.
- AC5 [should] Particle count: 20-60 normal shots, max 120 hero moments.
- AC6 [should] Initial critical texture memory under 32MB. Total active under 64MB on mid-range mobile.

#### Proof Requirements
minimum: L3
commands:
- npx vitest run src/tests/performance/

---



### NFR-PERF-002: Mobile WebView performance gates
type: non-functional
lane: T2_STANDARD
risk: high
priority: must
source: original SRS §4, §21, §22, §23

#### Scope Hints
likelyEdit:
- src/core/game-loop.*
- src/core/performance.*
- src/systems/fx/**
- src/scenes/**
likelyTest:
- src/tests/performance/**
- src/tests/mobile/**
forbidden:
- per-frame allocations in hot paths
- creating/destroying Phaser GameObjects during ball flight
- unbounded particles or trail segments
- full-screen expensive effects every shot
- DOM layout reads/writes during active gameplay

#### Intent
The game must behave as a high-performance mobile football game. Smooth input and stable WebView runtime are release gates, not optional polish.

#### Non-Goals
- Do not guarantee 60 FPS on every possible phone, browser, or WebView outside the approved device matrix.
- Do not replace gameplay fairness, fixed-step simulation, or input responsiveness to hide performance problems.
- Do not implement a full in-game GPU profiler or developer overlay in MVP.
- Do not optimize by removing required outcome clarity, save readability, or valid input feedback.

#### Acceptance Criteria
- AC1 [must] Active gameplay targets 60 FPS on approved target devices and never accepts performance regressions below the defined budget without documented low-end fallback.
- AC2 [must] Low-end mode maintains at least 45 FPS by reducing FX, background motion, shake, flash, and particle density before reducing input responsiveness.
- AC3 [must] Drawing input feedback appears same frame or next frame, even when low-end mode is active.
- AC4 [must] Ball flight and collision remain fixed-step and deterministic even when render FPS fluctuates.
- AC5 [must] Normal shots use 20-60 active particles; hero moments are capped at 120 active particles.
- AC6 [must] Trail points, particles, impact markers, and temporary vectors use pooling or reusable buffers in hot paths.
- AC7 [must] Performance warnings are recorded when catch-up steps are dropped repeatedly or frame time exceeds thresholds.

#### Proof Requirements
minimum: L3
commands:
- npx vitest run src/tests/performance/ src/tests/mobile/
markers:
- PASS FPS_TARGET
- PASS LOW_END_FALLBACK
- PASS NO_HOT_PATH_ALLOCATION

### NFR-BUNDLE-001: Bundle, texture, and first-play budgets
type: non-functional
lane: T2_STANDARD
risk: high
priority: must
source: original SRS §21, §23

#### Scope Hints
likelyEdit:
- vite.config.*
- src/core/assets.*
- src/scenes/BootScene.*
- public/assets/**
likelyTest:
- src/tests/performance/**
forbidden:
- loading all production art before first playable state
- large uncompressed PNG/JPG files without justification
- runtime texture generation during shot flight
- unused assets in critical bundle

#### Non-Goals
- Do not require a CDN, remote asset service, or backend asset pipeline for MVP.
- Do not require final compressed production art before gameplay acceptance tests pass.
- Do not force all assets into one bundle; staged loading is allowed and preferred for mobile performance.
- Do not include optional cosmetics, monetization assets, or unused art in the critical first-play bundle.

#### Acceptance Criteria
- AC1 [must] First playable state loads only critical gameplay assets: ball, goal, keeper core, UI essentials, and basic trail/impact FX.
- AC2 [must] Initial critical texture memory target is 16-32MB; active mid-range mobile texture memory target is under 64MB.
- AC3 [must] Device pixel ratio is capped at 2.0 unless measured performance proves a higher cap is safe.
- AC4 [must] Production build reports asset sizes and flags oversized critical assets.
- AC5 [must] Optional stadium polish, advanced cinematic FX, and cosmetics can be delayed until after first playable state.
- AC6 [should] Texture atlases are used for keeper, goal, UI, and FX groups where practical.

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npm run build
- npx vitest run src/tests/performance/

### NFR-DEVICE-001: Device and browser acceptance matrix
type: non-functional
lane: T2_STANDARD
risk: high
priority: must
source: original SRS §4, §22, §30

#### Scope Hints
likelyEdit:
- docs/qa/**
- src/tests/mobile/**
likelyTest:
- src/tests/mobile/**
forbidden:
- accepting desktop-only QA as mobile-ready
- skipping WebView verification

#### Non-Goals
- Do not certify every historical OS/browser/WebView version outside the approved matrix.
- Do not require native iOS or Android wrappers in MVP.
- Do not accept emulator-only QA as proof for real mobile readiness.
- Do not add platform-specific gameplay rules that change fairness between devices.

#### Acceptance Matrix
| Target | Minimum Acceptance |
|---|---|
| Android Chrome | complete match, 60 FPS target, touch safe, audio unlock works |
| Android WebView | complete match, no scroll interference, pause/resume safe |
| iOS Safari | complete match, safe areas respected, audio unlock works |
| iOS in-app WebView | complete match, visibility/background safe |
| Desktop browser | QA support for mouse/pointer and deterministic tests |
| 320px viewport | playable portrait layout, no blocked ball or goal |
| Low-end mode | 45 FPS minimum target with reduced FX |

#### Acceptance Criteria
- AC1 [must] Vendor QA report includes results for all targets in the matrix.
- AC2 [must] Any unsupported target is listed with reason, impact, and mitigation.
- AC3 [must] WebView pause, app background, tab hidden, resize, and orientation change do not corrupt match score.
- AC4 [must] Page scroll and browser gesture interference are prevented during active play.

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npx vitest run src/tests/mobile/

---

### NFR-MOBILE-001: Mobile WebView compatibility
type: non-functional
lane: T2_STANDARD
risk: medium
priority: must
source: SRS §4, §22

#### Scope Hints
likelyEdit:
- src/core/renderer.*
- src/core/lifecycle.*
likelyTest:
- src/tests/mobile/**
forbidden:
- gameplay logic changes

#### Non-Goals
- Do not implement native app wrapper.
- Do not add landscape-first layout.

#### Acceptance Criteria
- AC1 [must] Portrait-first layout. Supports viewport widths down to 320 CSS px.
- AC2 [must] Safe areas respected: no UI overlap with camera notch, home indicator, or system gesture areas.
- AC3 [must] Device pixel ratio capped at 2.0 unless testing proves higher is safe.
- AC4 [must] Page scroll and browser gesture interference prevented during play.
- AC5 [must] Handles: tab hidden, WebView pause, app background, orientation change, resize. Restores to safe state without corrupting match score.

#### Proof Requirements
minimum: L3
commands:
- npx vitest run src/tests/mobile/

---

### NFR-A11Y-001: Accessibility and reduced motion
type: non-functional
lane: T1_MICRO
risk: low
priority: should
source: SRS §26

#### Scope Hints
likelyEdit:
- src/ui/**
- src/systems/camera/**
- src/systems/fx/**
likelyTest:
- src/tests/accessibility/**
forbidden:
- gameplay logic changes

#### Non-Goals
- Do not implement screen reader support for MVP.
- Do not add colorblind modes for MVP.

#### Acceptance Criteria
- AC1 [must] UI text maintains adequate contrast against game background.
- AC2 [must] Touch zones large enough for mobile use. Ball interaction zone does not require pixel-perfect input.
- AC3 [should] Reduced-motion mode lowers shake, zoom pulses, slow-motion frequency, and flash intensity.
- AC4 [should] Localization-ready UI strings for Arabic and English. Layout supports RTL.

#### Proof Requirements
minimum: L2

## 6. Architecture Contracts

### ARCH-STACK-001: Technology stack
type: architecture
lane: T4_ARCHITECTURE
risk: high

#### Decision
TypeScript (strict mode), Phaser 3 (2D game framework/renderer), Vite (build tool), Phaser Sound as the default audio layer, and custom arcade shot/collision logic. Howler.js is optional only if Phaser Sound proves insufficient and the SRS or task explicitly allows it.

#### Architecture Constraints
- Phaser is the required runtime/game framework for MVP.
- Gameplay-critical motion must not depend on animation/tween timelines.
- Phaser Tweens are allowed only for UI, camera, FX, and non-gameplay presentation.
- Ball movement, goalkeeper reach, collision timing, score outcomes, and fairness-critical state must remain simulation-driven.
- Phaser Arcade Physics may be used only for non-authoritative helper calculations if explicitly justified; authoritative shot outcomes remain custom/deterministic.

#### Forbidden
- PixiJS (stale stack from earlier draft; do not add or require it)
- Unity WebGL (bundle size, memory, WebView risk)
- Box2D / Matter.js (over-engineered for arcade penalty)
- Redux or heavy state frameworks
- Any stack change by an agent without updating and re-importing this SRS first

#### Acceptance Criteria
- AC1 [must] Project builds and runs with TypeScript strict mode, Phaser 3, and Vite.
- AC2 [must] No runtime dependency on Unity, PixiJS, Box2D, or Matter.js.
- AC3 [must] Gameplay motion and collision outcomes are controlled by Ma'at-tracked simulation code, not Phaser Tweens or animation timelines.
- AC4 [must] Phaser is allowed/required by the generated architecture contract and is not listed as forbidden.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run
- npm run build

---



### ARCH-PERF-001: Phaser WebGL mobile performance authority
type: architecture
lane: T4_ARCHITECTURE
risk: high
status: active
requiredStack:
- phaser
- webgl
- single-canvas
expectedStack:
- object-pooling
- texture-atlases
- performance-instrumentation
forbidden:
- multiple gameplay canvases
- DOM-heavy active gameplay UI
- Matter.js or Arcade Physics as authoritative collision
- Phaser Tweens controlling ball trajectory or collision timing
- creating/destroying display objects in shot hot path
- unbounded particle emitters

#### Decision
The implementation remains Phaser 3 + TypeScript + Vite, but Phaser is used as a lightweight WebGL renderer and scene runtime. Gameplay authority remains custom fixed-step simulation code.

#### Rationale
The source SRS is a mobile WebView football game with high performance requirements. Phaser is acceptable only when used with strict rendering, pooling, texture, and fixed-step rules that preserve input responsiveness and deterministic fairness.

#### Architecture Constraints
- Phaser Game config must prefer WebGL renderer for production; Canvas fallback is QA/fallback only.
- The game uses one Phaser Game instance and one canvas.
- Main gameplay should use a small, controlled number of scenes: boot/loading, gameplay, optional UI overlay scene.
- Gameplay-critical state is not stored inside Phaser display objects.
- Ball, goalkeeper, collision, score, pressure, and outcome are simulation-owned.
- Phaser Tweens are allowed for UI, camera, FX, and non-authoritative presentation only.
- Object pools must be used for trails, particles, impact markers, temporary sprites, and reusable geometry.
- No per-frame creation of textures, graphics objects, emitters, arrays, or closures inside active hot paths unless justified and measured.

#### Acceptance Criteria
- AC1 [must] Phaser is present as the required runtime/game framework and no PixiJS dependency exists.
- AC2 [must] Production uses a single Phaser canvas and WebGL rendering where available.
- AC3 [must] Ball flight, collision, goalkeeper reach, scoring, and pressure calculations are independent from Phaser Tweens and animation timelines.
- AC4 [must] Performance instrumentation exposes FPS, frame time, dropped catch-up steps, active particles, texture memory estimate, and low-end mode state.
- AC5 [must] Low-end mode can reduce presentation without changing shot outcome logic.

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npm run build
- npx vitest run src/core/ src/tests/performance/
markers:
- PASS SINGLE_CANVAS
- PASS WEBGL_RUNTIME
- PASS SIMULATION_AUTHORITY

### ARCH-ASSET-001: Texture atlas and staged loading pipeline
type: architecture
lane: T4_ARCHITECTURE
risk: medium
status: active
expectedStack:
- texture-atlas
- staged-loading
- compressed-assets
forbidden:
- loading all art before first playable state
- huge standalone images in critical path
- audio unlock blocking game start

#### Decision
Assets are loaded in stages: critical gameplay first, optional polish later. Sprite assets are grouped into atlases where practical to reduce mobile texture switching and memory overhead.

#### Architecture Constraints
- Boot scene loads only critical assets needed for first shot.
- Optional advanced FX, crowd polish, and cosmetics may load after `ready` or lazily when needed.
- Texture dimensions, file sizes, and load priority are tracked in an asset manifest.
- Audio files load/unlock after user interaction and must never block gameplay if unavailable.
- Asset fallback placeholders are allowed only when they preserve gameplay readability.

#### Acceptance Criteria
- AC1 [must] Asset manifest exists and is committed with the project.
- AC2 [must] Critical and optional assets are separated by load priority.
- AC3 [must] Build or QA process reports oversized critical assets.
- AC4 [must] Missing optional assets do not block a playable five-shot match.

#### Proof Requirements
minimum: L2
commands:
- npm run build
- npx vitest run src/tests/performance/

---

### ARCH-GAMELOOP-001: Fixed-step simulation loop
type: architecture
lane: T4_ARCHITECTURE
risk: high

#### Decision
60Hz fixed-step simulation loop. Rendering via requestAnimationFrame runs independently. Gameplay outcomes computed by fixed-step, not variable-frame rendering.

#### Architecture Constraints
- Fixed delta = 1/60s.
- Max 3 catch-up steps per rendered frame. Excess accumulated time dropped.
- Rendering may interpolate between snapshots but must not affect collision or outcomes.

#### Update Order
1. Input buffer
2. Gesture capture/interpretation
3. Match state machine
4. Goalkeeper AI decision
5. Ball trajectory/physics
6. Collision and outcome detection
7. Match score and pressure
8. Camera state
9. FX state
10. Audio trigger evaluation
11. UI state

#### Acceptance Criteria
- AC1 [must] Simulation uses fixed dt = 1/60s.
- AC2 [must] Renderer reads state only via requestAnimationFrame.
- AC3 [must] Max 3 catch-up steps per frame; excess time dropped.
- AC4 [must] Systems execute in documented order.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run src/core/

---

### ARCH-RENDER-001: Single Phaser canvas with logical layers
type: architecture
lane: T4_ARCHITECTURE
risk: medium

#### Decision
One canvas created by Phaser. Logical layers are implemented using Phaser Scene display order, Containers, or depth values.

#### Layer Order

| Layer | Z | Content |
|---|---:|---|
| Background | 0 | Stadium, crowd, field, sky |
| Goal Back | 1 | Net back, rear goal elements |
| Gameplay | 2 | Goalkeeper, ball, active actors |
| Goal Front | 3 | Posts, crossbar, front net |
| FX | 4 | Trails, particles, impacts |
| UI | 5 | Score, shot counter, result, restart |
| Cinematic Overlay | 6 | Vignette, flash, slow-motion |

#### Architecture Constraints
- Phaser owns the single canvas and render loop integration.
- Stadium draws first. UI draws above gameplay but must not block core play areas.
- Front goal frame draws above ball for depth illusion.
- Cinematic overlay draws last.
- Phaser display objects must read presentation state and must not mutate gameplay-authoritative state outside simulation ticks.

#### Acceptance Criteria
- AC1 [must] Single canvas element created by Phaser.
- AC2 [must] 7 logical layers in documented Z-order.
- AC3 [must] Draw order preserves depth illusion (keeper before ball when ball in front, front goal above ball).
- AC4 [must] No PixiJS scene graph, PixiJS renderer, or PixiJS dependency exists.

#### Proof Requirements
minimum: L2

---

### ARCH-STATE-001: Runtime state tree with ownership
type: architecture
lane: T4_ARCHITECTURE
risk: high

#### Decision
Central runtime state tree with explicit read/write ownership per system. All gameplay-critical values in a centralized tuning registry loadable as data.

#### Architecture Constraints
- Systems must only write to their owned state slice.
- Rendering code must never mutate the state tree.
- State mutations only occur during simulation ticks.
- Tuning constants must be importable from a single config module.

#### State Tree Structure

```text
GameState
 ├── match: { phase, shotIndex, maxShots, playerScore, goalieScore, pressure, heroMoment, result }
 ├── input: { isDrawing, rawPoints, lastIntent }
 ├── ball: { position, previousPosition, trajectoryProgress, trajectory, scale, visible }
 ├── goalie: { position, mood, prediction, diveState, reachRadius, emotionalIntensity }
 ├── camera: { offset, zoom, shakeIntensity, trackingWeight, timeScale }
 ├── fx: { activeTrails, activeParticles, screenVignette, flashIntensity, hitStopRemainingMs }
 ├── audio: { unlocked, ambienceIntensity, pendingEvents }
 └── ui: { scoreVisible, resultText, hintVisible }
```

#### Ownership Rules

| System | Reads | Writes |
|---|---|---|
| Input | browser events | input |
| Gesture Interpreter | input.rawPoints | input.lastIntent |
| Match State Machine | input, ball, outcome events | match, ui |
| Ball System | match, input.lastIntent | ball |
| Goalkeeper AI | match, input.lastIntent, ball | goalie |
| Collision | ball, goalie, layout | outcome event |
| Pressure | match | match.pressure |
| Camera | match, ball, goalie | camera |
| FX | gameplay events, pressure | fx |
| Audio | gameplay events, pressure | audio |
| UI | match, ui | display-only |

#### Acceptance Criteria
- AC1 [must] State tree contains documented sub-states with typed fields.
- AC2 [must] Each system has documented read/write ownership and does not write to other systems' state.
- AC3 [must] All tuning constants stored in centralized config loadable as data. Changing values does not require algorithm changes.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run src/core/

## 7. Methodology / Engineering Constitution

### METHOD-DETERMINISM-001: Simulation authority over rendering
type: methodology
enforcement: constitution
severity: block

#### Rule
Rendering code must not mutate gameplay-authoritative state. Gameplay state is mutated only during simulation ticks, never during rendering.

#### Forbidden
- Renderer functions writing to match, input, ball, goalie, or collision state
- Animation timelines controlling collision timing or outcome resolution
- State mutation outside simulation tick boundaries

#### Proof Requirements
minimum: L1
commands:
- npx vitest run src/core/
- npm run build
markers:
- PASS NO_RENDER_STATE_MUTATION

---

### METHOD-FAIRNESS-001: No forced outcomes
type: methodology
enforcement: constitution
severity: block

#### Rule
Pressure, cinematic systems, and difficulty scaling affect presentation and AI behavior only. They never directly force a goal, save, or miss outcome.

#### Forbidden
- Overriding shot target after commit except through documented quality/error rules
- Extending keeper reach beyond documented bounds for dramatic saves
- Forcing a miss on a valid high-quality shot
- Outcome manipulation in pressure, camera, FX, or audio modules

#### Proof Requirements
minimum: L1
commands:
- npx vitest run src/systems/ball/ src/systems/collision/ src/systems/pressure/
markers:
- PASS NO_FORCED_OUTCOMES
- PASS PRESENTATION_DOES_NOT_MUTATE_OUTCOME

---

### METHOD-TUNING-001: Centralized tuning constants
type: methodology
enforcement: constitution
severity: warn

#### Rule
All gameplay-critical values shall be defined in a centralized tuning configuration module. No magic numbers scattered across gameplay systems.

#### Forbidden
- Hard-coded gameplay thresholds inside system logic files
- Duplicated constant definitions across multiple files
- Inline numeric literals for timing, distance, or force thresholds in gameplay code

#### Proof Requirements
minimum: L1
commands:
- npx vitest run src/config/ src/core/
markers:
- PASS TUNING_REGISTRY_USED
- PASS NO_SCATTERED_GAMEPLAY_MAGIC_NUMBERS

---



### METHOD-PERFORMANCE-001: Performance budget is a release gate
type: methodology
enforcement: constitution
severity: block

#### Rule
No gameplay, FX, camera, audio, UI, or art change is accepted if it breaks mobile WebView performance gates without a documented fallback.

#### Forbidden
- Adding visual polish that drops active gameplay below budget without low-end fallback
- Allocating temporary objects every frame in hot paths
- Increasing critical asset memory without updating the asset manifest
- Accepting desktop-only performance as mobile production readiness
- Hiding performance regressions by changing gameplay rules

#### Proof Requirements
minimum: L2
preferred: L3
commands:
- npx vitest run src/tests/performance/ src/tests/mobile/
- npm run build
markers:
- PASS FPS_TARGET
- PASS LOW_END_FALLBACK
- PASS NO_HOT_PATH_ALLOCATION

### METHOD-SRS-AUTHORITY-001: SRS-driven technology authority
type: methodology
enforcement: constitution
severity: block

#### Rule
The technology stack is governed by this SRS and the generated Ma'at architecture contract. Agents must not introduce, remove, or replace core runtime technologies unless the SRS is explicitly updated and re-imported first.

#### Forbidden
- Adding PixiJS or any alternative renderer while Phaser is the required stack
- Replacing Phaser with another engine/framework without SRS update
- Creating implementation prototypes outside an active Ma'at task
- Treating old roadmap completion as valid after an SRS stack change
- Ignoring architecture-contract diagnostics about required or forbidden stack items

#### Proof Requirements
minimum: L1
commands:
- npm run build
- maat doc-check docs/GAME_SRS_Phaser_Corrected_MOBILE_PERFORMANCE_10_10_FIXED.md
markers:
- PASS NO_FORBIDDEN_RUNTIME_DEPENDENCIES
- PASS ARCHITECTURE_CONTRACT_MATCHES_SRS
- PASS TRACE_INCLUDES_REQ_ARCH_METHOD

## 8. Milestone Plan

### PLAN-M1: Project foundation
type: milestone
order: 1
lane: T4_ARCHITECTURE

#### Goal
Vite + TypeScript + Phaser project running with responsive canvas, fixed-step game loop, state machine transitions through all phases, and placeholder rendering (stadium, ball, goal, UI).

#### Includes
- ARCH-STACK-001
- ARCH-GAMELOOP-001
- ARCH-RENDER-001
- ARCH-STATE-001
- REQ-LOOP-001 (state machine only, no scoring logic yet)

#### Deliverables
- Running dev server with responsive portrait Phaser canvas
- Fixed-step simulation loop at 60Hz
- State machine with all transitions
- Placeholder sprites for stadium, ball, goal
- Placeholder UI for score display

#### Exit Criteria
- AC1 [must] Project runs with `npm run dev` and renders responsive portrait Phaser canvas.
- AC2 [must] State machine transitions through all documented phases without error.
- AC3 [must] Simulation runs at fixed 60Hz independent of render framerate.
- AC4 [must] Phaser is the only runtime/game framework; no PixiJS dependency or import exists.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L2 | npm run build |
| AC2 | L3 | npx vitest run src/core/state-machine |
| AC3 | L3 | npx vitest run src/core/game-loop |
| AC4 | L2 | npm run build |

---

### PLAN-M2: Input and shot interpretation
type: milestone
order: 2
lane: T2_STANDARD

#### Goal
Player can draw gesture on ball, see live trail, and gesture is converted into shot intent with target, force, curve, and quality.

#### Includes
- REQ-INPUT-001
- REQ-SHOT-001

#### Deliverables
- Touch/pointer/mouse input capture
- Gesture validation logic
- Live drawing trail
- Shot intent interpreter

#### Exit Criteria
- AC1 [must] Valid gesture produces shot intent with all fields populated.
- AC2 [must] Invalid gesture returns to aiming cleanly.
- AC3 [must] Drawing trail visible during gesture.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L3 | npx vitest run src/systems/input/ src/systems/shot/ |
| AC2 | L3 | npx vitest run src/systems/input/ |
| AC3 | L2 | manual browser verification |

---

### PLAN-M3: Ball flight and goalkeeper
type: milestone
order: 3
lane: T3_HIGH_RISK

#### Goal
Ball flies on Bézier trajectory, goalkeeper predicts and dives, collisions resolve as goal/save/miss deterministically.

#### Includes
- REQ-BALL-001
- REQ-GOALIE-001
- REQ-ANIM-001

#### Deliverables
- Ball trajectory generator
- Ball depth scaling
- Goalkeeper AI (prediction, reaction, dive)
- Collision resolver
- Goalkeeper placeholder animation

#### Exit Criteria
- AC1 [must] Ball follows curved trajectory toward interpreted target.
- AC2 [must] Goalkeeper dives based on prediction with mood-appropriate timing.
- AC3 [must] Same shot intent + same AI seed = same outcome.
- AC4 [must] Save shows visible keeper contact.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L3 | npx vitest run src/systems/ball/ |
| AC2 | L3 | npx vitest run src/systems/goalkeeper/ |
| AC3 | L3 | npx vitest run src/systems/collision/ |
| AC4 | L2 | manual browser verification |

---

### PLAN-M4: Match flow, pressure, and emotion
type: milestone
order: 4
lane: T2_STANDARD

#### Goal
Complete five-shot match with scoring, pressure system driving mood transitions, hero moment detection, and difficulty configuration.

#### Includes
- REQ-LOOP-001 (full match rules)
- REQ-PRESSURE-001
- REQ-BALANCE-001

#### Deliverables
- Five-shot match with scoring and restart
- Pressure formula with escalation floor
- Mood transition logic
- Hero moment classifier
- Difficulty preset configuration

#### Exit Criteria
- AC1 [must] Player completes a five-shot match with correct scoring.
- AC2 [must] Pressure increases across shots and goalkeeper mood visibly changes.
- AC3 [must] Hero moments detected on qualifying shots.
- AC4 [must] Match restart works immediately.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L3 | npx vitest run src/systems/match/ |
| AC2 | L3 | npx vitest run src/systems/pressure/ src/systems/goalkeeper/ |
| AC3 | L3 | npx vitest run src/systems/hero/ |
| AC4 | L2 | manual browser verification |

---

### PLAN-M5: Cinematic polish and audio
type: milestone
order: 5
lane: T2_STANDARD

#### Goal
Camera, FX, audio, and UI complete. Match feels cinematically alive with pressure-driven intensity scaling.

#### Includes
- REQ-CINEMA-001
- REQ-FX-001
- REQ-UI-001
- REQ-AUDIO-001

#### Deliverables
- Cinematic camera (zoom, tracking, shake, slow-mo)
- Full FX system (trails, impacts, screen effects)
- Adaptive audio with Phaser Sound by default; Howler.js only if explicitly justified
- Polished UI with outcome clarity

#### Exit Criteria
- AC1 [must] Camera intensity scales visibly with pressure.
- AC2 [must] FX fire on goal, save, and miss with correct intensity.
- AC3 [must] Audio plays kick on commit and scales with pressure.
- AC4 [must] All outcomes clearly distinguishable within 500ms.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L2 | manual browser verification |
| AC2 | L3 | npx vitest run src/systems/fx/ |
| AC3 | L3 | npx vitest run src/systems/audio/ |
| AC4 | L2 | manual browser verification |

---

### PLAN-M6: Mobile optimization and QA
type: milestone
order: 6
lane: T2_STANDARD

#### Goal
Mobile WebView ready. Performance budgets met. Accessibility handled. All acceptance criteria verified.

#### Includes
- NFR-PERF-001
- NFR-MOBILE-001
- NFR-A11Y-001

#### Deliverables
- DPR capping and safe area handling
- Visibility pause/resume
- Resize/orientation handling
- Low-end FX fallback
- Reduced-motion mode
- Performance budget verification

#### Exit Criteria
- AC1 [must] 60 FPS on target devices during active play.
- AC2 [must] Visibility changes handled without match corruption.
- AC3 [must] Portrait layout works at 320px minimum width.
- AC4 [should] Reduced-motion mode functional.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L3 | npx vitest run src/tests/performance/ |
| AC2 | L3 | npx vitest run src/tests/mobile/ |
| AC3 | L2 | manual browser verification |
| AC4 | L2 | manual browser verification |



---

### PLAN-M7: Vendor performance acceptance and handover
type: milestone
order: 7
lane: T2_STANDARD

#### Goal
Freeze gameplay scope, verify mobile performance gates, complete manual UAT, deliver asset manifest, and confirm the build is ready for WebView integration.

#### Includes
- PILLAR-006
- REQ-SCREEN-001
- REQ-ASSET-001
- NFR-PERF-002
- NFR-BUNDLE-001
- NFR-DEVICE-001
- ARCH-PERF-001
- ARCH-ASSET-001
- METHOD-PERFORMANCE-001

#### Deliverables
- Final production build.
- Device/browser QA report.
- Performance report with FPS, frame time, and low-end fallback results.
- Asset and audio manifest.
- Manual UAT checklist results.
- Vendor handover checklist.

#### Exit Criteria
- AC1 [must] Approved mobile WebView targets complete a five-shot match without match-state corruption.
- AC2 [must] Performance gates pass or documented low-end fallback is enabled.
- AC3 [must] No forbidden dependencies or runtime architecture violations exist.
- AC4 [must] Asset manifest and tuning registry are delivered with the source.
- AC5 [must] Final build, test, and preview commands are documented.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L2 | manual WebView QA |
| AC2 | L3 | npx vitest run src/tests/performance/ |
| AC3 | L2 | npm run build |
| AC4 | L2 | manual handover check |
| AC5 | L2 | npm run build |


## 9. Open Decisions

### DECISION-001: Final orientation policy
status: open
owner: human

Portrait-only or portrait-first with landscape support? Landscape adds responsive layout complexity.

### DECISION-002: Shooter character visibility
status: open
owner: human

Is the shooter character/foot visible, or does only the ball appear? Affects art pipeline and screen composition.

### DECISION-003: Art pipeline approach
status: open
owner: human

Sprite sheets, lightweight rig, or hybrid? Must balance loading speed, emotional expressiveness, and mobile bundle size.

### DECISION-004: Match format variations
status: open
owner: human

Fixed five shots only, or add sudden-death for ties? Event-specific rule variations? Affects match state machine complexity.

### DECISION-005: Audio scope for MVP
status: open
owner: human

Full adaptive audio from M5, or minimal placeholder sounds first? Full audio requires sound asset production.

### DECISION-006: Monetization and reward integration
status: open
owner: human

Any monetization in MVP? Affects architecture hooks, account requirements, and privacy policy.

### DECISION-007: Analytics provider
status: open
owner: human

Which analytics provider, if any? Telemetry hooks are in scope but provider integration is deferred.

### DECISION-008: Final minimum performance device list
status: open
owner: human

The final physical device list for Android, iOS, and in-app WebView QA must be approved before production sign-off. Until approved, the SRS device matrix defines the minimum acceptance categories.

## 10. QA and Vendor Acceptance Plan

### QA-UAT-001: Manual gameplay UAT scenarios
type: qa
priority: must

#### Coverage
| Scenario | Expected Result |
|---|---|
| Start game on 320px portrait viewport | ready/aiming state visible, no UI overlap |
| Draw a valid straight shot | shot commits, ball follows clear target direction |
| Draw a strong curved shot | ball curve visibly reflects gesture direction |
| Draw too short / invalid gesture | returns to aiming with no penalty |
| Repeat same shot intent and AI seed | same outcome is produced |
| Goal outcome | ball enters goal, net feedback, score update visible within 500ms |
| Save outcome | keeper contact/reach visible, save FX at contact point |
| Miss outcome | ball visibly outside frame/post/high/wide, distinct from save |
| Final decisive shot | pressure, camera, FX, and audio are stronger than shot 1 |
| Reduced motion / low-end mode | shake, flash, particles, and slow motion reduce without gameplay changes |
| Visibility loss during shot | game pauses/restores safe state without score corruption |
| Match end restart | one action restarts a new match |

### QA-PERF-001: Performance acceptance checklist
type: qa
priority: must

#### Coverage
- 60 FPS target during active gameplay on approved target devices.
- 45 FPS minimum target in low-end mode.
- Same-frame or next-frame drawing trail feedback.
- No repeated object creation in hot paths for trails, particles, impact markers, or temporary vectors.
- Critical texture memory target 16-32MB and active mid-range target under 64MB.
- DPR cap of 2.0 unless performance report approves higher value.
- Particle caps: 20-60 normal shots and max 120 hero moments.
- Page scroll, browser gestures, and DOM overlays do not interfere with play.

### QA-DELIVERY-001: Final vendor handover checklist
type: qa
priority: must

#### Required Deliverables
- Source code repository.
- Install, dev, build, test, preview instructions.
- Final SRS traceability to implemented features.
- Asset and audio manifest.
- Tuning registry documentation.
- Device/browser QA report.
- Performance report.
- Known issues list.
- Confirmation that forbidden dependencies are absent.
- Confirmation that gameplay authority is fixed-step simulation, not presentation tweens.

