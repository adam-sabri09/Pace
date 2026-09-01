"use server";

import "server-only";

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { logAppError } from "@/lib/errors/log-error";
import { computeNewMastery } from "@/lib/mastery/update";
import {
  adjustDifficulty,
  pickQuestionType,
  questionTypeInstruction,
  type Difficulty,
} from "@/lib/practice/difficulty";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PracticeQuestionSchema = z.object({
  questionText: z.string(),
  questionType: z.enum([
    "recall", "understanding", "application",
    "comparison", "problem_solving", "find_mistake", "changed_detail",
  ]),
  conceptTested: z.string(),
  expectedAnswer: z.string(),
});

const AnswerEvaluationSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string().describe("2-3 sentences max. Friendly and specific. If wrong, explain the correct concept."),
});

type StoredQuestion = z.infer<typeof PracticeQuestionSchema>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ClientQuestion = {
  questionText: string;
  questionType: string;
  conceptTested: string;
};

export type PracticeState = {
  sessionId: string;
  subjectName: string;
  topicName: string | null;
  currentDifficulty: Difficulty;
  questionsAnswered: number;
  correctCount: number;
  question: ClientQuestion;
};

export type StartPracticeResult =
  | { ok: true; state: PracticeState }
  | { ok: false; error: string };

export type SubmitAnswerResult =
  | {
      ok: true;
      isCorrect: boolean;
      feedback: string;
      nextQuestion: ClientQuestion | null;
      sessionComplete: boolean;
    }
  | { ok: false; error: string };

export type PracticeSummary = {
  questionsAnswered: number;
  correctCount: number;
  accuracy: number;
  subjectName: string;
  topicName: string | null;
};

export type EndPracticeResult =
  | { ok: true; summary: PracticeSummary }
  | { ok: false; error: string };

const MAX_QUESTIONS = 10;

// ---------------------------------------------------------------------------
// Create practice session + generate first question
// ---------------------------------------------------------------------------

export async function startPracticeAction(
  courseworkItemId: string,
): Promise<StartPracticeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: item } = await supabase
    .from("coursework_items")
    .select("id, title, subject_name, status, extracted")
    .eq("id", courseworkItemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item || item.status !== "ready" || !item.extracted) {
    return { ok: false, error: "This item is not ready for practice." };
  }

  const extracted = item.extracted as CourseworkExtractedData;
  const initialDifficulty: Difficulty = 2;
  const firstQuestion = await generateQuestion(extracted, initialDifficulty, 0);
  if (!firstQuestion) {
    return { ok: false, error: "Could not generate a question. Try again." };
  }

  const { data: session, error: sessErr } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      coursework_item_id: courseworkItemId,
      subject_name: item.subject_name as string | null,
      topic_name: (extracted.topics?.[0]?.name) ?? null,
      status: "active",
      current_difficulty: initialDifficulty,
      current_question: firstQuestion,
    })
    .select("id")
    .single();

  if (sessErr || !session) {
    return { ok: false, error: "Could not start practice session." };
  }

  return {
    ok: true,
    state: {
      sessionId: session.id as string,
      subjectName: (item.subject_name as string | null) ?? "General",
      topicName: (extracted.topics?.[0]?.name) ?? null,
      currentDifficulty: initialDifficulty,
      questionsAnswered: 0,
      correctCount: 0,
      question: toClientQuestion(firstQuestion),
    },
  };
}

// ---------------------------------------------------------------------------
// Submit answer
// ---------------------------------------------------------------------------

export async function submitAnswerAction(
  sessionId: string,
  userAnswer: string,
  responseTimeMs: number,
): Promise<SubmitAnswerResult> {
  if (!userAnswer.trim()) return { ok: false, error: "Please write an answer first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: session } = await supabase
    .from("practice_sessions")
    .select(
      "id, coursework_item_id, current_difficulty, questions_answered, correct_count, topic_id, subject_name, status, current_question",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session || session.status === "completed") {
    return { ok: false, error: "Session not found or already completed." };
  }

  const currentQuestion = session.current_question as StoredQuestion | null;
  if (!currentQuestion) return { ok: false, error: "No current question found." };

  const currentDifficulty = session.current_difficulty as Difficulty;

  // Evaluate answer with Gemini.
  let isCorrect = false;
  let feedback = "Good effort!";

  try {
    const { object } = await generateObject({
      model: google("gemini-3.6-flash"),
      schema: AnswerEvaluationSchema,
      messages: [
        {
          role: "user",
          content: buildEvaluationPrompt(
            currentQuestion.questionText,
            currentQuestion.expectedAnswer,
            userAnswer,
            currentQuestion.conceptTested,
          ),
        },
      ],
      maxRetries: 0,
    });
    isCorrect = object.isCorrect;
    feedback = object.feedback;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logAppError("practice_evaluation", msg, { sessionId }, user.id);
    // Keyword-fallback when AI unavailable.
    const answerLower = userAnswer.toLowerCase();
    const keyWords = currentQuestion.expectedAnswer
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);
    const matches = keyWords.filter((w) => answerLower.includes(w)).length;
    isCorrect = keyWords.length > 0 && matches >= Math.ceil(keyWords.length * 0.6);
    feedback = isCorrect
      ? "Good answer! You covered the key points."
      : `Not quite. The key point: ${currentQuestion.expectedAnswer}`;
  }

  const questionsAnswered = (session.questions_answered as number) + 1;
  const correctCount = (session.correct_count as number) + (isCorrect ? 1 : 0);
  const adjustment = adjustDifficulty(currentDifficulty, isCorrect, responseTimeMs);
  const nextDifficulty = adjustment.next;

  // Persist attempt.
  void supabase.from("practice_attempts").insert({
    practice_session_id: sessionId,
    user_id: user.id,
    question_text: currentQuestion.questionText,
    question_type: currentQuestion.questionType,
    concept_tested: currentQuestion.conceptTested,
    user_answer: userAnswer,
    is_correct: isCorrect,
    response_time_ms: responseTimeMs,
    difficulty: currentDifficulty,
    ai_feedback: feedback,
  });

  // Update topic mastery if there's a linked topic.
  if (session.topic_id) {
    const topicId = session.topic_id as string;
    const { data: existing } = await supabase
      .from("topic_mastery")
      .select("mastery_pct, sessions_completed, sessions_total")
      .eq("user_id", user.id)
      .eq("topic_id", topicId)
      .maybeSingle();

    const oldMastery = (existing?.mastery_pct as number | null) ?? 0;
    const newMastery = computeNewMastery(oldMastery, isCorrect);
    void supabase.from("topic_mastery").upsert(
      {
        user_id: user.id,
        topic_id: topicId,
        mastery_pct: newMastery,
        sessions_completed: ((existing?.sessions_completed as number | null) ?? 0) + (isCorrect ? 1 : 0),
        sessions_total: ((existing?.sessions_total as number | null) ?? 0) + 1,
        last_session_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic_id" },
    );
  }

  // End session if question limit reached.
  if (questionsAnswered >= MAX_QUESTIONS) {
    await supabase
      .from("practice_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        questions_answered: questionsAnswered,
        correct_count: correctCount,
        current_difficulty: nextDifficulty,
        current_question: null,
      })
      .eq("id", sessionId);

    return { ok: true, isCorrect, feedback, nextQuestion: null, sessionComplete: true };
  }

  // Generate next question (avoid repeating same concept).
  let nextStoredQuestion: StoredQuestion | null = null;
  let nextClientQuestion: ClientQuestion | null = null;

  if (session.coursework_item_id) {
    const { data: itemRow } = await supabase
      .from("coursework_items")
      .select("extracted")
      .eq("id", session.coursework_item_id as string)
      .maybeSingle();

    if (itemRow?.extracted) {
      nextStoredQuestion = await generateQuestion(
        itemRow.extracted as CourseworkExtractedData,
        nextDifficulty,
        questionsAnswered,
        currentQuestion.conceptTested,
      );
      if (nextStoredQuestion) nextClientQuestion = toClientQuestion(nextStoredQuestion);
    }
  }

  await supabase
    .from("practice_sessions")
    .update({
      questions_answered: questionsAnswered,
      correct_count: correctCount,
      current_difficulty: nextDifficulty,
      current_question: nextStoredQuestion ?? null,
    })
    .eq("id", sessionId);

  return {
    ok: true,
    isCorrect,
    feedback,
    nextQuestion: nextClientQuestion,
    sessionComplete: false,
  };
}

// ---------------------------------------------------------------------------
// End session manually
// ---------------------------------------------------------------------------

export async function endPracticeAction(sessionId: string): Promise<EndPracticeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      current_question: null,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("questions_answered, correct_count, subject_name, topic_name")
    .single();

  if (error || !session) return { ok: false, error: "Could not end session." };

  const qa = session.questions_answered as number;
  const cc = session.correct_count as number;
  return {
    ok: true,
    summary: {
      questionsAnswered: qa,
      correctCount: cc,
      accuracy: qa > 0 ? Math.round((cc / qa) * 100) : 0,
      subjectName: (session.subject_name as string | null) ?? "General",
      topicName: session.topic_name as string | null,
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch an in-progress session (for page load after redirect)
// ---------------------------------------------------------------------------

export async function getPracticeSessionAction(
  sessionId: string,
): Promise<PracticeState | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("practice_sessions")
    .select(
      "id, subject_name, topic_name, current_difficulty, questions_answered, correct_count, status, current_question",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session || session.status !== "active") return null;

  const stored = session.current_question as StoredQuestion | null;
  if (!stored) return null;

  return {
    sessionId: session.id as string,
    subjectName: (session.subject_name as string | null) ?? "General",
    topicName: session.topic_name as string | null,
    currentDifficulty: session.current_difficulty as Difficulty,
    questionsAnswered: session.questions_answered as number,
    correctCount: session.correct_count as number,
    question: toClientQuestion(stored),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CourseworkExtractedData = {
  topics?: Array<{ name: string; concepts?: string[]; subtopics?: string[] }>;
  definitions?: Array<{ term: string; definition: string }>;
  keyFacts?: string[];
  difficulty?: string;
};

function toClientQuestion(q: StoredQuestion): ClientQuestion {
  return {
    questionText: q.questionText,
    questionType: q.questionType,
    conceptTested: q.conceptTested,
  };
}

async function generateQuestion(
  extracted: CourseworkExtractedData,
  difficulty: Difficulty,
  attemptCount: number,
  avoidConcept?: string,
): Promise<StoredQuestion | null> {
  const questionType = pickQuestionType(difficulty, attemptCount);
  const instruction = questionTypeInstruction(questionType, difficulty);
  const context = buildContextSummary(extracted, avoidConcept);

  try {
    const { object } = await generateObject({
      model: google("gemini-3.6-flash"),
      schema: PracticeQuestionSchema,
      messages: [
        {
          role: "user",
          content: `You are generating practice questions for a student studying the following material.

${context}

${instruction}
${avoidConcept ? `\nDo NOT ask about "${avoidConcept}" again — choose a different concept.` : ""}

Generate exactly ONE question. Return the question text, type, concept tested, and a complete model answer.`,
        },
      ],
      maxRetries: 0,
    });
    return object as StoredQuestion;
  } catch {
    return null;
  }
}

function buildContextSummary(extracted: CourseworkExtractedData, avoidConcept?: string): string {
  const parts: string[] = [];

  const topics = extracted.topics ?? [];
  if (topics.length > 0) {
    parts.push("Topics covered:");
    for (const t of topics.slice(0, 5)) {
      parts.push(`• ${t.name}`);
      const concepts = (t.concepts ?? []).filter((c) => c !== avoidConcept);
      if (concepts.length > 0) parts.push(`  Concepts: ${concepts.slice(0, 8).join(", ")}`);
    }
  }

  const defs = extracted.definitions ?? [];
  if (defs.length > 0) {
    parts.push("\nKey definitions:");
    for (const d of defs.slice(0, 8)) {
      parts.push(`• ${d.term}: ${d.definition}`);
    }
  }

  const facts = extracted.keyFacts ?? [];
  if (facts.length > 0) {
    parts.push("\nKey facts:");
    for (const f of facts.slice(0, 8)) {
      parts.push(`• ${f}`);
    }
  }

  return parts.join("\n");
}

function buildEvaluationPrompt(
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  conceptTested: string,
): string {
  return `You are evaluating a student's answer to a practice question.

Question: ${question}
Concept tested: ${conceptTested}
Model answer: ${expectedAnswer}
Student's answer: ${userAnswer}

Evaluate whether the student demonstrates understanding of the concept.
Be generous with paraphrasing and different wording.
Only mark incorrect if the answer is fundamentally wrong or misses the key concept.
Provide 2-3 sentences of friendly, specific feedback. If incorrect, briefly explain the correct concept.`;
}
