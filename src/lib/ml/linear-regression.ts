/**
 * Simple univariate Ordinary Least Squares (OLS) linear regression.
 *
 * Used to estimate a student's confidence level from their session
 * completion rate:
 *
 *   confidence_pct ≈ β₀ + β₁ × completion_rate
 *
 * With only two parameters this is numerically stable and interpretable.
 * We expose the multivariate form for future extension (multiple features).
 */

export type RegressionModel = {
  /** Intercept β₀ */
  intercept: number;
  /** Coefficients β₁, β₂, … one per feature */
  coefficients: number[];
  /** R² goodness-of-fit (0-1). 0 if variance is zero. */
  rSquared: number;
  /** Number of training points. */
  n: number;
};

/**
 * Fit an OLS linear regression model.
 *
 * @param X  - n×p matrix of features (each row is one observation)
 * @param y  - n-vector of target values
 * @returns fitted model, or null if n < 2 or all y are identical
 */
export function fitLinearRegression(
  X: number[][],
  y: number[],
): RegressionModel | null {
  const n = X.length;
  if (n < 2 || y.length !== n) return null;

  const p = X[0].length;

  // Augment X with a constant column of 1s for the intercept.
  const Xa = X.map((row) => [1, ...row]);

  // Normal equations: β = (XᵀX)⁻¹ Xᵀy
  // For p+1 ≤ 3 columns we use Gaussian elimination (small matrices only).
  const cols = p + 1;

  // Build XᵀX (cols × cols) and Xᵀy (cols × 1).
  const XtX: number[][] = Array.from({ length: cols }, () =>
    Array(cols).fill(0),
  );
  const Xty: number[] = Array(cols).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < cols; j++) {
      Xty[j] += (Xa[i][j] ?? 0) * y[i];
      for (let k = 0; k < cols; k++) {
        XtX[j][k] += (Xa[i][j] ?? 0) * (Xa[i][k] ?? 0);
      }
    }
  }

  // Gaussian elimination with partial pivoting on [XtX | Xty].
  const aug = XtX.map((row, i) => [...row, Xty[i]]);

  for (let col = 0; col < cols; col++) {
    // Find pivot.
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < cols; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // singular — can't solve

    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    for (let k = col; k <= cols; k++) aug[col][k] /= pivot;
    for (let row = 0; row < cols; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let k = col; k <= cols; k++) aug[row][k] -= factor * aug[col][k];
    }
  }

  const beta = aug.map((row) => row[cols]);
  const intercept = beta[0];
  const coefficients = beta.slice(1);

  // Compute R².
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yHat = beta[0] + coefficients.reduce((s, c, j) => s + c * (X[i][j] ?? 0), 0);
    ssTot += (y[i] - yMean) ** 2;
    ssRes += (y[i] - yHat) ** 2;
  }
  const rSquared = ssTot < 1e-12 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { intercept, coefficients, rSquared, n };
}

/**
 * Predict from a fitted model.
 *
 * @param model - fitted model
 * @param x     - feature vector (same length as model.coefficients)
 * @param clamp - [min, max] to clamp prediction (default [0, 100])
 */
export function predict(
  model: RegressionModel,
  x: number[],
  clamp: [number, number] = [0, 100],
): number {
  const raw =
    model.intercept +
    model.coefficients.reduce((s, c, i) => s + c * (x[i] ?? 0), 0);
  return Math.max(clamp[0], Math.min(clamp[1], raw));
}
