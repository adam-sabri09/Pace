import { describe, it, expect } from "vitest";
import { fitLinearRegression, predict } from "@/lib/ml/linear-regression";

describe("fitLinearRegression", () => {
  it("returns null for fewer than 2 points", () => {
    expect(fitLinearRegression([[0.5]], [50])).toBeNull();
    expect(fitLinearRegression([], [])).toBeNull();
  });

  it("fits a perfect line y = 100x", () => {
    const X = [[0], [0.5], [1]];
    const y = [0, 50, 100];
    const model = fitLinearRegression(X, y);
    expect(model).not.toBeNull();
    expect(model!.rSquared).toBeCloseTo(1, 3);
    expect(model!.coefficients[0]).toBeCloseTo(100, 1);
    expect(model!.intercept).toBeCloseTo(0, 1);
  });

  it("fits a constant (zero slope)", () => {
    const X = [[0], [0.5], [1]];
    const y = [60, 60, 60];
    const model = fitLinearRegression(X, y);
    expect(model).not.toBeNull();
    // rSquared is 0 because variance is 0
    expect(model!.rSquared).toBeCloseTo(0, 3);
  });

  it("handles noisy data and still returns a model", () => {
    const X = [[0.2], [0.4], [0.6], [0.8], [1.0]];
    const y = [25, 40, 55, 70, 85];
    const model = fitLinearRegression(X, y);
    expect(model).not.toBeNull();
    expect(model!.rSquared).toBeGreaterThan(0.95);
    expect(model!.n).toBe(5);
  });

  it("handles multiple features", () => {
    // y = 2*x1 + 3*x2 + 10
    const X = [
      [1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 2],
    ];
    const y = [12, 13, 15, 14, 16, 18];
    const model = fitLinearRegression(X, y);
    expect(model).not.toBeNull();
    expect(model!.rSquared).toBeGreaterThan(0.95);
  });
});

describe("predict", () => {
  it("predicts correctly from a fitted model", () => {
    const X = [[0], [1]];
    const y = [0, 100];
    const model = fitLinearRegression(X, y)!;
    expect(predict(model, [0.5])).toBeCloseTo(50, 1);
  });

  it("clamps prediction to [0, 100] by default", () => {
    const X = [[0], [1]];
    const y = [0, 100];
    const model = fitLinearRegression(X, y)!;
    expect(predict(model, [2])).toBe(100);
    expect(predict(model, [-1])).toBe(0);
  });

  it("respects custom clamp bounds", () => {
    const X = [[0], [1]];
    const y = [0, 100];
    const model = fitLinearRegression(X, y)!;
    expect(predict(model, [0.5], [20, 80])).toBeCloseTo(50, 1);
    expect(predict(model, [2], [0, 80])).toBe(80);
  });
});
