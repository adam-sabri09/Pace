/**
 * K-Nearest Neighbours technique recommendation.
 *
 * Given a target student's feature vector and a set of labelled training
 * examples (other students whose best technique is known), find the K
 * nearest neighbours and take a weighted majority vote.
 *
 * Distance: Euclidean over the normalised feature vector.
 * Weight: 1 / (distance² + ε) so exact matches dominate.
 */

import type { TechniqueKey } from "@/lib/personalization/types";
import { featureVector, type StudentFeatures, type TrainingExample } from "./features";

const EPSILON = 1e-6;

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export type KnnResult = {
  technique: TechniqueKey;
  /** Weighted vote share 0-1 for the winning technique. */
  confidence: number;
  /** Number of neighbours used. */
  k: number;
};

/**
 * Predict the best technique for a target student via KNN.
 *
 * @param target  - feature vector of the student to predict for
 * @param examples - labelled training data (other students)
 * @param k        - number of neighbours (default: 5)
 * @returns null if examples is empty
 */
export function knnRecommend(
  target: StudentFeatures,
  examples: TrainingExample[],
  k = 5,
): KnnResult | null {
  if (examples.length === 0) return null;

  const targetVec = featureVector(target);
  const actualK = Math.min(k, examples.length);

  // Compute distances and sort.
  const withDist = examples.map((ex) => ({
    technique: ex.technique,
    dist: euclideanDistance(targetVec, featureVector(ex.features)),
  }));
  withDist.sort((a, b) => a.dist - b.dist);

  const neighbours = withDist.slice(0, actualK);

  // Weighted vote.
  const votes: Partial<Record<TechniqueKey, number>> = {};
  let totalWeight = 0;
  for (const n of neighbours) {
    const w = 1 / (n.dist * n.dist + EPSILON);
    votes[n.technique] = (votes[n.technique] ?? 0) + w;
    totalWeight += w;
  }

  // Find winner.
  let winner: TechniqueKey = "active_recall";
  let maxVotes = -1;
  for (const [technique, weight] of Object.entries(votes) as [TechniqueKey, number][]) {
    if (weight > maxVotes) {
      maxVotes = weight;
      winner = technique;
    }
  }

  return {
    technique: winner,
    confidence: totalWeight > 0 ? maxVotes / totalWeight : 0,
    k: actualK,
  };
}
