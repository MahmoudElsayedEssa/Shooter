# Palanty Shooter 2D — Software Requirements Specification

---
project: Palanty Shooter 2D
version: 1.0
status: draft
platforms: [mobile-web, desktop-browser]
stack: [typescript, pixijs, vite, howlerjs]
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
- Adaptive audio system with pressure-scaled intensity
- Difficulty presets as data-driven configuration
- Centralized tuning constants registry
- Telemetry event hooks (implementation deferred)
- Localization-ready UI (Arabic + English)

### Out of Scope
- Multiplayer
- Backend accounts or user profiles
- Real-money rewards or monetization
- Leaderboard or tournament system
- Final brand art or full sound mix
- Replay export
- Full skeletal animation runtime
- Rigid-body physics engine

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

### REQ-AUDIO-001: Adaptive audio system
type: functional
lane: T2_STANDARD
risk: low
priority: must
source: SRS §18

#### Intent
Audio acts as an emotional amplifier with pressure-scaled intensity. Uses Howler.js or equivalent Web Audio library. Audio failure must never block gameplay.

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
TypeScript (strict mode), PixiJS (2D renderer), Vite (build tool), Howler.js (audio), custom arcade physics. No full game engine.

#### Architecture Constraints
- Gameplay-critical motion must not depend on animation library timelines.
- GSAP allowed only for UI, camera, and non-gameplay tweens.
- Ball movement and collision timing must remain simulation-driven.

#### Forbidden
- Unity WebGL (bundle size, memory, WebView risk)
- Box2D / Matter.js (over-engineered for arcade penalty)
- Redux or heavy state frameworks

#### Acceptance Criteria
- AC1 [must] Project builds and runs with TypeScript strict mode, PixiJS, and Vite.
- AC2 [must] No runtime dependency on Unity, Phaser, Box2D, or Matter.js.
- AC3 [must] Gameplay motion controlled by simulation, not animation timelines.

#### Proof Requirements
minimum: L2
commands:
- npx vitest run
- npm run build

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

### ARCH-RENDER-001: Single canvas with logical layers
type: architecture
lane: T4_ARCHITECTURE
risk: medium

#### Decision
One canvas. Logical layers implemented inside the PixiJS scene graph.

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
- Stadium draws first. UI draws above gameplay but must not block core play areas.
- Front goal frame draws above ball for depth illusion.
- Cinematic overlay draws last.

#### Acceptance Criteria
- AC1 [must] Single canvas element.
- AC2 [must] 7 logical layers in documented Z-order.
- AC3 [must] Draw order preserves depth illusion (keeper before ball when ball in front, front goal above ball).

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

#### Proof
- static/diff check for state mutation in render functions

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

#### Proof
- static/diff check for outcome manipulation in presentation logic

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

#### Proof
- static/diff check for hardcoded numbers instead of config imports

## 8. Milestone Plan

### PLAN-M1: Project foundation
type: milestone
order: 1
lane: T4_ARCHITECTURE

#### Goal
Vite + TypeScript + PixiJS project running with responsive canvas, fixed-step game loop, state machine transitions through all phases, and placeholder rendering (stadium, ball, goal, UI).

#### Includes
- ARCH-STACK-001
- ARCH-GAMELOOP-001
- ARCH-RENDER-001
- ARCH-STATE-001
- REQ-LOOP-001 (state machine only, no scoring logic yet)

#### Deliverables
- Running dev server with responsive portrait canvas
- Fixed-step simulation loop at 60Hz
- State machine with all transitions
- Placeholder sprites for stadium, ball, goal
- Placeholder UI for score display

#### Exit Criteria
- AC1 [must] Project runs with `npm run dev` and renders responsive portrait canvas.
- AC2 [must] State machine transitions through all documented phases without error.
- AC3 [must] Simulation runs at fixed 60Hz independent of render framerate.

#### Verification Matrix
| AC | Proof | Command |
|---|---|---|
| AC1 | L2 | npm run build |
| AC2 | L3 | npx vitest run src/core/state-machine |
| AC3 | L3 | npx vitest run src/core/game-loop |

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
- Adaptive audio with Howler.js
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
