# Pace — Documentation Index

Central index for all project documentation. Files are grouped by purpose.
Source code lives under `src/`; this folder holds only documentation.

> Convention: documentation uses lowercase, hyphenated filenames. The root
> [`CLAUDE.md`](../CLAUDE.md) (AI-assistant instructions) and [`README.md`](../README.md)
> stay at the repository root by convention.

## Technical

- [Architecture](./technical/architecture.md) — System design: Next.js on Vercel, Supabase, Gemini via the AI SDK; data flows and the server/client split.
- [Database](./technical/database.md) — Postgres schema, tables, relationships, constraints, and Row-Level-Security model.
- [API Contracts](./technical/api-contracts.md) — Server-action contracts (inputs, outputs, error shape) and the LLM I/O contract.
- [Project Structure](./technical/project-structure.md) — Target folder layout and file-ownership rules.
- [Cost & Stack Audit](./technical/cost-and-stack-audit.md) — $0-stack audit: which services are free, which need a card, and where cost could appear.

## Research

- [Market Research](./research/market-research.md) — Problem validation, market size, target customer, competitor analysis, pricing, risks, and the BUILD/PIVOT/KILL decision, plus the business & systems modelling companion (Part II).

## Requirements

- [Product Scope](./requirements/product-scope.md) — MVP scope: what the product is, the locked feature set, and explicit non-goals.
- [Requirements](./requirements/requirements.md) — Numbered functional (F1–F12) and non-functional (N1–N6) requirements.

## Development

- [Development Rules](./development/development-rules.md) — Engineering rules: scope discipline, Git, code, testing, LLM, security, and review.
- [Branching Strategy](./development/branching-strategy.md) — Git branching workflow, commit conventions, and PR/merge rules.
- [Decisions Log](./development/decisions-log.md) — Append-only record of key decisions with reasoning and trade-offs (D1–D35+).

## Testing

- [Testing Strategy](./testing/testing-strategy.md) — Test pyramid, tools (Vitest, Playwright), per-requirement test matrix, and CI rules.

## Design

- [Design Spec](./design/design-spec.md) — Visual system derived from the approved Stitch export: tokens, components, all 13 screens, responsive behaviour, accessibility.
- [UI Spec](./design/ui-spec.md) — Page/route inventory, component library, visual style rules, and out-of-scope UI.
- [User Flows](./design/user-flows.md) — Key end-to-end user flows and explicit non-flows.

## Project-level docs at the repository root

- [`README.md`](../README.md) — Repository overview and quickstart.
- [`CLAUDE.md`](../CLAUDE.md) — Instructions for AI assistants working in this repo (also lists where each doc lives).
