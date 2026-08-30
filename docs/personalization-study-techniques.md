# Personalization & Study Techniques — Research Specification

**Scope:** Internal reference for the Pace personalization engine. Covers evidence-based study techniques, how Pace selects them, the onboarding questionnaire design, and how recommendations are measured.

**Audience:** Developers and designers building the personalization feature.

---

## 1. Study Techniques Catalog

### 1.1 Active Recall

**What it is:** Testing yourself on material without looking at notes — flashcards, blank-page recall, practice questions.

**Evidence:** One of the most robustly replicated effects in cognitive psychology. Roediger & Karpicke (2006) found recall practice produced 80% retention vs 36% for re-reading after one week. The "testing effect" is consistent across age groups, content types, and retention intervals.

**Best for:** Students who need to memorise content (definitions, formulas, dates, vocabulary), exam-prep contexts, any subject with high factual load (Biology, History, Chemistry).

**Signals:** studyChallenge = memory · studyGoal = pass/excel · ageGroup = older.

---

### 1.2 Spaced Repetition

**What it is:** Reviewing material at increasing intervals, driven by a forgetting curve. A card recalled easily gets pushed further into the future; a missed card comes back sooner.

**Evidence:** Ebbinghaus's forgetting curve (1885); extensively replicated. Cepeda et al. (2006) meta-analysis across 254 studies confirms optimal spacing intervals improve retention by ~30–40% over massed practice.

**Best for:** Large-volume fact sets, languages, medical/law content, students with weak memory self-rating.

**Signals:** memoryRating = weak/very_weak · studyHabit = flashcards · studyGoal = mastery.

---

### 1.3 Practice Testing

**What it is:** Working through past papers, exam-style questions, or mock assessments under realistic conditions.

**Evidence:** Strong overlap with active recall research. Distinct advantage: practice testing reveals *which question types* the student struggles with, enabling targeted revision. Particularly effective when feedback is reviewed (Kornell & Bjork, 2008).

**Best for:** Exam-anchored students, those whose challenge is "I know it but can't perform it in an exam," younger age groups who benefit from structure.

**Signals:** studyGoal = pass/excel · ageGroup = younger/older · studyChallenge = understanding.

---

### 1.4 Pomodoro Technique

**What it is:** 25-minute focused work blocks followed by 5-minute breaks. Popularised by Francesco Cirillo. Not a memory technique — primarily a time-management and focus-building method.

**Evidence:** Limited RCT evidence as a standalone technique; primary value is reducing decision fatigue and building consistent study habits (Steel, 2007; Ariely & Wertenbroch, 2002). Particularly effective as a *gateway technique* for students who struggle to start.

**Best for:** Students whose primary challenge is focus/getting started, habit-building, younger age groups, students with ADHD-adjacent patterns.

**Signals:** studyChallenge = focus · focusBand = short · studyGoal = habits · ageGroup = younger.

**Note:** Pace already defaults to 25/45/60 minute sessions, which aligns naturally with Pomodoro. When Pomodoro is recommended, the session instruction emphasises distraction removal rather than just the timer.

---

### 1.5 Deep Work

**What it is:** Sustained, distraction-free focus on cognitively demanding tasks for extended periods (Cal Newport, 2016). The opposite of fragmented multitasking.

**Evidence:** Consistent with flow state research (Csikszentmihalyi, 1990) and expertise literature. Elite performance across domains requires extended uninterrupted practice. Well-suited to complex problem-solving, essay writing, mathematical derivation.

**Best for:** Older and university students, those with long focus spans, subjects requiring synthesis and argument construction (Economics essays, Mathematics proofs, A-Level extended writing).

**Signals:** focusBand = long/very_long · studyChallenge = understanding · ageGroup = adult · studyGoal = mastery/excel.

---

### 1.6 Feynman Technique

**What it is:** Explaining a concept in simple language as if teaching it to someone with no background. Gaps in explanation reveal gaps in understanding.

**Evidence:** Grounded in elaborative interrogation (McDaniel & Donnelly, 1996) and self-explanation effects (Chi et al., 1989). Particularly effective for subjects where deep understanding matters more than memorisation.

**Best for:** Students who study passively (re-reading, watching videos) and need active engagement, subjects with conceptual depth (Physics, Philosophy, Economics), students who overestimate their understanding.

**Signals:** studyHabit = passive/note_taking · studyChallenge = understanding · studyGoal = mastery · ageGroup = adult.

---

### 1.7 Interleaving

**What it is:** Mixing different topics, subjects, or question types within a single study session rather than blocking each topic separately.

**Evidence:** Kornell & Bjork (2008); Taylor & Rohrer (2010) showed interleaving improved retention by 43% vs blocked practice on mathematics. The mechanism is "contextual interference" — the brain must retrieve differently each time, strengthening discrimination and flexible recall.

**Best for:** Students managing many subjects, those who feel overconfident after a blocked session, subjects where discriminating between similar concepts matters (Maths problem types, Chemistry reaction mechanisms, History periods).

**Signals:** studyChallenge = prioritization · studyGoal = excel · focusBand = long · ageGroup = adult.

---

## 2. Onboarding Questionnaire Design

### Principles

- **Optional and skippable.** The questionnaire must never block students from using the app. Students who skip get sensible defaults.
- **No psychology jargon.** Questions are written in plain student language. Pace does not tell students what psychological profile they have.
- **Six questions.** Enough signal for a confident recommendation without survey fatigue.
- **Honest framing.** "None of these perfectly describe you? Pick the closest one." is better than false precision.

### Questions and Rationale

| # | Question | Answer options | Why we ask |
|---|---|---|---|
| 1 | How old are you? | 14–15 · 16–17 · 18+ | Maps to younger/older/adult age group; drives session length suggestion and technique pool |
| 2 | When you study, how long can you focus before your mind wanders? | Under 20 minutes · 20–40 minutes · 40–60 minutes · Over an hour | Maps to focusBand; determines whether Pomodoro vs Deep Work fits |
| 3 | When you study, what do you usually do? | Re-read my notes · Make notes from scratch · Quiz myself or do questions · Use flashcards · Watch videos or listen to podcasts | Maps to studyHabit; reveals if student is already active or needs activation |
| 4 | What's your biggest study challenge? | Staying focused and not getting distracted · Remembering what I studied · Understanding difficult concepts · Knowing what to prioritise | Maps to studyChallenge; most direct route to technique fit |
| 5 | What's your main goal right now? | Just pass my exams · Get high grades · Really understand the subject · Build better study habits | Maps to studyGoal; calibrates effort intensity of recommendations |
| 6 | How good is your memory? (be honest) | Very strong — I remember most things · Average — I forget if I don't review · Not great — I need to review frequently · Poor — I forget things quickly | Maps to memoryRating; primary driver for spaced repetition and active recall |

### Skip Handling

When a student skips the questionnaire:
- `personalization_skipped = true` is stored in `profiles`
- No technique recommendation is shown on /today
- The CTA banner is dismissed permanently
- The student can return to the questionnaire later from settings (future feature)

---

## 3. Scoring Algorithm

The scoring is fully deterministic — no LLM, no randomness. See `src/lib/personalization/scoring.ts` for the implementation.

**Process:**
1. Each of the 6 answers contributes a non-negative integer weight toward each of the 7 techniques.
2. Raw points are summed per technique.
3. The maximum raw score across all techniques is used to normalise each score to 0–100.
4. The top technique is the one with the highest normalised score.

**Confidence:**
- `high`: top score ≥ 55 AND gap between top and second ≥ 15 points
- `medium`: top score ≥ 35
- `low`: below medium threshold; system confidence is further reduced by 10 points

**Configuration:** thresholds are named constants in `scoring.ts` — they can be tuned without changing the algorithm.

**Transparency:** The scoring result includes all 7 normalised scores, so the rationale can always be shown ("we recommended this because your highest match was X").

---

## 4. Age-Group Personalisation

Pace adapts recommendations based on age group without building 3 separate apps. See `src/lib/personalization/age-config.ts`.

| Age group | Label | Session suggestion | Max daily hours | Encouraged techniques |
|---|---|---|---|---|
| younger (14–15) | GCSE / Year 9–11 | 25 min | 2h | Pomodoro, Active Recall, Practice Testing |
| older (16–18) | A-Level / Year 12–13 | 45 min | 3h | Active Recall, Spaced Repetition, Practice Testing, Feynman |
| adult (18+) | University / 18+ | 60 min | 5h | Deep Work, Feynman, Interleaving |

The session length suggestion is used as the default during personalisation flow. It does not override what the student set during onboarding — it is offered as a recommendation if the student revisits the setting.

---

## 5. Subject Intelligence (Difficulty + Confidence)

Each subject has two optional student-reported fields:

- **difficulty** (`easy` | `medium` | `hard`): How hard the student finds the subject overall.
- **confidence_pct** (0–100): How confident the student feels about their exam readiness.

These are used by the recommendation engine to prioritise which subject to suggest for today's session:

```
priority = difficulty_weight × urgency × low_confidence_inverse
```

where:
- `difficulty_weight`: hard=3, medium=2, easy=1
- `urgency`: 1–10, derived from days until exam (≤7 days → 10, >60 days → 1)
- `low_confidence_inverse`: 1–5, inverted confidence (0–20% → 5, >80% → 1)

A hard subject with an exam in 5 days and 20% confidence scores 3 × 10 × 5 = 150. A medium subject with no exam and 70% confidence scores 2 × 1 × 2 = 4.

---

## 6. Measurement

How to know if personalisation is working:

| Signal | What it tells us | Where to measure |
|---|---|---|
| Personalization completion rate | Are students engaging with the questionnaire? | `personalization_completed_at IS NOT NULL` / total users |
| Skip rate | Are students opting out? | `personalization_skipped = true` / total users |
| Session completion rate (personalised vs not) | Does having a technique recommendation improve follow-through? | `sessions.status = completed` segmented by `personalization_completed_at IS NOT NULL` |
| Subject recommendation acceptance | Does today's suggested subject match what the student actually studied? | Compare recommendation subjectId vs completed session subjectId |
| Confidence trend | Is the student's confidence_pct increasing over time? | Longitudinal query on `subjects.confidence_pct` per user |

---

## References (abbreviated)

- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning. *Psychological Science*, 17(3), 249–255.
- Cepeda, N. J. et al. (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3), 354–380.
- Taylor, K., & Rohrer, D. (2010). The effects of interleaving practice. *Applied Cognitive Psychology*, 24, 837–848.
- Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories. *Psychological Science*, 19(6), 585–592.
- Newport, C. (2016). *Deep Work: Rules for Focused Success in a Distracted World.* Grand Central Publishing.
- Csikszentmihalyi, M. (1990). *Flow: The Psychology of Optimal Experience.* Harper & Row.
- Chi, M. T. H. et al. (1989). Self-explanations. *Cognitive Science*, 13, 145–182.
