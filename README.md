# SparkleOS

**AI-native operating system for the Sparkle agency.**

SparkleOS is the infrastructure where AIOX agents live, build, and improve in a coordinated way. Unlike traditional software projects, the primary actors here are AI agents — not human developers. Agents design, implement, test, and maintain the system following a formal story-driven process.

---

## Repository Structure

```
sparkle-os/
├── packages/
│   ├── core/          # SparkleOS Core — Context Store, ADR Registry, Internal API (Hono)
│   ├── brain/         # Collective Brain — knowledge ingest, validation, application
│   └── shared/        # TypeScript types and contracts shared across all packages
│
├── organs/
│   └── zenya/         # Zenya Nucleus — WhatsApp AI attendant (n8n + Chatwoot + Z-API)
│
├── apps/
│   └── piloting/      # Piloting Interface — Mauro's operational cockpit (Next.js 15)
│
├── infra/             # Coolify configs, Docker Compose, GitHub Actions CI/CD
│
├── docs/
│   ├── stories/       # AIOX development stories (numbered by epic)
│   ├── adrs/          # Architecture Decision Records (ADR-NNN-title.md)
│   ├── sops/          # Standard Operating Procedures
│   ├── prd.md         # Product Requirements Document
│   ├── architecture.md# Full-stack architecture document
│   └── brief.md       # Project brief
│
└── .aiox-core/        # AIOX agent framework (framework code — do not modify)
```

---

## Architecture Overview

SparkleOS is built in three layers:

| Layer | Package | Purpose |
|-------|---------|---------|
| **Infrastructure** | `packages/core` | Agent habitat — Context Store, ADR Registry, Internal API |
| **Brain** | `packages/brain` | Collective Brain — capture → validate → apply knowledge cycle |
| **Piloting Interface** | `apps/piloting` | Mauro's cockpit — real-time visibility without technical logs |

**Zenya** (`organs/zenya`) is the first Nucleus: a WhatsApp AI attendant that serves as proof-of-concept for the full architecture.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x + Node.js 22 LTS |
| Backend Framework | Hono v4 (ultra-lightweight, AI-consumption optimized) |
| Frontend | Next.js 15 (App Router) + shadcn/ui + Tailwind CSS v4 |
| Database | Postgres 16 via Supabase (+ pgvector for Collective Brain) |
| Cache | Redis 7.x via Coolify (agent context, < 5ms retrieval) |
| Package Manager | pnpm workspaces (monorepo) |
| Testing | Vitest + Playwright |
| Deploy | Coolify (VPS) + Vercel (frontend) |

---

## Agent Framework

SparkleOS is built by **AIOX agents** operating via Claude Code sessions on Mauro's machine:

| Agent | Role |
|-------|------|
| `@architect` | Architecture decisions, system design |
| `@dev` | Code implementation |
| `@qa` | Quality gates, testing |
| `@pm` | Product management, epics |
| `@po` | Story validation, backlog |
| `@sm` | Story creation, process facilitation |
| `@analyst` | Research and analysis |
| `@devops` | CI/CD, git push, infrastructure |
| `@data-engineer` | Database schema, RLS, migrations |
| `@ux-design-expert` | UX/UI design |

> **Distinction:** AIOX agents (above) are **builders** — they construct SparkleOS. Organ workers (future) are **products** — autonomous agents built by the system to operate Nuclei.

---

## Development Process

All development follows the **Story Development Cycle (SDC)**:

```
@sm *draft → @po *validate → @dev *develop → @qa *qa-gate → @devops *push
```

Stories live in `docs/stories/`. No code without a story.

---

## Epics

| Epic | Objective | Status |
|------|-----------|--------|
| **Epic 1** | Foundation: habitat, process, and toolset for agents | 🔨 In Progress |
| **Epic 2** | Zenya Integrated as first formal Nucleus | ⏳ Pending |
| **Epic 3** | Collective Brain v1 — full learning cycle | ⏳ Pending |
| **Epic 4** | Piloting Interface v1 — Mauro's cockpit | ⏳ Pending |

---

*SparkleOS — built by AI, for AI, to serve humans better.*
