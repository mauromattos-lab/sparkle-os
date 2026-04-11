# ADR-002 — Context Store: Redis + Postgres (Write-Through)

**Status:** Accepted  
**Date:** 2026-04-11  
**Story:** 1.3 — Persistência de Contexto dos Agentes  
**Decided by:** @architect (Aria)

---

## Context

AIOX agents operate in ephemeral Claude Code sessions. When a session ends, all in-memory state (current task, files modified, decisions made, next steps, blockers) is lost. The next session starts blind, requiring Mauro to repeat context manually — which is slow, error-prone, and removes the "AI-native" quality of SparkleOS.

We need a persistence mechanism that:
- Allows sub-5ms context retrieval at session start
- Never permanently loses state (even after Redis TTL expiry)
- Supports audit of past decisions
- Remains simple enough for any agent to call via fetch

## Decision

Implement a **write-through dual-layer Context Store**:

| Layer | Technology | Purpose | TTL |
|-------|-----------|---------|-----|
| Hot cache | Redis 7.x (Coolify VPS) | Fast context retrieval | 72 hours |
| Cold storage | Postgres 16 (Supabase) | Permanent history | Indefinite |

**Write-through strategy:** Every `saveContext()` writes to Postgres first (durable), then caches in Redis (fast). Redis acts as a performance layer, not a source of truth.

**Redis key pattern:** `context:{agentId}:active`

## Alternatives Considered

### 1. Redis only
- **Rejected:** TTL expiry causes permanent data loss. Not acceptable for a system where decision history must be auditable.

### 2. Postgres only
- **Rejected:** Acceptable correctness but latency concern for session startup. With Supabase free tier over the internet, query latency can exceed 200ms vs <5ms for local Redis.

### 3. File-based (`.aios/` directory)
- **Rejected:** Already gitignored (runtime-only by design). Does not support querying history across sessions or agents.

## Consequences

### Positive
- Session startup: Redis cache warms from previous session → <5ms retrieval
- Durability: Postgres is always the source of truth — Redis is lossy by design
- Graceful degradation: If Redis is unavailable, the system falls back to Postgres transparently
- History: Full decision log available via `GET /api/context/:agentId/history`

### Negative / Risks
- Redis on Coolify VPS adds infra dependency for dev performance (not for correctness)
- Supabase free tier limits (500MB, 2GB bandwidth) — monitored in Story 1.8
- Write-through adds latency to saves vs write-back — acceptable since saves are infrequent

## Implementation

- **Package:** `packages/core`
- **Service:** `src/context/context-store.ts`
- **API:** `src/context/context-router.ts` (4 endpoints via Hono)
- **Schema:** `src/db/schema.ts` + `migrations/0001_agent_contexts.sql`
- **Redis client:** `src/redis/client.ts` (ioredis, lazy connect, no-retry on startup)
