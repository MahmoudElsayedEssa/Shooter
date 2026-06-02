# Mobile QA Checklist

> **Version**: Post Phase 4A (Game Feel + Visual Cohesion Repair Sprint)
> **Canvas**: 960×540 landscape (portrait conversion pending separate task)

## Platforms

| Platform | Status | Notes |
|---|---|---|
| Android Chrome | ⬜ Untested | |
| Android WebView | ⬜ Untested | |
| iOS Safari | ⬜ Untested | |
| iOS WebView | ⬜ Untested | |
| Desktop Chrome | ⬜ Untested | |
| Desktop Firefox | ⬜ Untested | |

## Core Gameplay Checks

| # | Check | Pass? |
|---|---|---|
| 1 | Game loads without errors | ⬜ |
| 2 | Ball visible and pulsing in aiming state | ⬜ |
| 3 | Shot zone circle visible around ball | ⬜ |
| 4 | Drawing starts on touch/pointer inside ball zone | ⬜ |
| 5 | Drawing trail follows finger freely (not clamped) | ⬜ |
| 6 | Trail is gold/yellow, visible against background | ⬜ |
| 7 | Release fires ball along Bézier path (not raw gesture) | ⬜ |
| 8 | Ball flight trail appears behind ball (amber, separate from draw trail) | ⬜ |
| 9 | Ball scales down toward goal during flight | ⬜ |
| 10 | Ball rotation proportional to force (fast swipe = more spin) | ⬜ |
| 11 | Invalid gesture returns to aiming with small ball nudge | ⬜ |

## Outcome Readability

| # | Check | Pass? |
|---|---|---|
| 12 | **Goal**: ball sinks into net, net pulse visible | ⬜ |
| 13 | **Save**: keeper overlaps ball at contact point, green marker | ⬜ |
| 14 | **Save**: ball deflects away from keeper after contact | ⬜ |
| 15 | **Save**: keeper scale punch + green tint flash | ⬜ |
| 16 | **Miss**: ball exits screen direction, fades out | ⬜ |
| 17 | **Miss (post-hit)**: orange impact ring on post/crossbar | ⬜ |
| 18 | Result text (GOAL!/SAVED!/MISS) visible within 500ms | ⬜ |
| 19 | Score updates correctly after each outcome | ⬜ |

## Camera & FX

| # | Check | Pass? |
|---|---|---|
| 20 | Camera zooms subtly during ball flight (max 1.08x) | ⬜ |
| 21 | No ball/keeper/goal cropping during zoom | ⬜ |
| 22 | Camera returns to 1.0x before next aiming state | ⬜ |
| 23 | Camera shake on goal (180ms) | ⬜ |
| 24 | Camera shake on save (160ms, slightly sharper) | ⬜ |
| 25 | No shake on normal miss | ⬜ |
| 26 | Match reset fully resets camera zoom and scroll | ⬜ |

## Touch & Performance

| # | Check | Pass? |
|---|---|---|
| 27 | No duplicate touch events (single-finger only) | ⬜ |
| 28 | No touch offset between visual ball and hit zone | ⬜ |
| 29 | Drawing works after camera zoom returns to normal | ⬜ |
| 30 | No visible frame drops during ball flight | ⬜ |
| 31 | No visible frame drops during outcome presentation | ⬜ |
| 32 | 5-shot match completes without drift or desync | ⬜ |
| 33 | Tab switch (visibility_lost) pauses without crash | ⬜ |
| 34 | Return from pause resumes correctly | ⬜ |

## Visual Cohesion

| # | Check | Pass? |
|---|---|---|
| 35 | Keeper grounded (feet touch ground, shadow visible) | ⬜ |
| 36 | Goal interior dark shadow reduces light bleed | ⬜ |
| 37 | Net is subtle (not dominant, not noisy) | ⬜ |
| 38 | UI pills (score, shot count) readable and positioned | ⬜ |
| 39 | Side vignette darkens edges without feeling harsh | ⬜ |
| 40 | Debug overlay works on desktop (D key) | ⬜ |

## Edge Cases

| # | Check | Pass? |
|---|---|---|
| 41 | Ball high-left + keeper right = goal or miss, NOT save | ⬜ |
| 42 | Very fast swipe: ball arrives quickly, outcome clear | ⬜ |
| 43 | Very slow swipe: ball arrives slowly, outcome clear | ⬜ |
| 44 | Curved shot visually curves | ⬜ |
| 45 | Match end shows "Tap to play again" | ⬜ |
| 46 | New match resets score, dots, camera, ball position | ⬜ |

---

## Known Limitations
- Canvas is 960×540 landscape. Real portrait conversion (540×960) deferred to separate Ma'at task.
- No audio yet.
- No settings UI for REDUCED_FX (low-end mode constants exist but no toggle UI).
- No automated mobile testing (manual verification required).
