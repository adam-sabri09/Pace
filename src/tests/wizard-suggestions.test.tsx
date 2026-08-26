import { describe, it, expect, vi, afterEach } from "vitest";

const mockSuggestTopics = vi.fn();
vi.mock("@/server/actions/suggestions", () => ({
  suggestTopicsAction: (...args: unknown[]) => mockSuggestTopics(...args),
}));

vi.mock("@/server/actions/onboarding", () => ({
  commitOnboardingAction: vi.fn().mockResolvedValue({ ok: true }),
}));

import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Wizard } from "@/app/onboarding/wizard";

afterEach(() => {
  cleanup();
  mockSuggestTopics.mockReset();
});

async function navigateToTopicsStep(
  subjectName = "Biology",
  suggestions: string[] = ["Cell division", "Photosynthesis", "DNA replication"],
) {
  mockSuggestTopics.mockResolvedValue({ [subjectName]: suggestions });
  render(<Wizard />);
  await userEvent.type(
    screen.getByPlaceholderText(/e\.g\. Biology/i),
    subjectName,
  );
  await userEvent.keyboard("{Enter}");
  await userEvent.click(screen.getByRole("button", { name: /Continue/i }));
}

describe("TopicsStep — AI suggestions", () => {
  it("calls suggestTopicsAction with the subject names on step 2 entry", async () => {
    await navigateToTopicsStep("Biology");
    await waitFor(() =>
      expect(mockSuggestTopics).toHaveBeenCalledWith(["Biology"]),
    );
  });

  it("shows suggestion chips after suggestions load", async () => {
    await navigateToTopicsStep("Biology");
    expect(
      await screen.findByRole("button", { name: /Add suggestion Cell division/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add suggestion Photosynthesis/i }),
    ).toBeInTheDocument();
  });

  it("adds a topic when a suggestion chip is clicked", async () => {
    await navigateToTopicsStep("Biology");
    const chip = await screen.findByRole("button", {
      name: /Add suggestion Cell division/i,
    });
    await userEvent.click(chip);
    // Topic now appears in the list
    expect(
      screen.getByRole("button", { name: /Remove topic Cell division/i }),
    ).toBeInTheDocument();
    // Chip switches to "remove" state
    expect(
      screen.getByRole("button", { name: /Remove suggestion Cell division/i }),
    ).toBeInTheDocument();
  });

  it("removes a topic when clicking the chip for an already-added topic", async () => {
    await navigateToTopicsStep("Biology");
    // Add via chip
    const addChip = await screen.findByRole("button", {
      name: /Add suggestion Cell division/i,
    });
    await userEvent.click(addChip);
    expect(
      screen.getByRole("button", { name: /Remove topic Cell division/i }),
    ).toBeInTheDocument();
    // Remove via chip
    await userEvent.click(
      screen.getByRole("button", { name: /Remove suggestion Cell division/i }),
    );
    expect(
      screen.queryByRole("button", { name: /Remove topic Cell division/i }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Add suggestion Cell division/i }),
    ).toBeInTheDocument();
  });

  it("does not show suggestion chips when the action returns empty", async () => {
    mockSuggestTopics.mockResolvedValue({});
    render(<Wizard />);
    await userEvent.type(
      screen.getByPlaceholderText(/e\.g\. Biology/i),
      "Biology",
    );
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(mockSuggestTopics).toHaveBeenCalled());
    // Wait for loading skeleton to disappear
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Loading suggestions"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /Add suggestion/i }),
    ).toBeNull();
  });

  it("still renders the topics step when suggestTopicsAction rejects", async () => {
    mockSuggestTopics.mockRejectedValue(new Error("AI failure"));
    render(<Wizard />);
    await userEvent.type(
      screen.getByPlaceholderText(/e\.g\. Biology/i),
      "Biology",
    );
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(mockSuggestTopics).toHaveBeenCalled());
    expect(screen.getByText("What are we tackling?")).toBeInTheDocument();
  });

  it("added chips are marked as pressed", async () => {
    await navigateToTopicsStep("Biology");
    const chip = await screen.findByRole("button", {
      name: /Add suggestion Cell division/i,
    });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    expect(
      screen.getByRole("button", { name: /Remove suggestion Cell division/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
