/**
 * Maps scoring confidence to the presentation shown in /today.
 *
 * High   → personalized recommendation, no qualifier.
 * Medium → recommendation shown, brief note to review preferences if wrong.
 * Low    → softer framing, clear invite to complete personalization.
 *
 * Pure function — no I/O, no side effects, fully testable.
 */

export interface RecommendationPresentation {
  eyebrow: string;   // small label above the card
  note: string | null; // secondary text below the rationale, null if none
}

export function getRecommendationPresentation(
  confidenceLevel: "high" | "medium" | "low",
): RecommendationPresentation {
  switch (confidenceLevel) {
    case "high":
      return {
        eyebrow: "Today's focus",
        note: null,
      };
    case "medium":
      return {
        eyebrow: "Today's suggestion",
        note: "Update your study style preferences in Settings if this doesn't feel like the right fit.",
      };
    case "low":
      return {
        eyebrow: "A starting point",
        note: "Pace doesn't know your study style well yet — the more you answer, the sharper this gets. Update your study style in Settings.",
      };
  }
}
