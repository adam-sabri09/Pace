import { describe, expect, it, vi, afterEach } from "vitest";

// Mock server actions before any import that triggers the module graph.
const markDone = vi.fn();
const markMissed = vi.fn();
vi.mock("@/server/actions/sessions", () => ({
  markDoneAction: (id: string) => markDone(id),
  markMissedAction: (id: string) => markMissed(id),
}));

vi.mock("@/server/actions/events", () => ({
  recordSessionEventAction: vi.fn(),
}));

// Mock next/navigation — StudySession uses useRouter().push.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mock next/link — renders as a plain anchor in jsdom.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StudySession, type StudySessionProps } from "@/app/study/[sessionId]/study-session";

afterEach(() => {
  cleanup();
  pushMock.mockClear();
  markDone.mockClear();
  markMissed.mockClear();
  try { sessionStorage.clear(); } catch { /* ignore */ }
});

const BASE: StudySessionProps = {
  sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  subjectName: "Chemistry",
  topicName: "Atomic structure",
  instruction: "Review chapter 3",
  durationMinutes: 45,
};

describe("StudySession — idle state", () => {
  it("renders subject, topic, instruction, and timer", () => {
    render(<StudySession {...BASE} />);
    expect(screen.getByText("Chemistry")).toBeInTheDocument();
    expect(screen.getByText("Atomic structure")).toBeInTheDocument();
    expect(screen.getByText("Review chapter 3")).toBeInTheDocument();
    expect(screen.getByTestId("timer-display")).toHaveTextContent("45:00");
  });

  it("shows Start session button and Back link in idle state", () => {
    render(<StudySession {...BASE} />);
    expect(
      screen.getByRole("button", { name: /Start session/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to today/i })).toBeInTheDocument();
  });

  it("does not show Pause, Resume, Done, or Missed controls in idle state", () => {
    render(<StudySession {...BASE} />);
    expect(screen.queryByRole("button", { name: /Pause/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Resume/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Done$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Missed$/i })).toBeNull();
  });
});

describe("StudySession — running state", () => {
  it("shows Pause, Done, and Missed after Start", async () => {
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    expect(screen.getByRole("button", { name: /Pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Done$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Missed$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start session/i })).toBeNull();
  });
});

describe("StudySession — paused state", () => {
  it("shows Resume and hides Pause after Pause", async () => {
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /Pause/i }));
    expect(screen.getByRole("button", { name: /Resume/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pause/i })).toBeNull();
  });

  it("returns to running on Resume", async () => {
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /Pause/i }));
    await userEvent.click(screen.getByRole("button", { name: /Resume/i }));
    expect(screen.getByRole("button", { name: /Pause/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resume/i })).toBeNull();
  });
});

describe("StudySession — Done flow", () => {
  it("shows Well done overlay on success", async () => {
    markDone.mockResolvedValue({ ok: true });
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Done$/i }));
    expect(await screen.findByText(/Well done/i)).toBeInTheDocument();
    expect(screen.getByText(/Session marked complete/i)).toBeInTheDocument();
    expect(markDone).toHaveBeenCalledWith(BASE.sessionId);
  });

  it("shows error overlay when Done action fails", async () => {
    markDone.mockResolvedValue({ ok: false, error: "Database error" });
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Done$/i }));
    expect(await screen.findByText("Database error")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });
});

describe("StudySession — Missed flow", () => {
  it("shows Plan updated overlay with changes on success", async () => {
    markMissed.mockResolvedValue({
      ok: true,
      changes: [
        {
          kind: "moved",
          label: "Chemistry · Atomic structure",
          detail: "Mon 16:00 → Tue 16:00",
        },
      ],
      warnings: [],
    });
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Missed$/i }));
    expect(await screen.findByText(/Plan updated/i)).toBeInTheDocument();
    expect(
      screen.getByText("Chemistry · Atomic structure"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mon 16:00 → Tue 16:00")).toBeInTheDocument();
    expect(markMissed).toHaveBeenCalledWith(BASE.sessionId);
  });

  it("shows 'unchanged' message when there are no changes", async () => {
    markMissed.mockResolvedValue({ ok: true, changes: [], warnings: [] });
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Missed$/i }));
    expect(await screen.findByText(/unchanged/i)).toBeInTheDocument();
  });

  it("shows warnings in Plan updated overlay", async () => {
    markMissed.mockResolvedValue({
      ok: true,
      changes: [],
      warnings: [
        {
          subjectName: "Chemistry",
          topicName: "Atomic structure",
          message: "Not enough time before exam.",
        },
      ],
    });
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Missed$/i }));
    expect(
      await screen.findByText(/Not enough time before exam/i),
    ).toBeInTheDocument();
  });

  it("shows error overlay when Missed action fails", async () => {
    markMissed.mockResolvedValue({ ok: false, error: "Plan error" });
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Missed$/i }));
    expect(await screen.findByText("Plan error")).toBeInTheDocument();
  });

  it("navigates to /today when Got it is clicked", async () => {
    markMissed.mockResolvedValue({ ok: true, changes: [], warnings: [] });
    render(<StudySession {...BASE} />);
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Missed$/i }));
    await screen.findByText(/Plan updated/i);
    await userEvent.click(screen.getByRole("button", { name: /Got it/i }));
    expect(pushMock).toHaveBeenCalledWith("/today");
  });
});

describe("StudySession — data-phase attribute", () => {
  it("reflects the current phase", async () => {
    render(<StudySession {...BASE} />);
    expect(screen.getByTestId("study-session")).toHaveAttribute(
      "data-phase",
      "idle",
    );
    await userEvent.click(screen.getByRole("button", { name: /Start session/i }));
    expect(screen.getByTestId("study-session")).toHaveAttribute(
      "data-phase",
      "running",
    );
  });
});
