import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// router.refresh() must be called after a successful save so the client-side
// Router Cache for /today is flushed (see the production bug report).
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
  usePathname: () => "/subjects",
}));

vi.mock("@/server/actions/subject-intelligence", () => ({
  updateSubjectIntelligenceAction: vi.fn(),
}));

import { SubjectIntelligenceForm } from "@/app/(app)/subjects/subject-intelligence-form";
import { updateSubjectIntelligenceAction } from "@/server/actions/subject-intelligence";

const mockUpdate = vi.mocked(updateSubjectIntelligenceAction);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubjectIntelligenceForm — router.refresh regression", () => {
  it("calls router.refresh() after a successful save", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    render(
      <SubjectIntelligenceForm
        subjectId="subject-123"
        initialDifficulty="hard"
        initialConfidencePct={20}
      />,
    );

    // Change difficulty to make the form dirty
    await userEvent.click(screen.getByRole("button", { name: /^easy$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does NOT call router.refresh() when save fails", async () => {
    mockUpdate.mockResolvedValue({ ok: false, error: "Could not update subject. Try again." });
    render(
      <SubjectIntelligenceForm
        subjectId="subject-456"
        initialDifficulty="medium"
        initialConfidencePct={50}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^hard$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not update/i);
  });

  it("passes the updated difficulty to the action", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    render(
      <SubjectIntelligenceForm
        subjectId="subject-789"
        initialDifficulty="easy"
        initialConfidencePct={90}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^hard$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith("subject-789", "hard", 90);
  });

  it("passes the updated confidence to the action", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    render(
      <SubjectIntelligenceForm
        subjectId="subject-abc"
        initialDifficulty="medium"
        initialConfidencePct={null}
      />,
    );

    // The slider activates when the user interacts with it, setting a value.
    const slider = screen.getByRole("slider");
    // Simulate moving the slider to 30 (makes the form dirty: null → 30)
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "30" } });
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith("subject-abc", "medium", 30);
  });
});
