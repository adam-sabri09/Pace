/**
 * Topic mastery update logic.
 *
 * After a session completes or is marked missed, we update topic_mastery
 * using exponential smoothing:
 *
 *   new_mastery = alpha * outcome + (1 - alpha) * old_mastery
 *
 * where outcome = 100 (completed) or 0 (missed/abandoned), alpha = 0.3.
 *
 * This keeps the mastery score stable over time while still reacting to
 * recent performance. The score then feeds back into the recommender to
 * prioritise low-mastery topics.
 */

export const MASTERY_ALPHA = 0.3;

export function computeNewMastery(
  oldMastery: number,
  completed: boolean,
): number {
  const outcome = completed ? 100 : 0;
  const raw = MASTERY_ALPHA * outcome + (1 - MASTERY_ALPHA) * oldMastery;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Apply spaced-repetition decay: mastery drops over time if not reinforced.
 * Decay is 1% per day after 7 days, capped at 50% total decay.
 */
export function applyDecay(mastery: number, lastSessionAt: Date | null): number {
  if (!lastSessionAt) return mastery;
  const daysSince = (Date.now() - lastSessionAt.getTime()) / 86_400_000;
  if (daysSince <= 7) return mastery;
  const decayPct = Math.min(50, Math.floor(daysSince - 7) * 1);
  return Math.max(0, Math.round(mastery * (1 - decayPct / 100)));
}
