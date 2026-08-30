import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the server action — must be declared before importing the component.
vi.mock("@/server/actions/subjects", () => ({
  addSubjectAction: vi.fn(),
}));

// Mock next/navigation (used internally by hooks that may be imported).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/subjects",
}));

import { AddSubjectForm } from "@/app/(app)/subjects/add-subject-form";
import { addSubjectAction } from "@/server/actions/subjects";

const mockAddSubject = vi.mocked(addSubjectAction);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Closed state
// ---------------------------------------------------------------------------

describe("AddSubjectForm — closed state", () => {
  it("renders the Add subject button", () => {
    render(<AddSubjectForm />);
    expect(
      screen.getByRole("button", { name: /add subject/i }),
    ).toBeInTheDocument();
  });

  it("does not render the form fields initially", () => {
    render(<AddSubjectForm />);
    expect(screen.queryByLabelText(/subject name/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Opening the form
// ---------------------------------------------------------------------------

describe("AddSubjectForm — opening the form", () => {
  it("shows the form fields after clicking Add subject", async () => {
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    expect(screen.getByLabelText(/subject name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/exam date/i)).toBeInTheDocument();
  });

  it("shows difficulty toggle buttons once the form is open", async () => {
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    expect(screen.getByRole("button", { name: /^easy$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^medium$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^hard$/i })).toBeInTheDocument();
  });

  it("shows a confidence slider once the form is open", async () => {
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Validation — empty name
// ---------------------------------------------------------------------------

describe("AddSubjectForm — validation", () => {
  it("submit button is disabled when name is empty", async () => {
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    const submit = screen.getByRole("button", { name: /add subject/i });
    expect(submit).toBeDisabled();
  });

  it("submit button enables after typing a name", async () => {
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.type(screen.getByLabelText(/subject name/i), "Biology");
    const submit = screen.getByRole("button", { name: /^add subject$/i });
    expect(submit).not.toBeDisabled();
  });

  it("shows a server-returned error message", async () => {
    mockAddSubject.mockResolvedValue({ ok: false, error: "Could not save the subject. Try again." });
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.type(screen.getByLabelText(/subject name/i), "Chemistry");
    await userEvent.click(screen.getByRole("button", { name: /^add subject$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/could not save/i);
  });
});

// ---------------------------------------------------------------------------
// Successful submission
// ---------------------------------------------------------------------------

describe("AddSubjectForm — successful submission", () => {
  it("calls addSubjectAction with the correct payload", async () => {
    mockAddSubject.mockResolvedValue({ ok: true });
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.type(screen.getByLabelText(/subject name/i), "Physics");
    await userEvent.click(screen.getByRole("button", { name: /^add subject$/i }));
    await waitFor(() => {
      expect(mockAddSubject).toHaveBeenCalledTimes(1);
    });
    const call = mockAddSubject.mock.calls[0][0] as Record<string, unknown>;
    expect(call.name).toBe("Physics");
    expect(call.examDate).toBeNull();
    expect(call.topics).toEqual([]);
    expect(call.difficulty).toBeNull();
    expect(call.confidencePct).toBeNull();
  });

  it("passes difficulty when selected", async () => {
    mockAddSubject.mockResolvedValue({ ok: true });
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.type(screen.getByLabelText(/subject name/i), "History");
    await userEvent.click(screen.getByRole("button", { name: /^hard$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^add subject$/i }));
    await waitFor(() => expect(mockAddSubject).toHaveBeenCalledTimes(1));
    const call = mockAddSubject.mock.calls[0][0] as Record<string, unknown>;
    expect(call.difficulty).toBe("hard");
  });

  it("passes confidence when slider is moved", async () => {
    mockAddSubject.mockResolvedValue({ ok: true });
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.type(screen.getByLabelText(/subject name/i), "English");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "75" } });
    await userEvent.click(screen.getByRole("button", { name: /^add subject$/i }));
    await waitFor(() => expect(mockAddSubject).toHaveBeenCalledTimes(1));
    const call = mockAddSubject.mock.calls[0][0] as Record<string, unknown>;
    expect(call.confidencePct).toBe(75);
  });

  it("closes the form after a successful save", async () => {
    mockAddSubject.mockResolvedValue({ ok: true });
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.type(screen.getByLabelText(/subject name/i), "Art");
    await userEvent.click(screen.getByRole("button", { name: /^add subject$/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/subject name/i)).not.toBeInTheDocument();
    });
  });

  it("does not pass existing subjects to the action (it only adds, not replaces)", async () => {
    mockAddSubject.mockResolvedValue({ ok: true });
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.type(screen.getByLabelText(/subject name/i), "Music");
    await userEvent.click(screen.getByRole("button", { name: /^add subject$/i }));
    await waitFor(() => expect(mockAddSubject).toHaveBeenCalledTimes(1));
    // The action is called exactly once with just the new subject — no bulk delete payload.
    const call = mockAddSubject.mock.calls[0][0] as Record<string, unknown>;
    expect(Array.isArray(call)).toBe(false);
    expect(Object.keys(call)).not.toContain("deleteAll");
    expect(Object.keys(call)).not.toContain("replaceAll");
  });
});

// ---------------------------------------------------------------------------
// Cancelling
// ---------------------------------------------------------------------------

describe("AddSubjectForm — cancelling", () => {
  it("closes and returns to the button after clicking Cancel", async () => {
    render(<AddSubjectForm />);
    await userEvent.click(screen.getByRole("button", { name: /add subject/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("button", { name: /add subject/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/subject name/i)).not.toBeInTheDocument();
  });
});
