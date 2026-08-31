"use server";

import "server-only";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import { createClient } from "@/lib/supabase/server";

const MODEL_ID = "gemini-3.6-flash";

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

type CoachContext = {
  firstName: string;
  ageBand: string | null;
  subjects: Array<{ name: string; examDate: string | null; confidence: number | null; difficulty: string | null }>;
  sessionLength: number;
  completionRate: number | null;
  topTechnique: string | null;
  upcomingTasks: Array<{ title: string; taskType: string; dueDate: string | null }>;
};

async function buildCoachContext(userId: string): Promise<CoachContext> {
  const supabase = await createClient();

  const [profileRes, subjectsRes, sessionsRes, tasksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, age_band, session_length_minutes")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("subjects")
      .select("name, exam_date, confidence_pct, difficulty")
      .eq("user_id", userId),
    supabase
      .from("sessions")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["completed", "missed"]),
    supabase
      .from("subject_tasks")
      .select("title, task_type, due_date")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const sessions = sessionsRes.data ?? [];
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const completionRate =
    sessions.length > 0 ? completedCount / sessions.length : null;

  return {
    firstName: (profileRes.data?.first_name as string | null) ?? "there",
    ageBand: profileRes.data?.age_band as string | null,
    subjects: (subjectsRes.data ?? []).map((s) => ({
      name: s.name as string,
      examDate: s.exam_date as string | null,
      confidence: s.confidence_pct as number | null,
      difficulty: s.difficulty as string | null,
    })),
    sessionLength: (profileRes.data?.session_length_minutes as number | null) ?? 45,
    completionRate,
    topTechnique: null, // populated if personalization complete
    upcomingTasks: (tasksRes.data ?? []).map((t) => ({
      title: (t.title as string | null) ?? "",
      taskType: t.task_type as string,
      dueDate: t.due_date as string | null,
    })).filter((t) => t.title),
  };
}

function buildSystemPrompt(ctx: CoachContext, today: string): string {
  const subjectLines = ctx.subjects
    .map((s) => {
      const parts: string[] = [`• ${s.name}`];
      if (s.examDate) parts.push(`exam ${s.examDate}`);
      if (s.difficulty) parts.push(s.difficulty);
      if (s.confidence != null) parts.push(`${s.confidence}% confidence`);
      return parts.join(" — ");
    })
    .join("\n");

  const taskLines =
    ctx.upcomingTasks.length > 0
      ? ctx.upcomingTasks
          .map((t) => `• ${t.title} [${t.taskType}]${t.dueDate ? ` due ${t.dueDate}` : ""}`)
          .join("\n")
      : "None listed.";

  const completionText =
    ctx.completionRate != null
      ? `${Math.round(ctx.completionRate * 100)}% of scheduled sessions completed`
      : "No session history yet";

  return `You are Pace Coach, a friendly and encouraging AI study coach for high-school students.
You help students study smarter, stay motivated, and manage their workload.

Today's date: ${today}
Student name: ${ctx.firstName}
Age band: ${ctx.ageBand ?? "not set"}
Session length: ${ctx.sessionLength} minutes
Session completion rate: ${completionText}

Subjects:
${subjectLines || "No subjects set yet."}

Upcoming tasks/deadlines:
${taskLines}

Guidelines:
1. Be warm, encouraging, and concise — this is a teenager. No walls of text.
2. Give specific, actionable study advice tied to the student's actual subjects.
3. When asked about a subject, reference their confidence/difficulty if available.
4. Suggest concrete study techniques (active recall, spaced repetition, practice tests, Feynman, interleaving).
5. Never be dismissive. If they're struggling, normalise it and offer a small next step.
6. Keep each response under 150 words unless a longer answer is truly needed.
7. You cannot see their plan or schedule directly — if asked, tell them to check the Plan tab.
8. You are not a therapist. If they mention serious distress, kindly suggest they talk to a trusted adult.`;
}

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type SendCoachMessageResult =
  | { ok: true; reply: string; messageId: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function sendCoachMessageAction(
  userMessage: string,
  history: CoachMessage[],
): Promise<SendCoachMessageResult> {
  if (!userMessage.trim()) return { ok: false, error: "Message is empty." };
  if (userMessage.length > 2000) return { ok: false, error: "Message too long." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const today = new Date().toISOString().slice(0, 10);
  const ctx = await buildCoachContext(user.id);
  const systemPrompt = buildSystemPrompt(ctx, today);

  // Build conversation history for the LLM (last 10 messages to stay within context).
  const recent = history.slice(-10);
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...recent.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  let reply: string;
  try {
    const result = await generateText({
      model: google(MODEL_ID),
      system: systemPrompt,
      messages,
      // Do not retry: quota and auth errors are definitive.
      // Retrying burns quota tokens and adds delay for no benefit.
      maxRetries: 0,
    });
    reply = result.text.trim();
    if (!reply) reply = "I'm not sure how to answer that — could you rephrase?";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    console.error("[coach] generateText failed:", msg);

    const isQuota =
      lower.includes("quota") ||
      lower.includes("429") ||
      lower.includes("rate limit") ||
      lower.includes("resource_exhausted");
    const isAuth =
      lower.includes("api key") ||
      lower.includes("authentication") ||
      lower.includes("unauthorized");

    if (isQuota) {
      return {
        ok: false,
        error:
          "The AI service has reached its usage limit. Please try again in a few minutes, or contact support if this keeps happening.",
      };
    }
    if (isAuth) {
      return { ok: false, error: "AI service is not configured. Contact support." };
    }
    return { ok: false, error: "Coach is temporarily unavailable. Please try again." };
  }

  // Persist both messages to coach_messages (fire-and-forget; non-fatal).
  const now = new Date().toISOString();
  void supabase.from("coach_messages").insert([
    { user_id: user.id, role: "user", content: userMessage, metadata: { created_at: now } },
    { user_id: user.id, role: "assistant", content: reply, metadata: { created_at: now } },
  ]);

  return { ok: true, reply, messageId: crypto.randomUUID() };
}

// ---------------------------------------------------------------------------
// Load recent history (last 20 messages)
// ---------------------------------------------------------------------------

export async function loadCoachHistoryAction(): Promise<CoachMessage[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("coach_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return ((data ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>)
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.created_at,
    }));
}
