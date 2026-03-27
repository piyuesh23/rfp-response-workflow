---
name: optimistic-estimate
description: Generate optimistic, minimal effort estimates with detailed assumptions as CR boundaries. Use when customer Q&A responses are unavailable and you still want to submit a competitive proposal.
argument-hint: "[backend|frontend|fullstack]"
---

# /optimistic-estimate — Optimistic Estimation (No-Response Path)

## When to Use

Run this after Phase 1 (TOR Analysis) when:
- Customer responses to clarifying questions have NOT been received
- Submission deadline is approaching
- You want to participate with a competitive, assumption-heavy proposal

This is **Phase 1A** — an alternative to the Phase 2→3→4 path.

## Agent Persona

**Senior [TECH_STACK] Architect** optimizing for competitive positioning.
You are producing estimates that are realistic but optimistic — choosing the lower end of reasonable effort ranges while protecting scope with detailed assumptions.

## Estimation Philosophy

### Optimistic ≠ Unrealistic
- Use the **lower bound** of benchmark ranges from `benchmarks/`, never below them
- Prefer **platform-native and contrib/community solutions** over custom development
- Prefer **simpler architectures** (monolith over microservices, server-rendered over decoupled) unless TOR explicitly requires otherwise
- Each ambiguous requirement → choose the **minimal viable interpretation**

### Assumptions as CR Boundaries
Every assumption MUST be phrased as a scope boundary that makes clear what would constitute a change request:
- BAD: "Assuming simple search"
- GOOD: "Assuming site search will use platform-native search capabilities (e.g., Drupal Search API with database backend). Any requirement for third-party search services (Algolia, Elasticsearch, Solr) will be handled as a change request."

## Execution Steps

### Step 1: Gather Inputs
Read all available artefacts in order:
1. `tor/` — TOR/RFP/SOW documents (REQUIRED)
2. `research/customer-research.md` — Phase 0 research (if available)
3. `claude-artefacts/tor-assessment.md` — Phase 1 requirement assessment (if available)
4. `initial_questions/questions.md` — Phase 1 clarifying questions (if available)
5. `benchmarks/` — Effort reference ranges

### Step 2: Convert Questions to Assumptions
For every question in `initial_questions/questions.md`:
- Select the option (A/B/C) that results in the **lowest effort**
- Convert it to an explicit assumption with CR boundary language
- If no options were provided, formulate the minimal interpretation

### Step 3: Categorize Requirements
Group all TOR requirements by domain (per CARL presales rules):
- Content Architecture
- Integrations
- Migrations
- Frontend/Theming
- DevOps/Hosting
- SEO / Accessibility / Performance
- Security
- Project Management & Support

### Step 4: Generate Estimates
For each requirement, produce a row with these columns (matching the QED42 Backend tab):

| Column | Content |
|--------|---------|
| **Task** | Concise task name (e.g., "Content Type: Events") |
| **Description** | What this task delivers — 1-3 sentences |
| **Hours** | Effort in hours — use lower end of benchmark range |
| **Assumptions** | All assumptions for this task, each as a CR boundary. Separate multiple assumptions with line breaks. |
| **Proposed Solution** | Specific technical approach — name modules, packages, APIs, architecture patterns |
| **Reference Links** | Links to contrib modules, documentation, or relevant resources |

### Step 5: Coverage Check
Before finalizing, verify against CARL presales rules:
- [ ] All TOR requirements mapped to estimate line items (no GAPS)
- [ ] Common categories included: PM/Scrum, QA/testing, DevOps/CI-CD, content migration, training, documentation, UAT support, warranty/hypercare, environment setup
- [ ] Effort figures within benchmark ranges (lower end acceptable, below range NOT acceptable)
- [ ] All assumptions documented separately

### Step 6: Output
1. Generate `estimates/optimistic-estimate.md` using `templates/optimistic-estimate-template.md`
2. Run the Excel population script:
   ```bash
   python3 scripts/populate-estimate-xlsx.py estimates/optimistic-estimate.md
   ```
3. Report summary: total hours, category breakdown, assumption count, confidence assessment

### Step 7: Suggest Next Steps
- Recommend running `/tech-proposal` to generate the client-facing proposal document
- Suggest storing learnings via claude-mem for future engagements

## Important Rules

1. **Never estimate below benchmark minimums** — optimistic means lower end, not fantasy
2. **Every ambiguity = documented assumption** — no silent assumptions
3. **Prefer existing solutions** — contrib modules, platform features, community packages over custom code
4. **Include all support categories** — PM, QA, DevOps, training, documentation, UAT, warranty are NOT optional
5. **Assumptions protect against CRs** — each assumption should make it crystal clear what is in-scope and what triggers a change request
6. **Cross-reference Phase 0 research** — if site audit revealed complexity (e.g., heavy integrations, large content volume), don't ignore it even with optimistic stance
