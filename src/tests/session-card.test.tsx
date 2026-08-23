import { describe, expect, it, vi } from "vitest";

/**
 * The card imports the server actions module. In the jsdom test env we
 * intercept it — client-side we care about which handler is wired to
 * which button, not the network call itself.
 */
const markDone = vi.fn();
const markMissed = vi.fn();
vi.mock("@/server/actions/sessions", () => ({
  markDoneAction: (id: string) => markDone(id),
  markMissedAction: (id: string) => markMissed(id),
}));

import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach } from "vitest";
import { SessionCard, type SessionCardProps } from "@/components/session-card";

afterEach(cleanup);

const base: SessionCardProps = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  status: "scheduled",
  subjectName: "Biology",
  topicName: "Cellular respiration",
  timeRange: "16:00 – 16:45",
  durationMinutes: 45,
  instruction: "Review chapter 4",
};

describe("SessionCard", () => {
  it("renders subject, topic, time range, and instruction on scheduled", () => {
    render(<SessionCard {...base} />);
    expect(screen.getByText("Biology")).toBeInTheDocument();
    expect(screen.getByText("Cellular respiration")).toBeInTheDocument();
    expect(screen.getByText(/16:00 – 16:45/)).toBeInTheDocument();
    expect(screen.getByText("Review chapter 4")).toBeInTheDocument();
    expect(screen.getByText(/Upcoming/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Complete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Missed/i })).toBeInTheDocument();
  });

  it("hides Complete and Missed on a completed session", () => {
    render(<SessionCard {...base} status="completed" />);
    expect(screen.queryByRole("button", { name: /Complete/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Missed/i })).toBeNull();
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
  });

  it("hides Complete and Missed on a missed session", () => {
    render(<SessionCard {...base} status="missed" />);
    expect(screen.queryByRole("button", { name: /Complete/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Missed/i })).toBeNull();
    expect(screen.getByText(/^Missed$/i)).toBeInTheDocument();
  });

  it("calls markDoneAction when Complete is clicked", async () => {
    markDone.mockClear();
    markMissed.mockClear();
    render(<SessionCard {...base} />);
    await userEvent.click(screen.getByRole("button", { name: /Complete/i }));
    expect(markDone).toHaveBeenCalledWith(base.id);
    expect(markMissed).not.toHaveBeenCalled();
  });

  it("calls markMissedAction when Missed is clicked", async () => {
    markDone.mockClear();
    markMissed.mockClear();
    render(<SessionCard {...base} />);
    await userEvent.click(screen.getByRole("button", { name: /Missed/i }));
    expect(markMissed).toHaveBeenCalledWith(base.id);
    expect(markDone).not.toHaveBeenCalled();
  });

  it("marks the card with the current status via data-status", () => {
    render(<SessionCard {...base} status="completed" />);
    const card = screen.getByTestId("session-card");
    expect(card.getAttribute("data-status")).toBe("completed");
  });
});
