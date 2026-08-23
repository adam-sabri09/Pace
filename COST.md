# COST.md

Goal: run the prototype at **$0** for development and small-scale testing. This file audits every service in the stack.

## Verdict up front

Achievable at $0, **with one important caveat about the LLM provider**. Everything else has a genuinely free tier with no credit card required.

## Service-by-service audit

### Vercel (hosting, build, serverless runtime)
- **Free tier**: Hobby plan. No credit card required to sign up or deploy.
- **Limits (Hobby)**: personal, non-commercial use only; 100 GB/mo bandwidth; deployments + preview URLs; custom domains via subdomain or bring-your-own; serverless function execution included.
- **Risk**: none for MVP scale.
- **Cost at MVP scale**: $0.

### Supabase (Postgres + Auth)
- **Free tier**: yes. No credit card required to create the account or the first two projects.
- **Limits**: 500 MB database, 50 K monthly active users, 1 GB storage, 2 organizations, 2 free projects. Projects pause after 1 week of inactivity (unpause is instant, one click).
- **Risk**: the "1 week inactivity pause" is worth remembering during long dev pauses — no data loss, just a manual unpause.
- **Cost at MVP scale**: $0.

### LLM provider — the one cost risk
- **Anthropic Claude direct API**: requires a payment method to obtain a key. No genuine no-card free tier. **Not $0-safe.**
- **OpenAI direct API**: requires a payment method. **Not $0-safe.**
- **Vercel AI Gateway**: routes calls to underlying providers, and each provider's own billing still applies. AI Gateway itself does not make paid models free.
- **Google Gemini API (AI Studio)**: has a genuine free tier — free API key with no credit card required, rate-limited (roughly 15 requests/min, 1,500/day on the Flash tier — sufficient for prototype testing).
- **Groq**: free tier with no credit card required, rate-limited.

**Recommendation**: Use **Google Gemini free-tier** for the prototype phase. Route it through the Vercel AI Gateway if convenient, or call the Google API directly via AI SDK. This preserves our AI-SDK-based code path and lets us swap in Claude later without code changes when we're willing to add a card.

This is a change from the earlier `DECISIONS.md` entry that named "Claude via AI Gateway." Recorded as D14 below.

### GitHub (source hosting + Actions)
- **Free tier**: unlimited public and private repos; 2,000 CI minutes/month on private repos, unlimited on public.
- **Risk**: none. CI itself is Phase 5 work — not spent now.
- **Cost**: $0.

### Domain name
- **Vercel provides**: `<project>.vercel.app` subdomain for free.
- **Custom domain**: costs money; **not needed** in MVP.
- **Cost**: $0 as long as we accept a `vercel.app` URL.

### Local development tools
- Node.js, npm, TypeScript, Next.js, Tailwind, shadcn/ui, Vitest, Playwright, Git — all free open source.
- **Cost**: $0.

### Email delivery
- **Supabase Auth** sends verification/reset emails free out of the box (with rate limits and Supabase-branded sender). Sufficient for MVP.
- **Cost**: $0.

### Error tracking / monitoring
- **Not in MVP.** Deferred. Sentry has a free tier if we choose to add it later.

## Anything that requires a credit card

Only the direct LLM providers (Anthropic, OpenAI). We route around this by using Google Gemini free tier. **No other service in the stack requires a card.**

## What could bump cost above $0

- Traffic beyond Vercel Hobby bandwidth (100 GB/mo) — very unlikely at MVP scale.
- Database > 500 MB — very unlikely for a handful of users.
- LLM usage exceeding Gemini's free-tier rate limits — mitigated by user count being small.
- Adding a custom domain — optional.

## Summary table

| Service | Free tier? | Credit card required? | MVP fits? |
|---|---|---|---|
| Vercel Hobby | Yes | No | Yes |
| Supabase Free | Yes | No | Yes |
| Google Gemini (AI Studio) | Yes | No | Yes |
| Anthropic direct API | No genuine free tier | Yes | Not $0 |
| OpenAI direct API | No genuine free tier | Yes | Not $0 |
| GitHub | Yes | No | Yes |
| Vercel `.vercel.app` domain | Yes | No | Yes |
