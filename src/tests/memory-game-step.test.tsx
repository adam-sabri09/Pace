import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import {
  MemoryGameStep,
  calculateMemoryScore,
  READ_SECONDS,
  QUESTION_SECONDS,
} from "@/app/onboarding/memory-game-step";

// vi.useFakeTimers() fakes setTimeout too, which breaks userEvent's internal
// async scheduling and causes `await user.click(...)` to hang. Only fake
// setInterval/clearInterval — the component's countdown timers — so userEvent
// still works while we control the countdown.
const FAKE_TIMER_OPTS = {
  toFake: ["setInterval", "clearInterval"] as ("setInterval" | "clearInterval")[],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Score calculation (pure function — no timer or React deps) ────────────────

describe("calculateMemoryScore", () => {
  it("returns 100 for perfect accuracy and very fast responses", () => {
    // 5/5 correct, 3 s avg → accuracy 80 + speed bonus 20 = 100
    expect(calculateMemoryScore(5, 5, 3_000)).toBe(100);
  });

  it("returns 80 for perfect accuracy and slow responses (> 20s)", () => {
    // speed bonus 0 for > 20s
    expect(calculateMemoryScore(5, 5, 25_000)).toBe(80);
  });

  it("returns 0 for zero correct and very slow responses", () => {
    expect(calculateMemoryScore(0, 5, 30_000)).toBe(0);
  });

  it("returns 64 for 4/5 correct and slow responses", () => {
    // 4/5 * 80 = 64, speed bonus 0 for > 20s → 64
    expect(calculateMemoryScore(4, 5, 22_000)).toBe(64);
  });

  it("applies speed bonus linearly between 8s and 20s", () => {
    // 5/5 correct, 14s avg → bonus = 20 * (20000-14000)/12000 = 10
    expect(calculateMemoryScore(5, 5, 14_000)).toBe(90);
  });

  it("caps total at 100", () => {
    expect(calculateMemoryScore(5, 5, 0)).toBeLessThanOrEqual(100);
  });

  it("never returns a negative value", () => {
    expect(calculateMemoryScore(0, 5, 60_000)).toBeGreaterThanOrEqual(0);
  });
});

// ── Reading timer constants are reasonable ────────────────────────────────────

describe("timer constants", () => {
  it("reading timer is between 60 and 300 seconds", () => {
    expect(READ_SECONDS).toBeGreaterThanOrEqual(60);
    expect(READ_SECONDS).toBeLessThanOrEqual(300);
  });

  it("question timer is between 15 and 60 seconds", () => {
    expect(QUESTION_SECONDS).toBeGreaterThanOrEqual(15);
    expect(QUESTION_SECONDS).toBeLessThanOrEqual(60);
  });
});

// ── Component rendering ───────────────────────────────────────────────────────

describe("MemoryGameStep — rendering", () => {
  it("shows the ready state initially", () => {
    render(<MemoryGameStep onScore={vi.fn()} />);
    expect(screen.getByText(/Quick learning check/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Start$/i })).toBeInTheDocument();
  });

  it("shows the passage and reading timer after clicking Start", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));

    // Passage should be visible
    expect(screen.getByText(/Nordvik/i)).toBeInTheDocument();
    // "I'm ready" button is shown
    expect(screen.getByRole("button", { name: /I.m ready/i })).toBeInTheDocument();
    // Reading timer is present (shows 2:00 at start)
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("reading timer counts down after Start", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    expect(screen.getByText("2:00")).toBeInTheDocument();

    // Advance 5 seconds
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByText("1:55")).toBeInTheDocument();
  });

  it("moves to questions when 'I'm ready' is clicked", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    await user.click(screen.getByRole("button", { name: /I.m ready/i }));

    // First question prompt should be visible
    expect(screen.getByText(/Who led the Nordvik expedition/i)).toBeInTheDocument();
    // Per-question timer shows 30s
    expect(screen.getByText("30s")).toBeInTheDocument();
    // Progress indicator shows "1 / 5"
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });

  it("auto-advances to questions when reading timer hits 0", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));

    await act(async () => {
      vi.advanceTimersByTime(READ_SECONDS * 1000 + 200);
    });

    // First question should be showing
    expect(screen.getByText(/Who led the Nordvik expedition/i)).toBeInTheDocument();
  });

  it("question timer counts down per question", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    await user.click(screen.getByRole("button", { name: /I.m ready/i }));

    expect(screen.getByText("30s")).toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByText("20s")).toBeInTheDocument();
  });

  it("auto-marks a question incorrect when question timer expires", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    await user.click(screen.getByRole("button", { name: /I.m ready/i }));

    // Let the question timer expire
    await act(async () => { vi.advanceTimersByTime(QUESTION_SECONDS * 1000 + 200); });

    // "Next →" button should appear (answered state)
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
  });

  it("selecting an answer disables all options", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    await user.click(screen.getByRole("button", { name: /I.m ready/i }));

    // Click any answer
    await user.click(screen.getByRole("button", { name: /Dr. Ingrid Halvorsen/i }));

    // All option buttons should now be disabled
    const optionButtons = screen.getAllByRole("button", { name: /Halvorsen|Van den Berg|Bauer|Kvam/i });
    for (const btn of optionButtons) {
      expect(btn).toBeDisabled();
    }
  });
});

// ── Done phase — no score exposed to student ──────────────────────────────────

describe("MemoryGameStep — done phase", () => {
  // Answer all 5 questions manually (no timer reliance needed for this path)
  const ANSWERS = [1, 2, 1, 2, 2]; // indices of any option (correct or not)

  async function completeAllQuestions(user: ReturnType<typeof userEvent.setup>) {
    const optionLabels = [
      // Q1 options in order
      ["Pieter Van den Berg", "Dr. Ingrid Halvorsen", "Karl Bauer", "Arnstein Kvam"],
      // Q2
      ["The team departed from Arkhangelsk", "The expedition was funded by the Swedish Cartographic Society", "The team reached the peninsula on 14 June", "Base camp was established on the eastern shore"],
      // Q3
      ["−3°C", "−15°C", "−9°C", "−6°C"],
      // Q4
      ["400 metres", "23 metres", "12 metres", "90 metres"],
      // Q5
      ["The article stated the discovery was made on a different day", "The article misidentified the iron crate", "The article attributed the discovery to Bauer", "The article claimed the logbooks belonged to a different trapper"],
    ];

    for (let i = 0; i < 5; i++) {
      const answerText = optionLabels[i][ANSWERS[i]];
      // Find button with matching text (partial match)
      const answerBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.includes(answerText.slice(0, 20)),
      );
      if (answerBtn) await user.click(answerBtn);
      // Click Next or Finish
      const advance = screen.queryByRole("button", { name: /Next|Finish/i });
      if (advance) await user.click(advance);
    }
  }

  it("shows the congratulatory message in the done phase", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onScore = vi.fn();
    render(<MemoryGameStep onScore={onScore} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    await user.click(screen.getByRole("button", { name: /I.m ready/i }));
    await completeAllQuestions(user);

    expect(screen.getByText(/Pace has a better idea/i)).toBeInTheDocument();
  });

  it("calls onScore with a value between 0 and 100", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onScore = vi.fn();
    render(<MemoryGameStep onScore={onScore} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    await user.click(screen.getByRole("button", { name: /I.m ready/i }));
    await completeAllQuestions(user);

    expect(onScore).toHaveBeenCalledOnce();
    const score = onScore.mock.calls[0][0] as number;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("does NOT show a numeric score or percentage in the done phase", async () => {
    vi.useFakeTimers(FAKE_TIMER_OPTS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryGameStep onScore={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    await user.click(screen.getByRole("button", { name: /I.m ready/i }));
    await completeAllQuestions(user);

    // The done section should only show the congratulatory message — no score
    const container = document.querySelector("section");
    const text = container?.textContent ?? "";
    expect(text).not.toMatch(/\bscore[:\s]*\d/i);
    expect(text).not.toMatch(/\d{1,3}\s*%/); // no percentage
    expect(text).not.toMatch(/\byou (got|scored|answered)\b/i);
  });
});
