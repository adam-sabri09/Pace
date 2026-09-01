"use server";

import "server-only";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import { createClient } from "@/lib/supabase/server";
import { type CoachContext, buildSystemPrompt } from "@/lib/coach/prompt";

const MODEL_ID = "gemini-3.6-flash";

async function buildCoachContext(userId: string): Promise<CoachContext> {
  const supabase = await createClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [profileRes, subjectsRes, sessionsRes, tasksRes, courseworkRes, practiceRes, masteryRes] =
    await Promise.all([
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
      supabase
        .from("coursework_items")
        .select("title, subject_name, extracted")
        .eq("user_id", userId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("practice_sessions")
        .select("questions_answered, correct_count")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("completed_at", sevenDaysAgo),
      supabase
        .from("topic_mastery")
        .select("mastery_pct, topic_id, topic:topics(name)")
        .eq("user_id", userId)
        .lt("mastery_pct", 50)
        .order("mastery_pct", { ascending: true })
        .limit(5),
    ]);

  const sessions = sessionsRes.data ?? [];
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const completionRate =
    sessions.length > 0 ? completedCount / sessions.length : null;

  // Practice stats for last 7 days
  const practiceSessions = practiceRes.data ?? [];
  let avgAccuracy: number | null = null;
  if (practiceSessions.length > 0) {
    const totalQ = practiceSessions.reduce((sum, s) => sum + ((s.questions_answered as number) ?? 0), 0);
    const totalC = practiceSessions.reduce((sum, s) => sum + ((s.correct_count as number) ?? 0), 0);
    avgAccuracy = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : null;
  }

  const weakTopics = (masteryRes.data ?? []).map((m) => {
    const topicRow = (m.topic as unknown) as { name: string } | null;
    return {
      name: topicRow?.name ?? "Unknown topic",
      mastery: m.mastery_pct as number,
    };
  });

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
    topTechnique: null,
    upcomingTasks: (tasksRes.data ?? []).map((t) => ({
      title: (t.title as string | null) ?? "",
      taskType: t.task_type as string,
      dueDate: t.due_date as string | null,
    })).filter((t) => t.title),
    recentCoursework: (courseworkRes.data ?? []).map((c) => ({
      title: c.title as string,
      subjectName: c.subject_name as string | null,
      topicCount: ((c.extracted as { topics?: unknown[] } | null)?.topics?.length ?? 0),
    })),
    recentPractice:
      practiceSessions.length > 0
        ? { sessionsLast7Days: practiceSessions.length, avgAccuracy }
        : null,
    weakTopics,
  };
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
