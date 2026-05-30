# Palanty Shooter 2D - Software Requirements Specification

Version: 1.0  
Document status: Production SRS draft  
Primary language: English technical specification  
Game concept language: Arabic/Egyptian design notes accepted during production

## 1. Purpose

This document defines the software requirements for Palanty Shooter 2D, a mobile-first 2D arcade penalty game built around expressive path drawing, emotional goalkeeper behavior, and escalating cinematic sports drama.

The purpose of this SRS is to define what the product must do, how systems must behave from the player's perspective, what measurable constraints must be met, and what acceptance criteria are required before implementation is considered correct.

This document intentionally includes measurable gameplay formulas, thresholds, state transitions, technology decisions, runtime architecture requirements, and implementation sequencing where they are necessary to remove ambiguity. Detailed class-level design, exact filenames, and final production code structure may still belong in a separate Technical Design Document.

## 2. Product Vision

Palanty Shooter 2D shall deliver a fast emotional skill-arcade penalty experience where the player draws the intended ball path with a finger. The game must be immediately understandable, mechanically fair, visually expressive, and increasingly dramatic as the match approaches its final shots.

The player fantasy is:

- "I draw the shot."
- "The ball follows my intention."
- "The goalkeeper feels alive."
- "The final shots feel cinematic and stressful."
- "If I score or miss, I understand why."

The game must not feel like a generic left/right penalty selector. The draw gesture is the central product differentiator.

## 3. Product Identity

### 3.1 Genre

Fast emotional skill-arcade penalty game.

### 3.2 Art Direction

The target visual style is rich cartoon sports:

- Simple readable silhouettes.
- Expressive goalkeeper face and body.
- Exaggerated but readable ball motion.
- Clean stadium composition.
- Strong effects during important shots.
- Minimal UI clutter.

### 3.3 Core Design Pillars

1. Expressive control: player input must feel personal and skill-based.
2. Fairness: outcomes must be understandable and must not be secretly forced.
3. Emotional escalation: the match must feel more intense near the end.
4. Micro-cinematics: cinematic motion must amplify gameplay without stopping it.
5. Mobile speed: the game must support short sessions and fast retries.

## 4. Target Platforms

### 4.1 Primary Platform

Mobile web running inside an app WebView.

### 4.2 Secondary Platform

Desktop browser for development, testing, balancing, and QA.

### 4.3 Orientation

The game shall be portrait-first.

Landscape may be supported as a secondary responsive layout, but it must not drive the core composition.

### 4.4 Minimum Supported Display

The game shall support mobile viewport widths down to 320 CSS pixels.

### 4.5 Target Frame Rate

The game shall target 60 FPS during active gameplay.

If a device cannot sustain 60 FPS, the game shall degrade visual effects before degrading input responsiveness.

## 5. Definitions

Gesture: The player's touch or pointer path used to define shot intent.  
Shot intent: Interpreted gameplay data extracted from the gesture.  
Raw path: The original input points captured from the player.  
Trajectory: The generated ball movement path after smoothing and interpretation.  
Controlled variation: Small deterministic or seeded offsets used to avoid repetitive behavior without unfairly overriding player skill.  
Micro-cinematic: A short camera, timing, or FX enhancement lasting less than 700 ms and not removing player agency from the current flow.  
Hero moment: A shot or save classified as unusually dramatic because of match context, trajectory quality, near-contact, post interaction, or decisive outcome.  
Match point: A shot where success can decide the match outcome.  
Pressure: A normalized value from 0 to 1 representing emotional and competitive intensity.

## 6. High-Level Gameplay Loop

1. The match starts with the ball placed in front of the goal.
2. The game enters aiming state.
3. The player draws an upward path from the ball area toward the goal.
4. The input system displays a live energy trail.
5. The gesture interpreter converts the path into shot intent.
6. The ball trajectory system generates a believable arcade shot.
7. The goalkeeper AI predicts, reacts, dives, and animates emotionally.
8. The camera and FX systems amplify the shot according to match pressure.
9. The game resolves the shot as goal, save, or miss.
10. Score, shot count, pressure, and goalkeeper emotion update.
11. The game quickly resets for the next shot.
12. The match ends after the configured shot limit or a decisive result.

## 7. Match Rules

### 7.1 Standard Match

The MVP match shall contain five player shots.

The goalkeeper acts as the opposing side. Each player miss or save counts as a goalkeeper win for that shot.

### 7.2 Scoring

- Goal: player score +1.
- Save: goalkeeper score +1.
- Miss: goalkeeper score +1.

### 7.3 Match End

The match ends when one of the following is true:

- The player has taken five shots.
- The match result is mathematically decided before the fifth shot.
- A future sudden-death mode resolves a tie.

### 7.4 Restart

After match end, the player shall be able to restart with one clear action.

Restart must not require navigating away from the game screen.

## 8. Game States

The game shall use explicit states. Rendering may continue in all states, but gameplay authority must belong to the state machine.

### 8.1 Required States

| State | Purpose |
|---|---|
| `boot` | Initialize renderer, layout, and critical assets. |
| `ready` | Show playable field and wait for first input. |
| `aiming` | Wait for a valid shot gesture. |
| `drawing` | Capture input path and show live trail. |
| `shot_commit` | Convert gesture into shot intent and lock input. |
| `ball_flight` | Simulate ball, goalkeeper, camera, and FX. |
| `resolution` | Display goal/save/miss feedback. |
| `reset` | Return ball and goalkeeper to next-shot positions. |
| `match_end` | Display final result and restart action. |
| `pause` | Pause simulation on visibility loss or app interruption. |

### 8.2 State Transitions

| From | To | Trigger |
|---|---|---|
| `boot` | `ready` | Critical assets loaded. |
| `ready` | `aiming` | First frame after setup. |
| `aiming` | `drawing` | Pointer/touch starts inside valid shot zone. |
| `drawing` | `shot_commit` | Pointer/touch ends with valid gesture. |
| `drawing` | `aiming` | Gesture cancelled or invalid. |
| `shot_commit` | `ball_flight` | Shot intent generated. |
| `ball_flight` | `resolution` | Goal, save, or miss detected. |
| `resolution` | `reset` | Minimum feedback time elapsed. |
| `reset` | `aiming` | Next shot available. |
| `reset` | `match_end` | Match end condition met. |
| Any active state | `pause` | App/browser visibility lost. |
| `pause` | Previous safe state | Visibility restored. |

### 8.3 Timing Requirements

- `shot_commit` should last no more than 100 ms.
- `resolution` should last 600-1200 ms depending on shot importance.
- `reset` should last 300-600 ms.
- The player should generally be able to take another shot within 1.8 seconds after a normal outcome.

## 9. Input System Requirements

### 9.1 Supported Input

The game shall support:

- Touch input.
- Pointer input.
- Mouse input for desktop QA.

### 9.2 Valid Shot Zone

The shot gesture must begin inside a defined ball interaction zone.

MVP requirement:

- The valid zone shall be centered around the ball.
- The valid zone radius shall scale with viewport size.
- Minimum radius: 44 CSS px.
- Recommended radius: 12-16% of viewport width, clamped by layout.

### 9.3 Gesture Capture

The input system shall capture a sequence of points:

```text
point = {
  x: number,
  y: number,
  timestampMs: number
}
```

The system shall sample points when at least one of the following is true:

- Distance from previous accepted point >= 4 CSS px.
- Time since previous accepted point >= 16 ms.

The system shall cap stored points per gesture to prevent memory growth.

MVP cap: 48 points.

### 9.4 Gesture Validity

A gesture shall be considered valid only if:

- It starts inside the valid shot zone.
- It contains at least 3 accepted points.
- Total path distance >= 28 CSS px.
- Final point is above the start point by at least 10 CSS px.
- Gesture duration is between 50 ms and 1200 ms.

Invalid gestures shall return the game to `aiming` without penalty.

### 9.5 Real-Time Feedback

While drawing, the game shall show a live trail.

Trail requirements:

- Must appear within the same frame or next frame after input begins.
- Must not block visibility of the goal.
- Must fade quickly after shot commit.
- Must visually communicate curve and force.

## 10. Gesture Interpretation Requirements

The game shall not replay the raw gesture literally. The raw gesture defines player intention, not exact ball motion.

### 10.1 Shot Intent Output

The interpreter shall output:

```text
shotIntent = {
  targetX: number,
  targetY: number,
  force: number,
  curve: number,
  gestureQuality: number,
  durationMs: number,
  pathComplexity: number
}
```

### 10.2 Force

Force shall be normalized to a tunable range.

Recommended MVP formula:

```text
pathDistance = sum(distance(point[i], point[i-1]))
speed = pathDistance / durationMs
forceRaw = normalize(speed, minSpeed, maxSpeed)
force = clamp(forceRaw, 0.55, 1.35)
```

Recommended values:

- `minSpeed`: 0.25 CSS px/ms.
- `maxSpeed`: 1.20 CSS px/ms.
- `force`: 0.55 to 1.35.

### 10.3 Target Mapping

The final gesture point shall influence the target inside the goal.

Requirements:

- Horizontal endpoint position maps to goal width.
- Upward gesture height maps to shot height.
- Target must be clamped inside or near the goal frame.
- Slight misses may be allowed outside the goal frame when gesture quality is poor or target exceeds bounds.

### 10.4 Curve Extraction

Curve shall be extracted from lateral deviation between the gesture and a straight line from start to end.

Recommended MVP formula:

```text
straightPointAtT = lerp(startPoint, endPoint, t)
offsetAtT = signedDistance(pointAtT, straightLine)
weightedOffset = offsetAtT * centerWeight(t)
curveRaw = average(weightedOffset) / curveReferenceWidth
curve = clamp(curveRaw, -1, 1)
```

Recommended values:

- `centerWeight(t) = 1 - abs(t - 0.5) * 2`.
- `curveReferenceWidth = 110-140 CSS px`.
- `curve = -1` means strong left curve.
- `curve = 1` means strong right curve.

### 10.5 Gesture Quality

Gesture quality shall represent input confidence and smoothness.

It may be based on:

- Excessive angular jitter.
- Sudden direction reversals.
- Gesture too short.
- Gesture too slow.
- Gesture ending far from intended goal area.

Recommended output range:

- `0.0`: very poor.
- `1.0`: excellent.

MVP clamp:

- Minimum effective quality: 0.35.
- Maximum: 1.0.

### 10.6 Input Forgiveness

The game shall include input forgiveness to reduce frustration:

- Small hand jitter must be smoothed.
- Valid but imperfect gestures must still produce readable shots.
- The game must not punish tiny input noise as a full miss.
- Poor quality should reduce precision, not fully steal control.

## 11. Ball Trajectory Requirements

### 11.1 Motion Style

Ball motion shall use custom arcade trajectory logic.

The game shall not require a full rigid-body physics engine for the MVP.

### 11.2 Trajectory Generation

The trajectory shall be generated from:

- Ball start position.
- Target position.
- Force.
- Curve.
- Gesture quality.
- Match pressure.

Recommended MVP method:

```text
p0 = ballStart
p3 = interpretedTarget
normal = perpendicular(p0, p3)
curveOffset = curve * maxCurvePixels
p1 = point 30% toward target + upward lift + normal * curveOffset * 0.45
p2 = point 70% toward target + normal * curveOffset
ballPosition(t) = cubicBezier(p0, p1, p2, p3)
```

Recommended values:

- `maxCurvePixels`: 80-160 CSS px depending on viewport.
- Flight duration: 450-850 ms.
- Higher force reduces flight duration.

### 11.3 Depth Illusion

Because the game is 2D, the ball shall scale during flight to imply depth.

Requirements:

- Ball appears larger near the shooter.
- Ball appears smaller near the goal.
- Scaling must not obscure collision readability.

### 11.4 Outcome Zones

The goal shall contain:

- Valid scoring area.
- Post/crossbar boundaries.
- Miss area outside goal.
- Goalkeeper save reach area.

The game shall not use permanently impossible scoring corners. Difficult corners may be harder for the goalkeeper to reach, but they must not be guaranteed goals.

### 11.5 Collision Resolution

Collision checks shall be deterministic for a given shot intent and AI state.

Required collision types:

- Ball inside goal and not saved: goal.
- Ball intersects goalkeeper reach during save window: save.
- Ball outside valid goal frame at resolution time: miss.
- Ball hits post/crossbar: miss or rebound, depending on tuning.

### 11.6 Save Readability

When a save occurs:

- The goalkeeper hand/body must visually overlap or clearly reach the ball.
- The save must not look like the ball was stopped by invisible logic.
- A save impact effect must appear at or near contact.

## 12. Goalkeeper AI Requirements

### 12.1 AI Design

The goalkeeper shall behave as an expressive semi-adaptive opponent.

The AI shall appear alive through:

- Emotion.
- Anticipation.
- Timing variation.
- Risk behavior.
- Readable mistakes.

The AI must not cheat in a way that makes valid player shots feel invalid.

### 12.2 AI Layers

The goalkeeper AI shall include four conceptual layers:

| Layer | Responsibility |
|---|---|
| Emotional | Determine mood and body tension. |
| Tactical | Predict shot target and choose dive intent. |
| Physical | Move body and reach area. |
| Animation | Show face, pose, anticipation, and recovery. |

### 12.3 Mood States

| Mood | Visual Behavior | Gameplay Behavior |
|---|---|---|
| Calm | Neutral face, balanced stance. | Baseline reaction. |
| Focused | Narrow eyes, tighter posture. | Better target reading. |
| Nervous | Wider eyes, hesitant pose. | Slightly delayed reaction. |
| Aggressive | Forward lean, intense expression. | Earlier commitment, more wrong guesses. |
| Desperate | Exaggerated breathing, tense motion. | Riskier dives, larger variance. |

### 12.4 Mood Transition Inputs

Mood shall be based on:

- Shot index.
- Current score.
- Consecutive player goals.
- Consecutive goalkeeper saves.
- Match point status.
- Last shot outcome.
- Pressure value.

### 12.5 Required Mood Transition Rules

The following rules shall exist in MVP tuning or equivalent:

```text
if pressure < 0.25:
  mood = calm

if pressure >= 0.25 and pressure < 0.55:
  mood = focused

if playerScoreLead >= 2 or playerConsecutiveGoals >= 2:
  mood = nervous

if goalieScoreLead >= 2:
  mood = aggressive

if matchPointAgainstGoalie == true:
  mood = desperate

if finalShot == true and scoreDifference <= 1:
  mood = focused or desperate depending on score context
```

The final implementation may tune these rules, but it must preserve the design outcome: the goalkeeper becomes visibly more emotional when the match becomes more dangerous.

### 12.6 Prediction

The goalkeeper shall predict a target based on shot intent.

Prediction accuracy shall depend on:

- Mood.
- Difficulty.
- Shot quality.
- Shot curve.
- Match pressure.

Recommended prediction model:

```text
predictionError = baseError
predictionError += curveDifficulty
predictionError -= difficultySkill
predictionError += moodVariance
predictedTarget = actualTarget + seededOffset(predictionError)
```

### 12.7 Reaction Timing

Reaction timing shall be tunable.

Recommended MVP ranges:

- Calm: 140-190 ms.
- Focused: 105-155 ms.
- Nervous: 170-240 ms.
- Aggressive: 80-130 ms but higher wrong-commit chance.
- Desperate: 70-180 ms with high variance.

### 12.8 Reach

Goalkeeper reach shall be readable and fair.

Reach requirements:

- Reach area should be represented by body/hand animation.
- Reach should expand during dive peak.
- Reach should be weaker during wrong-footed movement.
- Reach should not teleport.

## 13. Emotional Pressure System

### 13.1 Pressure Value

The game shall calculate a normalized pressure value from 0 to 1.

Recommended MVP formula:

```text
shotProgress = currentShotIndex / maxShots
scoreTension = 1 - clamp(abs(playerScore - goalieScore) / 3, 0, 1)
matchPointBonus = matchPoint ? 0.25 : 0
finalShotBonus = finalShot ? 0.20 : 0
pressure = clamp(shotProgress * 0.55 + scoreTension * 0.25 + matchPointBonus + finalShotBonus, 0, 1)
```

### 13.2 Cinematic Escalation Floor

The game shall apply a soft minimum escalation by shot number to ensure some cinematic growth even in one-sided matches. However, the escalation floor must respect match context — a meaningless shot in a decided match must not receive maximum cinematic intensity.

The escalation floor is split into two components:

**Base floor** — always applies, ensures early shots are not completely flat:

| Shot Number | Base Floor |
|---|---:|
| 1 | 0.10 |
| 2 | 0.18 |
| 3 | 0.30 |
| 4 | 0.45 |
| 5 | 0.50 |

**Context multiplier** — scales the final shot floor based on how much the shot matters:

```text
scoreTension = 1 - clamp(abs(playerScore - goalieScore) / 3, 0, 1)
matchDecided = isMatchMathematicallyDecided()
contextMultiplier = matchDecided ? 0.3 : (0.4 + scoreTension * 0.6)
escalationFloor = baseFloor[currentShotIndex] * contextMultiplier
```

Final pressure:

```text
pressure = max(calculatedPressure, escalationFloor)
```

**Example outcomes for shot 5:**

| Score | scoreTension | matchDecided | contextMultiplier | Floor | Feel |
|---|---:|---|---:|---:|---|
| 2-2 | 1.0 | No | 1.0 | 0.50 | Decisive — full drama |
| 3-1 | 0.33 | Yes | 0.3 | 0.15 | Comfortable win — mild |
| 0-4 | 0.0 | Yes | 0.3 | 0.15 | Blowout — quiet ending |
| 2-3 | 0.67 | No | 0.80 | 0.40 | Must-score — high tension |

Note: The calculated pressure formula (§13.1) already includes `matchPointBonus` and `finalShotBonus`, so a tied final shot will naturally reach near-maximum pressure through the formula itself. The floor exists only to prevent completely flat early shots, not to override match context.

This floor shall only affect emotional, camera, FX, UI, and audio intensity. It shall not directly change the shot outcome.

### 13.3 Pressure Effects

Pressure shall affect:

- Goalkeeper mood.
- Camera intensity.
- Crowd/audio intensity.
- Trail brightness.
- Impact shake.
- Slow-motion likelihood.
- UI urgency.

Pressure shall not directly force a goal, save, or miss.

## 14. Cinematic Camera Requirements

### 14.1 Philosophy

Cinematics must enhance gameplay, never interrupt it.

The game shall use micro-cinematics rather than long cutscenes.

### 14.2 Camera Layers

The camera shall support layered behavior:

| Layer | Purpose |
|---|---|
| Base framing | Stable portrait shot of ball, goalkeeper, and goal. |
| Ball tracking | Subtle follow after shot. |
| Tension zoom | Zoom during important shots. |
| Impact shake | Short shake on save, goal, or post hit. |
| Slow-motion pulse | Brief time dilation near decisive contact. |
| Emotional focus | Optional pre-shot emphasis on goalkeeper. |

### 14.3 Camera Intensity

Camera intensity shall be derived from pressure.

Recommended mapping:

```text
cameraIntensity = smoothstep(pressure)
```

### 14.4 Zoom Requirements

Recommended MVP zoom range:

- Normal: 1.00.
- Medium pressure: 1.03-1.06.
- Final/match-point shot: 1.07-1.12.

Zoom must not crop the ball, goalkeeper, or goal frame in a way that harms gameplay readability.

### 14.5 Ball Tracking

Ball tracking shall activate during `ball_flight`.

Requirements:

- Tracking must be subtle.
- Tracking strength increases with pressure.
- Tracking must not cause motion sickness or disorientation.
- The goal frame must remain readable.

Recommended tracking strength:

- Low pressure: 0.05-0.10.
- Medium pressure: 0.10-0.18.
- High pressure: 0.18-0.30.

### 14.6 Camera Damping

Camera movement shall be interpolated.

Recommended damping:

```text
cameraPosition = lerp(cameraPosition, targetPosition, 1 - exp(-damping * deltaTime))
cameraZoom = lerp(cameraZoom, targetZoom, 1 - exp(-zoomDamping * deltaTime))
```

Recommended values:

- Position damping: 8-14.
- Zoom damping: 6-10.

### 14.7 Shake

Shake shall be short and pressure-aware.

Requirements:

- Goal shake should feel powerful but not obscure the result.
- Save shake should be sharper than goal shake.
- Post hit shake may be brief and metallic.

Recommended duration:

- Light impact: 80-140 ms.
- Strong goal/save: 160-260 ms.
- Final-shot dramatic impact: max 350 ms.

### 14.8 Slow Motion

Slow motion may trigger only in important contexts:

- Final shot.
- Match point.
- Near save.
- Post/crossbar contact.
- Very high-curve shot close to the goalkeeper.

Requirements:

- Duration: 180-450 ms.
- Time scale: 0.35-0.70.
- Must not trigger every shot.
- Must not delay reset beyond acceptable pacing.

## 15. FX Requirements

### 15.1 FX System Architecture

The FX system shall be procedural-first and pool-based.

Required characteristics:

- FX objects shall be spawned by gameplay events.
- FX intensity shall scale with pressure and hero moment classification.
- FX shall read gameplay state but must not decide gameplay outcomes.
- Particle and trail objects shall use pooling during active play.
- Low-end devices shall be able to reduce FX density without changing gameplay.

FX event inputs shall include:

```text
eventType
position
force
curve
pressure
heroMomentType
outcome
```

### 15.2 Trail FX

The ball shall have a trail during flight.

Trail intensity shall depend on:

- Force.
- Curve.
- Pressure.

Trail rendering should use fading segments or a textured strip.

Requirements:

- Trail draws behind the ball.
- Trail lifetime: 180-450 ms.
- Segment opacity decreases with age.
- Trail width scales with force and pressure.
- Trail color/brightness may shift slightly with curve strength.
- Trail must not hide the goalkeeper or goal frame.

### 15.3 Drawing Trail

The input trail shall:

- Follow the player's finger.
- Show curve direction.
- Fade after shot commit.
- Use stronger visual energy on decisive shots.

Recommended drawing trail behavior:

- Use a smooth line or short segmented ribbon.
- Fade-out duration: 120-260 ms after shot commit.
- Add small energy particles only when pressure >= 0.60.
- Disable extra particles on low-end fallback.

### 15.4 Goal FX

On goal:

- Net pulse or stretch.
- Ball impact burst.
- Crowd/visual celebration placeholder.
- Optional quick zoom pulse.

Goal FX intensity shall scale with shot importance:

- Normal goal: net pulse + light burst.
- High-pressure goal: stronger net stretch + screen flash pulse.
- Hero moment goal: enhanced trail residue + extended net ripple + crowd surge.

### 15.5 Save FX

On save:

- Contact spark or burst.
- Ball deflection.
- Goalkeeper squash/stretch or recoil.
- Short camera shake.

Save FX must originate at the visual contact point.

Recommended save feedback:

- Contact burst lifetime: 120-220 ms.
- Ball deflection trail: 180-350 ms.
- Final-shot save may trigger brief hit stop and stronger shake.

### 15.6 Miss FX

On miss:

- Subtle ball exit trail.
- Post hit effect if applicable.
- Clear visual distinction from save.

Miss FX shall be quieter than goal/save FX unless the miss hits the post or crossbar.

### 15.7 Screen-Space FX

The game may use screen-space effects for cinematic emphasis.

Allowed effects:

- Subtle vignette during high pressure.
- Brief white/colored flash on goal.
- Optional chromatic impact offset on high-end devices only.

Restrictions:

- Screen effects must not obscure the ball or goal frame.
- Screen effects must be reduced or disabled in reduced-motion mode.
- Chromatic effects shall be disabled in low-end fallback.

### 15.8 Hit Stop

The game may use a very brief hit stop at impact.

Requirements:

- Duration: 40-90 ms.
- Only on strong saves, post hits, or decisive goals.
- Must not make input feel delayed.

### 15.9 Procedural vs Sprite-Based FX

The MVP should prefer procedural FX for:

- Drawing trail.
- Ball trail.
- Simple sparks.
- Screen flash.
- Vignette.

Sprite-based FX may be used for:

- Net ripple highlights.
- Crowd confetti in later production.
- Branded event-specific celebration effects.

## 16. Animation Requirements

### 16.1 Goalkeeper Animation

The goalkeeper shall support:

- Idle.
- Focus stance.
- Nervous stance.
- Pre-dive anticipation.
- Dive left.
- Dive right.
- Dive up/center.
- Save contact.
- Miss reaction.
- Goal conceded reaction.
- Reset.

### 16.2 Emotional Overlays

Facial expression and pose shall reflect mood.

Required expression features:

- Eye shape changes.
- Brow angle changes.
- Mouth expression changes.
- Body tension changes.

### 16.3 Animation Timing

Goalkeeper dive animation shall align with gameplay reach.

The animation must not show a save if the collision system resolves a goal.

The animation must not show failure if the collision system resolves a save.

### 16.4 Animation Style

The style shall favor readability over realism.

Allowed:

- Squash/stretch.
- Anticipation frames.
- Exaggerated hand reach.
- Snappy recovery.

Not allowed:

- Long non-interactive celebration animations during normal flow.
- Ambiguous save poses that do not show contact.

### 16.5 Animation Format Requirement

The production animation approach shall prioritize fast loading and expressive goalkeeper emotion.

Recommended MVP approach:

- Sprite-sheet or lightweight rigged animation for body poses.
- Procedural facial overlays for mood changes.
- Procedural squash/stretch for dive impact and recovery.

Full skeletal runtime animation may be used only if mobile WebView performance and bundle size remain within budget.

## 17. UI Requirements

### 17.1 In-Game UI

The UI shall display:

- Player score.
- Goalkeeper score or save count.
- Current shot number.
- Match result text when resolved.
- Restart action after match end.

### 17.2 UI Placement

UI must not cover:

- Ball start zone.
- Goal corners.
- Goalkeeper body.
- Gesture drawing path during normal input.

### 17.3 Text Requirements

In-game text must be short.

The UI shall not display long instructions during active play.

### 17.4 First-Time Clarity

The game may display a short first-use hint such as "Draw your shot" or equivalent Arabic/localized copy.

The hint shall disappear after the first valid gesture.

## 18. Audio Requirements

### 18.1 Audio Role

Audio shall act as an emotional amplifier, not only as decorative feedback.

The audio system shall respond to:

- Shot force.
- Shot curve.
- Pressure.
- Outcome.
- Hero moment classification.
- Goalkeeper contact.

### 18.2 Audio Technology

Production implementation shall use Howler.js or an equivalent Web Audio-backed library that supports:

- Browser/WebView compatibility.
- Low-latency sound effects.
- Looping ambience.
- Volume fades.
- Muting and pause/resume handling.

### 18.3 Audio Events

The audio system shall include:

- Kick.
- Ball whoosh.
- Curve/air movement.
- Goal net impact.
- Save impact.
- Post impact.
- Crowd reaction.
- Tension swell.

### 18.4 Adaptive Audio

Audio intensity shall scale with pressure.

Required mapping:

| Match Context | Audio Response |
|---|---|
| Low pressure | Light crowd ambience, clean kick and ball sounds. |
| Medium pressure | Slight crowd lift and subtle tension swell. |
| High pressure | Stronger crowd bed, tighter whoosh, higher impact emphasis. |
| Final shot or match point | Tension swell before/while shooting, crowd anticipation, stronger result burst. |
| Near save | Short impact swell or crowd gasp. |
| Goal | Crowd burst, net impact, short celebration accent. |
| Save | Contact punch, deflection sound, crowd gasp or keeper reaction. |

### 18.5 Audio Mixing Rules

Audio shall remain clear and fast.

Requirements:

- Kick sound must trigger immediately on shot commit.
- Ball whoosh should scale with force and curve.
- Tension loops must fade in/out, not restart abruptly.
- Result sounds must not delay gameplay reset.
- Reduced-intensity mode shall lower crowd and tension volume.

### 18.6 Web Audio Constraint

Audio shall initialize only after user interaction to comply with browser and WebView autoplay restrictions.

### 18.7 Audio Fallback

If audio fails to initialize, the game shall remain fully playable and shall not block input, rendering, or match progression.

## 19. Difficulty and Balancing Requirements

### 19.1 Difficulty Inputs

Difficulty shall be tunable using:

- Goalkeeper prediction error.
- Reaction time.
- Reach radius.
- Wrong-commit chance.
- Shot quality tolerance.
- Curve difficulty multiplier.

### 19.2 Difficulty Presets

The game should define difficulty presets as data, not hard-coded logic.

Recommended presets:

| Preset | Prediction Error | Reaction Time | Reach | Wrong Commit Chance |
|---|---:|---:|---:|---:|
| Easy | High | Slower | Lower | Higher |
| Normal | Medium | Baseline | Baseline | Medium |
| Hard | Lower | Faster | Higher | Lower |

The MVP may ship with one default preset, but values shall be stored in a tuning configuration that can support additional presets later.

### 19.3 Shot Progression

Difficulty may increase slightly across a match, but pressure must not secretly force outcomes.

Recommended progression:

| Shot Number | Goalkeeper Skill Multiplier |
|---|---:|
| 1 | 0.85 |
| 2 | 0.95 |
| 3 | 1.00 |
| 4 | 1.05 |
| 5 | 1.10 |

The multiplier may affect prediction error, reaction timing, and reach within documented bounds.

### 19.4 Adaptive Difficulty

Adaptive difficulty, if used, shall be subtle and bounded.

Allowed adaptive inputs:

- Player consecutive goals.
- Player consecutive misses.
- Gesture quality trend.
- Match score difference.

Restrictions:

- Adaptive difficulty must not override a valid shot into a forced miss or forced save.
- Adaptive changes must be gradual.
- Adaptive changes should be disabled or fixed for competitive/reward modes unless product rules explicitly allow it.

### 19.5 Goalkeeper Learning

The goalkeeper may appear to learn across a match through animation and prediction behavior.

Allowed learning effects:

- Slightly improved prediction after repeated similar shot direction.
- Anticipation pose if player repeats the same corner.
- Increased wrong-commit chance if player breaks the pattern with a curve.

Learning must be explainable through visible goalkeeper behavior.

### 19.6 Fairness Rules

The game shall not:

- Force a miss after a valid high-quality shot.
- Force an impossible save for drama.
- Change the final target after shot commit except through documented quality/error rules.
- Hide outcome logic from visual feedback.

### 19.7 Controlled Variation

Controlled variation is allowed for:

- Reaction timing.
- Prediction offset.
- Animation variant.
- FX variant.

Controlled variation must be bounded, seedable, and explainable through visible behavior.

### 19.8 Anti-Frustration Requirements

The game shall include:

- Forgiving valid input detection.
- Clear save contact.
- Clear miss reason.
- Fast retry.
- No long failure animations.
- No repeated unskippable cinematic sequence.

## 20. Telemetry Requirements

The system should be designed to emit gameplay events even if analytics are not implemented in MVP.

Recommended events:

```text
match_started
shot_started
gesture_completed
shot_committed
shot_resolved
goal_scored
shot_saved
shot_missed
match_ended
restart_selected
performance_warning
```

Recommended event properties:

```text
shotIndex
pressure
force
curve
gestureQuality
flightDurationMs
goalkeeperMood
reactionTimeMs
predictedTargetError
outcome
matchDurationMs
deviceClass
fpsAverage
```

Telemetry must not block gameplay.

## 21. Performance Requirements

### 21.1 Frame Rate

Target:

- 60 FPS during active play.

Minimum acceptable:

- 45 FPS on lower-end supported devices with reduced FX.

### 21.2 Memory

The game shall avoid frequent allocations during active gameplay.

Object pooling should be used for:

- Trail points.
- Particles.
- Impact effects.
- Temporary visual markers.

### 21.3 Canvas

The game shall use a single canvas.

Multiple canvas layers are not allowed in MVP unless a measured performance need exists.

### 21.4 GPU and Texture Budgets

The game shall define performance budgets before production art lock.

Recommended MVP budgets:

- Initial critical texture memory: 16-32 MB.
- Total active texture memory on mid-range mobile: target under 64 MB.
- Particle count during normal shots: 20-60 active particles.
- Particle count during hero moments: max 120 active particles.
- Overdraw-heavy full-screen effects should be limited to short pulses.

The renderer shall prefer texture atlases and batched sprites where practical.

### 21.5 Low-End Fallbacks

The game shall support reduced visual quality:

- Lower particle count.
- Simpler trail.
- Reduced camera shake.
- Disabled advanced post effects.
- Reduced background animation.

Fallbacks must not reduce gameplay fairness.

### 21.6 Battery Considerations

The game shall:

- Pause simulation when hidden.
- Avoid unnecessary background animation on inactive states.
- Avoid heavy full-screen effects on every shot.

## 22. Mobile WebView Requirements

### 22.1 Safe Areas

The layout shall respect mobile safe areas where supported.

Important UI must not overlap:

- Camera notch.
- Home indicator.
- System gesture areas.

### 22.2 DPI Scaling

The renderer shall account for device pixel ratio.

Recommended cap:

- Use device pixel ratio up to a performance-safe maximum.
- MVP cap: 2.0 unless testing proves higher is safe.

### 22.3 Touch Behavior

The game shall prevent page scroll and browser gesture interference during play.

### 22.4 App Interruptions

The game shall handle:

- Browser tab hidden.
- WebView pause.
- App background.
- Orientation change.
- Resize.

On restore, the game should resume from a safe state or reset the current shot without corrupting match score.

## 23. Asset Pipeline Requirements

### 23.1 Texture Strategy

Production should use texture atlases for 2D sprites.

Atlas requirements:

- Group critical gameplay assets separately from optional polish.
- Avoid loading large non-critical assets before first playable state.
- Use compressed formats where platform support allows.

### 23.2 Asset Priority

Load priority:

1. Ball.
2. Goal.
3. Goalkeeper core sprites.
4. UI essentials.
5. Basic trail/impact FX.
6. Stadium background.
7. Advanced cinematic FX.
8. Optional cosmetics.

### 23.3 Resolution Budget

Assets must be readable on high-DPI mobile screens but not waste memory.

Recommended MVP sprite guidance:

- Ball: high clarity, small texture.
- Goalkeeper: highest character detail priority.
- Background: stylized and optimized.
- FX: atlas-based or procedural where possible.

### 23.4 Animation Format

Acceptable production options:

- Sprite sheets.
- Lightweight rigged animation.
- Procedural overlays for facial emotion.

The selected approach must support fast loading and visible emotional states.

## 24. Save, Miss, and Goal Clarity Requirements

### 24.1 Goal Clarity

A goal must clearly show:

- Ball crossing into goal.
- Net or goal feedback.
- Positive score update.

### 24.2 Save Clarity

A save must clearly show:

- Goalkeeper contact or believable reach.
- Ball deflection or stop.
- Save feedback.

### 24.3 Miss Clarity

A miss must clearly show:

- Ball outside frame, post hit, or high/wide trajectory.
- Distinct feedback from a save.

The player must be able to understand the outcome within 500 ms of resolution.

## 25. Localization Requirements

The game should support localization-ready UI strings.

Initial languages:

- Arabic.
- English.

UI layout must support right-to-left language where needed.

## 26. Accessibility Requirements

### 26.1 Readability

UI text must maintain adequate contrast against the game background.

### 26.2 Motion Sensitivity

The game should support a reduced-motion setting or automatic reduced camera motion mode.

Reduced motion shall lower:

- Shake.
- Zoom pulses.
- Slow-motion frequency.
- Flash intensity.

### 26.3 Input Accessibility

Touch zones must be large enough for mobile use.

The ball interaction zone must not require pixel-perfect input.

## 27. Security and Privacy Requirements

The MVP shall not collect personal data unless explicitly added in a later product phase.

Telemetry, if added, shall use anonymous gameplay events unless user accounts are introduced.

## 28. Scalability Requirements

The product architecture should support future additions:

- Tournament mode.
- Country/team skins.
- Seasonal event visuals.
- Goalkeeper skins.
- Ball skins.
- Replay sharing.
- Leaderboards.
- Daily challenge.

These features are not MVP requirements, but the MVP must not hard-code assumptions that make them unusually expensive.

### 28.1 Required Architecture Hooks

The MVP shall preserve extension points for:

- Match rule configuration.
- Asset skin/theme selection.
- Difficulty preset selection.
- Telemetry event enrichment.
- Replay-like deterministic shot reconstruction.
- Localization string replacement.

The MVP may implement these hooks with simple local data, but it should not bury them inside rendering or input code.

## 29. MVP Scope

### 29.1 Included

The MVP shall include:

- Portrait responsive gameplay.
- Draw-to-shoot input.
- Gesture interpretation.
- Curved ball trajectory.
- Goal/save/miss resolution.
- Five-shot match flow.
- Goalkeeper emotional states.
- Goalkeeper prediction and dive behavior.
- Micro-cinematic camera.
- Basic trails and impact FX.
- Match result and restart.

### 29.2 Excluded

The MVP shall not require:

- Multiplayer.
- Backend accounts.
- Real-money rewards.
- Leaderboard.
- Full tournament system.
- Final brand art.
- Full sound mix.
- Replay export.

## 30. Acceptance Criteria

### 30.1 Gameplay

The MVP is accepted when:

- A player can complete a five-shot match.
- Drawing direction affects shot target.
- Drawing curve affects ball curve.
- Fast and slow gestures produce noticeably different force.
- Goalkeeper saves are visually readable.
- Goals, saves, and misses resolve consistently.
- The match can restart immediately after completion.

### 30.2 Emotional Experience

The MVP is accepted when:

- The goalkeeper visibly changes mood as pressure rises.
- The final shot feels more dramatic than the first shot.
- Camera and FX intensity increase during match-point moments.
- Cinematic effects do not make the game feel slow or annoying.

### 30.3 Technical

The MVP is accepted when:

- The game runs in mobile browser and desktop browser.
- Active gameplay targets 60 FPS on test devices.
- The game handles resize and app visibility changes.
- Invalid gestures do not break the match state.
- The game does not require network connectivity for core play.

### 30.4 Fairness

The MVP is accepted when:

- Repeating the same shot intent under the same AI seed produces the same result.
- Controlled variation stays inside documented ranges.
- No outcome appears to be caused by invisible goalkeeper reach.
- Player misses are visually attributable to input, target, or timing.

## 31. Open Product Decisions

The following decisions must be finalized before full production:

1. Final orientation policy: portrait-only or portrait-first with landscape support.
2. Whether the shooter character/foot is visible or only the ball is shown.
3. Final art pipeline: sprite sheets, lightweight rig, or hybrid.
4. Exact match format: fixed five shots, sudden death, or event-specific rules.
5. Audio scope for MVP.
6. Monetization/reward integration, if any.
7. Analytics provider and privacy policy requirements.

## 32. Technology Stack

### 32.1 Language

The game shall be implemented in TypeScript with strict type checking enabled.

Rationale:

- Gameplay systems require clear contracts.
- AI, camera, input, physics, and state logic benefit from explicit types.
- The codebase must remain maintainable as tuning complexity grows.

### 32.2 Renderer

The game shall use PixiJS for 2D rendering.

Rationale:

- GPU-accelerated 2D rendering.
- Lightweight compared with full game engines.
- Good fit for mobile web and WebView deployment.
- Allows custom camera, FX, and gameplay architecture.

### 32.3 Build Tool

The game shall use Vite for local development and production builds.

Requirements:

- Fast local iteration.
- TypeScript support.
- Production asset bundling.
- Browser-based preview suitable for QA.

### 32.4 Audio Library

The game shall use Howler.js or an equivalent Web Audio-backed abstraction for production audio.

Requirements:

- Works across mobile browsers and WebViews.
- Supports low-latency sound effects.
- Supports ambience loops and smooth fades.
- Handles mute, pause, resume, and user-gesture initialization.

### 32.5 Animation

The game may use GSAP for UI, camera, and non-gameplay tweens.

Gameplay-critical motion shall remain simulation-driven.

Requirements:

- Ball movement must not depend on animation timelines.
- Goalkeeper collision timing must not be controlled only by visual tween state.
- Camera and FX may use procedural interpolation or GSAP if gameplay state remains authoritative.

### 32.6 Physics

The game shall use custom arcade physics.

The MVP shall not use Box2D, Matter.js, or another rigid-body physics engine.

Required physics style:

- Ball motion: spline-influenced trajectory.
- Collision: simple circle, capsule, rectangle, and goal-zone checks.
- Gravity: stylized, if used.
- Net reaction: visual animation, not full cloth simulation.
- Bounce: damped arcade response.

### 32.7 State Management

The game shall use custom lightweight state management.

Redux or similar heavy global frameworks are not required for MVP.

Requirements:

- State shall be organized in a readable runtime state tree.
- Systems shall have clear read/write ownership.
- Deterministic state snapshots should be possible for debugging and replay-like testing.

### 32.8 Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Unity WebGL | Large bundle, slow startup, high memory/battery cost, risky mobile WebView performance. |
| Phaser | Useful for prototypes but more opinionated than needed, less direct control over camera/runtime architecture. |
| Box2D/Matter.js | Over-engineered for this arcade penalty game and harder to tune for emotional readability. |

## 33. Game Loop Architecture

### 33.1 Simulation Model

The game shall use a fixed-step simulation loop at 60 ticks per second.

Rendering shall use `requestAnimationFrame` and may run independently of simulation tick timing.

Required fixed delta:

```text
simulationDt = 1 / 60 seconds
```

### 33.2 Determinism Requirement

Gameplay outcomes shall be computed by the fixed-step simulation, not by variable frame rendering.

This requirement supports:

- Fairness across devices.
- Reproducible debugging.
- Seeded controlled variation.
- Stable collision timing.

### 33.3 Update Order

Each simulation tick shall execute systems in this order:

1. Input buffer update.
2. Gesture capture and interpretation.
3. Match phase/state machine update.
4. Goalkeeper AI decision update.
5. Ball trajectory/physics update.
6. Collision and outcome detection.
7. Match score and pressure update.
8. Camera state update.
9. FX state update.
10. Audio trigger evaluation.
11. UI state update.

### 33.4 Rendering Rule

Rendering shall read state and draw the current frame.

Rendering must not mutate gameplay-authoritative state.

### 33.5 Delta Management

If rendering falls behind, the simulation may process multiple fixed steps in one rendered frame.

Requirements:

- Maximum catch-up steps per rendered frame: 3.
- If more than 3 steps are needed, the game may drop excess accumulated time to prevent a spiral-of-death.
- The game should record a `performance_warning` telemetry event if catch-up drops occur repeatedly.

### 33.6 Interpolation

Rendering may interpolate between previous and current simulation snapshots for smoother visuals.

Interpolation shall not affect collision or outcome logic.

## 34. Render Pipeline and Layers

### 34.1 Single Canvas

The renderer shall use one canvas.

Logical layers shall be implemented inside the PixiJS scene graph.

### 34.2 Logical Layers

The renderer shall organize draw calls into these logical layers:

| Layer | Z-Order | Content |
|---|---:|---|
| Background | 0 | Stadium, crowd, field, sky, environment. |
| Goal Back | 1 | Net back, rear goal elements. |
| Gameplay | 2 | Goalkeeper, ball, active gameplay actors. |
| Goal Front | 3 | Goal posts/crossbar/front net details. |
| FX | 4 | Trails, particles, impacts, net ripple highlights. |
| UI | 5 | Score, shot counter, result text, restart action. |
| Cinematic Overlay | 6 | Vignette, flash, slow-motion treatment, screen pulse. |

### 34.3 Draw Order Rules

Required draw order:

- Stadium/background draws first.
- Net back draws behind ball and goalkeeper.
- Goalkeeper draws before ball when ball is in front of the keeper.
- Ball trail draws behind ball.
- Ball draws above trail.
- Front goal frame draws above ball when needed for depth illusion.
- UI draws above gameplay but must not block core play areas.
- Cinematic overlay draws last.

### 34.4 Screen Effects

Screen effects shall be pressure-aware.

Allowed:

- Subtle vignette at high pressure.
- Short flash pulse on goal.
- Impact pulse on save/post hit.
- Optional chromatic impact offset on high-end devices.

Restrictions:

- Screen effects must respect reduced-motion settings.
- Screen effects must be disabled or reduced in low-end fallback.
- Screen effects must not obscure outcome readability.

## 35. Runtime State Model

### 35.1 State Tree

The game shall maintain a central runtime state tree with clear ownership.

Required structure:

```text
GameState
 ├── match: MatchState
 │    ├── phase: GamePhase
 │    ├── shotIndex: number
 │    ├── maxShots: number
 │    ├── playerScore: number
 │    ├── goalieScore: number
 │    ├── pressure: number
 │    ├── heroMoment: HeroMoment | null
 │    └── result: MatchResult | null
 ├── input: InputState
 │    ├── isDrawing: boolean
 │    ├── rawPoints: GesturePoint[]
 │    └── lastIntent: ShotIntent | null
 ├── ball: BallState
 │    ├── position: Vec2
 │    ├── previousPosition: Vec2
 │    ├── trajectoryProgress: number
 │    ├── trajectory: BezierCurve | null
 │    ├── scale: number
 │    └── visible: boolean
 ├── goalie: GoalieState
 │    ├── position: Vec2
 │    ├── mood: GoalieMood
 │    ├── prediction: Vec2 | null
 │    ├── diveState: DivePhase
 │    ├── reachRadius: number
 │    └── emotionalIntensity: number
 ├── camera: CameraState
 │    ├── offset: Vec2
 │    ├── zoom: number
 │    ├── shakeIntensity: number
 │    ├── trackingWeight: number
 │    └── timeScale: number
 ├── fx: FXState
 │    ├── activeTrails: Trail[]
 │    ├── activeParticles: Particle[]
 │    ├── screenVignette: number
 │    ├── flashIntensity: number
 │    └── hitStopRemainingMs: number
 ├── audio: AudioState
 │    ├── unlocked: boolean
 │    ├── ambienceIntensity: number
 │    └── pendingEvents: AudioEvent[]
 └── ui: UIState
      ├── scoreVisible: boolean
      ├── resultText: string | null
      └── hintVisible: boolean
```

### 35.2 Read/Write Ownership

Systems shall have explicit ownership:

| System | Reads | Writes |
|---|---|---|
| Input System | Browser pointer/touch events | `input` |
| Gesture Interpreter | `input.rawPoints`, layout | `input.lastIntent` |
| Match State Machine | `input`, `ball`, outcome events | `match`, `ui` |
| Ball System | `match`, `input.lastIntent` | `ball` |
| Goalkeeper AI | `match`, `input.lastIntent`, `ball` | `goalie` |
| Collision System | `ball`, `goalie`, layout | outcome event |
| Pressure System | `match` | `match.pressure` |
| Camera System | `match`, `ball`, `goalie` | `camera` |
| FX System | gameplay events, `pressure` | `fx` |
| Audio System | gameplay events, `pressure` | `audio` |
| UI System | `match`, `ui` | display-only view state |

### 35.3 State Mutation Rule

Gameplay systems shall update state only during simulation ticks.

Renderer code shall not mutate gameplay state.

## 36. System Module Contracts

The implementation shall use clear module boundaries. Exact filenames may vary, but the following responsibilities must remain separated.

| Module | Input | Output |
|---|---|---|
| Gesture Interpreter | Raw gesture points, layout bounds | Shot intent |
| Trajectory Generator | Shot intent, ball start, tuning constants | Bezier/spline trajectory |
| Ball Simulation | Trajectory, fixed dt | Ball state |
| Goalkeeper AI | Match state, shot intent, difficulty config | Prediction, reaction, dive state |
| Collision Resolver | Ball state, goalkeeper reach, goal bounds | Shot outcome |
| Pressure Evaluator | Match score, shot index, match point | Pressure value |
| Hero Moment Classifier | Shot intent, outcome, collision distances, pressure | Hero moment type or null |
| Camera Controller | Ball, goalie, pressure, hero moment | Camera state |
| FX Controller | Gameplay events, pressure, hero moment | Trail/particle/screen FX state |
| Audio Controller | Gameplay events, pressure, hero moment | Audio events and ambience intensity |
| UI Presenter | Match state, localization strings | UI display state |

Pure calculation modules should be testable without PixiJS.

## 37. Hero Moment Detection

### 37.1 Purpose

The game shall classify certain shots as hero moments to trigger maximum cinematic emphasis when the moment is exceptional, even if base pressure is lower.

### 37.2 Hero Moment Types

Required MVP hero moment types:

| Type | Trigger |
|---|---|
| `final_decider` | Final shot or match point with score difference <= 1. |
| `near_save_goal` | Ball scores while passing within 5% of goalkeeper reach. |
| `fingertip_save` | Goalkeeper saves when ball is within the outer 15% of reach radius. |
| `extreme_curve_goal` | Absolute curve >= 0.85 and outcome is goal. |
| `post_and_in` | Ball contacts post/crossbar and resolves as goal. |
| `wrong_foot_curve` | Goalkeeper dives correct initial direction but ball curves away and scores. |

### 37.3 Hero Moment Effects

Hero moments may trigger:

- Maximum or near-maximum camera intensity.
- Slow-motion pulse.
- Stronger trail and impact FX.
- Extended result display.
- Stronger audio swell and result burst.

### 37.4 Limits

Hero moment effects shall remain short.

Recommended max result emphasis:

- Normal shot result: 600-1200 ms.
- Hero moment result: 1000-1500 ms.

Hero moments must not change an already-resolved outcome.

## 38. Tuning Constants Registry

### 38.1 Requirement

All gameplay-critical values shall be defined in a centralized tuning configuration.

The implementation must avoid scattering magic numbers across gameplay systems.

### 38.2 Reference Constants

Values in this table are recommended defaults and may be adjusted during balancing.

| Constant | Default | Recommended Range |
|---|---:|---:|
| `minShotZoneRadius` | 44 CSS px | 36-60 |
| `shotZoneViewportWidthRatio` | 0.14 | 0.12-0.16 |
| `maxGesturePoints` | 48 | 32-64 |
| `minGesturePoints` | 3 | 2-5 |
| `minPathDistance` | 28 CSS px | 20-40 |
| `minUpwardDelta` | 10 CSS px | 8-18 |
| `minGestureDurationMs` | 50 | 35-80 |
| `maxGestureDurationMs` | 1200 | 900-1500 |
| `minGestureSampleDistance` | 4 CSS px | 3-8 |
| `gestureSampleIntervalMs` | 16 | 8-24 |
| `forceMin` | 0.55 | 0.40-0.70 |
| `forceMax` | 1.35 | 1.10-1.50 |
| `minInputSpeed` | 0.25 CSS px/ms | 0.18-0.35 |
| `maxInputSpeed` | 1.20 CSS px/ms | 0.90-1.50 |
| `curveReferenceWidth` | 125 CSS px | 110-140 |
| `maxCurvePixels` | 120 CSS px | 80-160 |
| `flightDurationMinMs` | 450 | 350-550 |
| `flightDurationMaxMs` | 850 | 700-1000 |
| `calmReactionMs` | 140-190 | 120-220 |
| `focusedReactionMs` | 105-155 | 90-180 |
| `nervousReactionMs` | 170-240 | 150-280 |
| `aggressiveReactionMs` | 80-130 | 70-160 |
| `desperateReactionMs` | 70-180 | 60-220 |
| `normalResultMs` | 600-1200 | 500-1300 |
| `heroResultMaxMs` | 1500 | 1200-1700 |
| `hitStopMinMs` | 40 | 25-60 |
| `hitStopMaxMs` | 90 | 70-110 |
| `slowMotionMinMs` | 180 | 120-240 |
| `slowMotionMaxMs` | 450 | 350-550 |
| `cameraZoomNormal` | 1.00 | 1.00 |
| `cameraZoomMax` | 1.12 | 1.08-1.15 |
| `maxCatchUpSteps` | 3 | 2-4 |

### 38.3 Configuration Rule

The tuning registry shall be loadable as data.

Changing tuning values should not require rewriting gameplay algorithms.

## 39. Recommended Implementation Order

### 39.1 Milestone 1: Project Foundation

- Set up Vite, TypeScript, and PixiJS.
- Create single canvas and responsive layout.
- Implement boot, ready, aiming, drawing, ball_flight, resolution, reset, and match_end states.
- Render placeholder stadium, ball, goal, and UI.

### 39.2 Milestone 2: Input and Shot Intent

- Implement touch/pointer capture.
- Implement valid shot zone.
- Implement gesture sampling and validation.
- Implement force, target, curve, and quality extraction.
- Render drawing trail.

### 39.3 Milestone 3: Ball Flight

- Generate Bezier/spline trajectory.
- Simulate ball progress with fixed-step timing.
- Add ball scale/depth illusion.
- Detect basic goal and miss without goalkeeper.

### 39.4 Milestone 4: Goalkeeper

- Render placeholder goalkeeper.
- Implement prediction and reaction timing.
- Implement dive states.
- Implement reach and save collision.
- Resolve goal/save/miss consistently.

### 39.5 Milestone 5: Match and Emotion

- Implement five-shot match flow.
- Implement score and restart.
- Implement pressure formula and shot pressure floor.
- Implement goalkeeper mood state machine.
- Add visible mood expression placeholders.

### 39.6 Milestone 6: Cinematic Camera

- Implement fixed-step camera state.
- Add tracking layer.
- Add tension zoom.
- Add impact shake.
- Add slow-motion pulse.
- Add reduced-motion handling.

### 39.7 Milestone 7: FX

- Add ball trail.
- Add input trail polish.
- Add goal/save/miss impact effects.
- Add net pulse.
- Add screen vignette/flash under pressure.
- Add pooling and low-end fallback.

### 39.8 Milestone 8: Audio

- Integrate Howler.js or equivalent.
- Unlock audio after first interaction.
- Add kick, whoosh, goal, save, post, and crowd sounds.
- Add pressure-scaled ambience and tension.

### 39.9 Milestone 9: Mobile Optimization and QA

- Add DPR cap.
- Add safe-area handling.
- Add visibility pause/resume.
- Add resize/orientation handling.
- Verify performance budgets.
- Verify acceptance criteria.

## 40. Implementation Readiness Criteria

Before coding begins, the team should confirm:

- The technology stack in Section 32 is accepted.
- The fixed-step loop in Section 33 is accepted.
- The runtime state tree in Section 35 is accepted.
- The tuning constants in Section 38 are treated as defaults, not final balance.
- The implementation order in Section 39 is the intended delivery sequence.

## 41. Recommended Next Documents

After this SRS is approved, production should create:

- Technical Design Document: class-level design, exact interfaces, file structure, renderer implementation details, and test strategy.
- Gameplay Balancing Document: difficulty curves, goalkeeper tuning, shot assist, and pressure pacing.
- Art Bible: character proportions, color palette, FX style, animation rules.
- QA Test Plan: device matrix, gameplay cases, performance tests, and WebView tests.

## 42. Core Requirement Summary

The game shall be a portrait-first mobile web penalty game built with TypeScript, PixiJS, Vite, custom arcade physics, a fixed-step 60 Hz simulation loop, and a single-canvas layered renderer. The player draws shots, the ball interprets intent into smooth arcade trajectories, the goalkeeper reacts with emotional AI, and the match becomes more cinematic near decisive moments. The game must remain fast, fair, readable, deterministic where gameplay matters, and replayable.
