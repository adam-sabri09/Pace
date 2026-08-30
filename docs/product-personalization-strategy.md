# Product Personalization Strategy

**Prepared for:** Internal use — product and engineering.
**Context:** Following a mentor meeting on the strategic direction of Pace, this document records the personalization approach, addresses specific statistics raised in that meeting, and sets the rationale for the decisions made.

---

## 1. The Direction Change

Pace's current loop: Student → creates study plan → starts timer → marks task done/missed.

The new direction: Student → Pace learns about the student → understands their study habits → understands their age group → understands their subjects/workload → understands subject difficulty/confidence → recommends appropriate study techniques → recommends what/when/how to study → adapts the experience to the student.

This is a material shift from a *planner* to a *study coach*. The implementation is evolutionary (no rebuild), module-by-module, and preserves all existing functionality.

---

## 2. The "55% Statistic" — Verification Required

During the mentor meeting, a statistic was cited in the form: approximately **55% of students** [some behaviour related to study techniques, planning, or personalization].

**This statistic could not be verified against a primary source.**

Before this number is used in any investor communication, marketing copy, pitch deck, or public-facing document, the following must be confirmed:

| Question | Status |
|---|---|
| What is the exact claim? | **Unknown** — the precise wording was not recorded |
| What population does it refer to? | **Unknown** — high school? All students? UK? US? |
| What methodology produced it? | **Unknown** — survey? RCT? Observational? |
| Who conducted the research? | **Unknown** — academic institution? Commercial vendor? |
| When was it published? | **Unknown** |
| Is the original source accessible? | **Not checked** |

**Do not cite this statistic as fact until all five questions above are answered with a verifiable primary source.**

If the mentor can provide the source, record it here and move it to the facts section of `market-research.md`. If no source is found, the statistic should be dropped entirely rather than presented as evidence.

---

## 3. What the Evidence Does Say

The following claims from `market-research.md` are fact-labelled and cited:

- **[Fact] 54% of US teens** used an AI chatbot to help with schoolwork by 2025, up from 13% in 2023 [Pew Research 2025–2026].
- **[Fact] Prefrontal cortex development completes in the mid-to-late 20s** — adolescents are developmentally least able to self-plan [NIMH; Tervo-Clemmens et al., 2023].
- **[Fact] At least ~50% of students** exhibit habitual academic procrastination [Rodríguez & Clariana, 2022 — strongest figures are for college samples; high-school extrapolation requires care].
- **[Fact] 29% of secondary pupils** in England and Wales now use private tutoring [Sutton Trust 2026].

These are the statistics we can use. Where a specific number is needed for a claim about study technique effectiveness, use the citations in `docs/personalization-study-techniques.md`.

---

## 4. Personalization Implementation Principles

### 4.1 Deterministic, Not Black-Box

All personalization scoring is rule-based with documented weights (see `src/lib/personalization/scoring.ts`). No LLM decides which technique to recommend. This means:

- The recommendation can always be explained: "Pace suggested Active Recall because your biggest challenge is memory and you're preparing for an exam."
- Edge cases can be debugged without re-running a model.
- The weights can be tuned based on outcome data without breaking the system.

### 4.2 Optional at Every Step

The personalization questionnaire must never block access to the app. Students who skip it get the same study plan they always had — nothing is degraded. The questionnaire is a layer on top, not a gate.

### 4.3 No Psychology Jargon Exposed

The words "active recall," "spaced repetition," "interleaving" etc. appear in session instructions as plain English descriptions, not as named frameworks. Students should never feel like they are being categorised or profiled.

**Good:** "Close your notes and write down everything you remember. This builds real memory."

**Bad:** "Your profile indicates active recall is your optimal encoding strategy."

### 4.4 Age-Group Personalisation Is Config-Driven

Pace adapts to three age groups (younger/older/adult) through a single config object (`src/lib/personalization/age-config.ts`), not by building separate products. This keeps the codebase unified and means adding a fourth group (e.g. primary school) is a config change, not an architecture change.

---

## 5. What We Are NOT Building (Yet)

- **Spotify / music integration** — deferred to a future sprint.
- **Full LMS** — out of scope for MVP.
- **Parent dashboard** — explicitly excluded per product scope.
- **Biometric or attention tracking** — excluded by privacy stance and regulatory exposure (COPPA/ICO).
- **Gamification** — inconsistent with the Quiet Mentor brand personality.

---

## 6. Competitive Context

The market-research report (`docs/research/market-research.md`) identifies one confirmed competitive gap: no dedicated high-school planner ships automatic adaptive re-planning on a missed session. The personalization layer does not replace this — it adds on top of it.

The new personalisation features primarily differentiate Pace on **depth of student understanding** rather than a new technical capability. This is harder to copy than a feature because it requires calibrated data collection + a coherent recommendation model + student trust.

---

## 7. Next Steps

| Item | Owner | Status |
|---|---|---|
| Verify the 55% statistic | Adam | Pending — ask mentor for source |
| Apply `0003_personalization.sql` migration to Supabase | Adam / CI | Pending |
| Build personalization onboarding UI (`/personalize` route) | Engineering | Next |
| Write scoring tests | Engineering | Next |
| Instrument personalization completion rate | Engineering | After UI |
| User interviews to validate technique recommendations | Adam | Before paid growth |
