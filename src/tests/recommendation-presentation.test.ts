import { describe, it, expect } from 'vitest';
import { getRecommendationPresentation } from '@/lib/personalization/recommendation-presentation';

describe('getRecommendationPresentation', () => {
  it('high confidence: eyebrow is "Today\'s focus" with no note', () => {
    const result = getRecommendationPresentation('high');
    expect(result.eyebrow).toBe("Today's focus");
    expect(result.note).toBeNull();
  });

  it('medium confidence: eyebrow is "Today\'s suggestion" with a note', () => {
    const result = getRecommendationPresentation('medium');
    expect(result.eyebrow).toBe("Today's suggestion");
    expect(result.note).not.toBeNull();
    expect(typeof result.note).toBe('string');
  });

  it('medium note mentions preferences', () => {
    const result = getRecommendationPresentation('medium');
    expect(result.note).toContain('preferences');
  });

  it('low confidence: eyebrow is "A starting point" with a note', () => {
    const result = getRecommendationPresentation('low');
    expect(result.eyebrow).toBe("A starting point");
    expect(result.note).not.toBeNull();
  });

  it('low note mentions study style', () => {
    const result = getRecommendationPresentation('low');
    expect(result.note).toContain('study style');
  });

  it('high confidence never returns a note', () => {
    const { note } = getRecommendationPresentation('high');
    expect(note).toBeNull();
  });

  it('medium and low both return non-null notes', () => {
    expect(getRecommendationPresentation('medium').note).not.toBeNull();
    expect(getRecommendationPresentation('low').note).not.toBeNull();
  });

  it('medium and low notes are different', () => {
    const medium = getRecommendationPresentation('medium').note;
    const low = getRecommendationPresentation('low').note;
    expect(medium).not.toBe(low);
  });

  it('all three levels return an eyebrow string', () => {
    for (const level of ['high', 'medium', 'low'] as const) {
      const { eyebrow } = getRecommendationPresentation(level);
      expect(typeof eyebrow).toBe('string');
      expect(eyebrow.length).toBeGreaterThan(0);
    }
  });
});
