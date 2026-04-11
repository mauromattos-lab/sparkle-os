# ADR-003 — Security and Isolation Model for SparkleOS

**Status:** Accepted  
**Number:** 003  
**Date:** 2026-04-11  
**Author:** @dev (Dex)  
**Story:** 1.10 — Base de Segurança e Isolamento  
**References:** NFR3 (isolamento multi-tenant não-negociável), NFR8 (dados de clientes protegidos)

---

## Context

SparkleOS will eventually serve multiple Zenya clients (tenants). From the start, we need a data isolation model that prevents data from Client A from being visible to Client B — not as a future remediation, but as a structural invariant.

The system is internal-only during Epic 1 (only Mauro and AIOX agents access it). However, data isolation must be built in from the first table creation, as retrofitting RLS to production tables with existing data is a high-risk operation.

---

## Decision

**Multi-tenant isolation via PostgreSQL Row-Level Security (RLS), with `tenant_id` on all client data tables.**

### Tenant Model
```
Tenant = One Zenya client
  → Each tenant has a unique UUID (tenant_id)
  → All conversations, data, and configurations isolated by tenant_id
  → No cross-tenant queries possible by design
```

### Isolation Mechanism
1. **`tenant_id` column** on every table containing client-specific data
2. **RLS enabled** on all such tables (not optional)
3. **Policy pattern:**
   ```sql
   CREATE POLICY tenant_isolation ON {table}
     USING (tenant_id = COALESCE(
       NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID,
       '00000000-0000-0000-0000-000000000000'::UUID
     ));
   ```
4. **`app.current_tenant_id`** set at the start of each database session for tenant-scoped operations
5. **No tenant_id on infrastructure tables** (e.g., agent_contexts, adrs, cost_events — these are system data, not client data)

### API Authentication
- **Bearer token** (`INTERNAL_API_TOKEN` env var) for all Hono API endpoints
- No OAuth, no JWT — system is internal (single user: Mauro + AIOX agents)
- Supabase `service_key` for agent operations (never exposed to frontend)
- `anon_key` for public operations (none planned in Epic 1)

---

## Alternatives Considered

### A. Application-Level Filtering
Add `WHERE tenant_id = $contextTenantId` in every query.

**Rejected:** Error-prone. A single forgotten WHERE clause exposes all tenant data. RLS is a database-enforced guarantee, not a discipline one.

### B. Separate Schemas per Tenant
Each tenant gets their own Postgres schema (e.g., `zenya_abc.*`, `zenya_xyz.*`).

**Rejected:** Over-engineered for the current scale. Creates operational complexity (migrations must run per schema). RLS on shared tables is the standard multi-tenant pattern at this scale.

### C. Separate Databases per Tenant
Each tenant gets their own Supabase project.

**Rejected:** Prohibitive cost. Supabase free tier is per-project. Cross-tenant analytics (future) becomes impossible.

---

## Consequences

### Positive
- **Structural guarantee:** Data isolation enforced by Postgres, not application logic
- **Auditable:** RLS policies are visible in `pg_policies`
- **Scalable:** Pattern works for 2 or 200 tenants without code changes
- **Future-proof:** OAuth integration can be added later without schema migration

### Negative / Risks
- **RLS debugging:** When queries return no rows unexpectedly, developers must check `current_setting('app.current_tenant_id')`
- **Migration sensitivity:** Existing tables cannot easily have RLS added with data — all tables must be created with RLS from day 0
- **Performance:** RLS adds overhead per query — acceptable at SparkleOS scale, must be monitored in Epic 4

### Mitigation
- `NULLIF(..., '')` in policy prevents silent empty UUID from matching real data
- `00000000-0000-0000-0000-000000000000` as fallback UUID is a known non-existent tenant — ensures zero data exposure when context is missing
- SOP-1.10-A documents how to set tenant context before operations

---

## References
- NFR3: "Isolamento multi-tenant: dados de clientes Zenya completamente isolados por design"
- NFR8: "Segurança: tokens, RLS e variáveis de ambiente nunca hardcoded"
- Migration: `packages/core/migrations/0005_tenants_rls.sql`
- SOP: `docs/sops/sop-onboarding-cliente-zenya.md`
