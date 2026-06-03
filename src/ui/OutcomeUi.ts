import type { Rect } from "../core/types";

export type UiOutcome = "goal" | "save" | "miss" | "none";
export type MissReason = "outside_frame" | "post_hit";

export interface UiContext {
  readonly playerScore: number;
  readonly goalkeeperScore: number;
  readonly shotNumber: number;
  readonly maxShots: number;
  readonly outcome: UiOutcome;
  readonly missReason?: MissReason;
  readonly firstValidGestureSeen: boolean;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly ballStartZone: Rect;
  readonly goalCorners: readonly Rect[];
  readonly goalkeeperBody: Rect;
  readonly gesturePath: Rect;
}

export interface OutcomeUi {
  readonly scoreText: string;
  readonly shotText: string;
  readonly resultText: string;
  readonly restartAction: "restart";
  readonly firstUseHint: string | null;
  readonly clarityCues: readonly string[];
  readonly outcomeVisibleAfterMs: number;
  readonly safeLayout: boolean;
  readonly panels: readonly Rect[];
}

export function getOutcomeUi(context: UiContext): OutcomeUi {
  const panels = getPanels(context.viewportWidth, context.viewportHeight);
  return {
    scoreText: `Player ${context.playerScore} - Keeper ${context.goalkeeperScore}`,
    shotText: `Shot ${context.shotNumber}/${context.maxShots}`,
    resultText: getResultText(context),
    restartAction: "restart",
    firstUseHint: context.firstValidGestureSeen ? null : "Draw your shot",
    clarityCues: getClarityCues(context),
    outcomeVisibleAfterMs: context.outcome === "none" ? 0 : 420,
    safeLayout: panels.every((panel) => !getProtectedRects(context).some((rect) => overlaps(panel, rect))),
    panels
  };
}

function getPanels(viewportWidth: number, viewportHeight: number): readonly Rect[] {
  const margin = 12;
  return [
    { left: margin, top: 70, right: Math.min(viewportWidth - margin, 132), bottom: 110 },
    { left: Math.max(margin, viewportWidth - 132), top: 70, right: viewportWidth - margin, bottom: 110 },
    {
      left: margin,
      top: Math.max(122, viewportHeight - 90),
      right: Math.min(viewportWidth - margin, 132),
      bottom: Math.max(164, viewportHeight - 48)
    }
  ];
}

function getResultText(context: UiContext): string {
  if (context.outcome === "goal") {
    return "GOAL";
  }
  if (context.outcome === "save") {
    return "SAVE";
  }
  if (context.outcome === "miss") {
    return context.missReason === "post_hit" ? "POST HIT" : "MISS";
  }
  return "";
}

function getClarityCues(context: UiContext): readonly string[] {
  if (context.outcome === "goal") {
    return ["ball_crossed_goal", "net_feedback", "positive_score_update"];
  }
  if (context.outcome === "save") {
    return ["keeper_contact", "ball_deflection", "save_feedback"];
  }
  if (context.outcome === "miss") {
    return [
      context.missReason === "post_hit" ? "post_hit" : "outside_frame",
      "miss_feedback_distinct_from_save"
    ];
  }
  return [];
}

function getProtectedRects(context: UiContext): readonly Rect[] {
  return [
    context.ballStartZone,
    context.goalkeeperBody,
    context.gesturePath,
    ...context.goalCorners
  ];
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
