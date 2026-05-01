# General Effort Ranges — Tech-Agnostic Benchmarks

These are reference ranges for estimation calibration. They are starting points, not rules.
Update with actuals from completed engagements via Phase 5 (Knowledge Capture).

## Developer Baseline (IMPORTANT — read before estimating)

**All ranges in this file assume a mid-level developer (3-5 years experience, comfortable with the platform ecosystem, not a specialist).**

- Adjust +20-30% when the team is junior-heavy (0-2 yrs).
- Adjust -10-15% when the entire team is senior (5+ yrs) with direct platform expertise.
- When team composition is unknown at estimation time, use the mid-level baseline and note the assumption explicitly.

This baseline applies across all tech-stack benchmark files unless the file states otherwise.

---

## Overhead Categories (as % of total development effort)

| Category | Typical Range | Notes |
|----------|--------------|-------|
| Project Management / Scrum | 10-15% | Higher for distributed teams, lower for co-located |
| QA / Testing | 20-30% of dev effort | Includes test planning, execution, regression. Higher for compliance-heavy projects |
| DevOps / CI-CD Setup | 40-80 hours | Initial pipeline, environments, monitoring. Ongoing maintenance separate |
| Environment Provisioning | 16-40 hours | Dev, staging, production. Higher for complex hosting (multi-region, HA) |
| Documentation | 5-10% of dev effort | Technical docs, API docs, runbooks |
| Training | 16-40 hours | End-user training, admin training, developer handoff |
| UAT Support | 40-80 hours | Depends on client maturity and number of UAT cycles |
| Warranty / Hypercare | 40-80 hours | Typically 2-4 weeks post-launch at reduced capacity |

---

## Content Migration (by volume)

| Volume | Effort Range | Notes |
|--------|-------------|-------|
| Small (< 100 pages) | 24-60 hours | Manual review feasible, minimal scripting |
| Medium (100-1,000 pages) | 60-160 hours | Scripted migration + manual QA sampling |
| Large (1,000-10,000 pages) | 160-400 hours | Full automation required, extensive QA |
| Enterprise (10,000+) | 400+ hours | Phased migration, dedicated migration team |

**Multipliers:** Media-heavy content +30-50%. Multi-language +50-100% per language.

---

## Integration Complexity Tiers

| Tier | Description | Typical Effort | Examples |
|------|------------|---------------|---------|
| Simple | One-way REST API, read-only | 16-40 hours | Pulling data from a public API, RSS feeds |
| Medium | OAuth + bidirectional data sync | 40-120 hours | CRM sync, payment gateway, SSO (SAML/OIDC) |
| Complex | Real-time bidirectional + custom auth + error handling | 120-300 hours | ERP integration, inventory sync, multi-system orchestration |

---

## Discovery & Architecture

| Activity | Typical Effort | When |
|----------|---------------|------|
| Technical discovery / spike | 16-40 hours | Before estimation for unknowns |
| Architecture design | 24-60 hours | For new builds or major redesigns |
| Proof of concept | 40-80 hours | When tech feasibility is uncertain |

---

## Notes

- These ranges assume a mid-level to senior developer. Adjust +20-30% for junior-heavy teams.
- Ranges assume reasonably clear requirements. Add contingency buffer (15-25%) for ambiguous requirements.
- Remote/distributed teams: add 10-15% communication overhead.
