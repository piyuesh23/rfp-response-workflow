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
5. `benchmarks/drupal-effort-ranges.md` — Backend effort reference ranges
6. `benchmarks/frontend-effort-ranges.md` — Frontend component-level effort reference ranges

### Step 2: Convert Questions to Assumptions
For every question in `initial_questions/questions.md`:
- Select the option (A/B/C) that results in the **lowest effort**
- Convert it to an explicit assumption with CR boundary language
- If no options were provided, formulate the minimal interpretation

### Step 3: Categorize Requirements into Tabs
Place each requirement into the correct estimation tab:

#### Backend Tab
Development tasks requiring PM oversight and QA effort. PM and QA overhead is **auto-calculated** in the Excel sheet — do NOT add separate PM/QA line items here.
- Content Architecture (content types, taxonomies, views, media)
- Custom Module Development
- Integrations (APIs, third-party services, SSO, CRM)
- Migrations (content, data, URL redirects)
- SEO / Accessibility / Performance (backend aspects)
- Security (auth, access control, headers)

#### Frontend Tab
Component-level UI estimates. PM and QA overhead is **auto-calculated** in the Excel sheet. Each line item should be an individual component or template, NOT a domain grouping.
- Design System / Theme Foundation (ALWAYS include — either create new or reuse existing)
- Global Components (header, footer, navigation, search)
- Content Components (hero, cards, accordions, carousels, etc.)
- Form Components (contact, multi-step, filters)
- Page Templates (homepage, listing, detail, search results)

**CRITICAL for Frontend:** When designs are not available (or will be done later / by another agency):
- Every component MUST include visual reference links showing how it should look
- Reference links should point to similar components on comparable sites
- Assumptions must state the design baseline being used

#### Fixed Cost Items Tab
Overhead items that do NOT require QA effort or PM tracking. These are administrative, operational, or one-time setup tasks.
- Discovery & Discussions
- Developer Onboarding
- Deployment & CI/CD Setup
- CMS Training
- User Manual / Documentation
- Technical Documentation
- UAT Support
- Warranty / Hypercare
- Environment Setup

**DO NOT place in Fixed Cost:** Content types, Views, Migrations, Integrations, Custom modules, Component development — anything requiring Project Management oversight or Quality Engineering effort.

#### AI Tab (if applicable)
Only include if the TOR contains AI/ML requirements (chatbots, content generation, recommendation engines, etc.).

### Step 4: Generate Estimates

#### Backend Tab Columns
| Column | Content |
|--------|---------|
| **Task** | Concise task name (e.g., "Content Type: Events") |
| **Description** | What this task delivers — 1-3 sentences |
| **Hours** | Effort in hours — use lower end of benchmark range |
| **Conf** | Confidence level 1-6 based on clarity of the requirement AND confidence in the proposed solution delivering the outcome |
| **Low Hrs** | Same as Hours (optimistic base) |
| **High Hrs** | Hours × (1 + Conf buffer %). Conf 6=0%, 5=+25%, 4=+50%, 3=+50%, 2=+75%, 1=+100% |
| **Assumptions** | What: assumption as CR boundary, referencing TOR sections/clauses or customer Q&A. Impact if wrong: what changes in the estimate. **Never reference internal analysis artifacts.** |
| **Proposed Solution** | Specific technical approach — name modules, packages, APIs, architecture patterns |
| **Reference Links** | Links to contrib modules, documentation, or relevant resources |

#### Frontend Tab Columns
| Column | Content |
|--------|---------|
| **Task** | Component name (e.g., "Hero Banner", "Card — Event", "Header") |
| **Description** | Visual and functional description — layout, behavior, responsive notes |
| **Hours** | Effort in hours — use lower end of `benchmarks/frontend-effort-ranges.md` |
| **Conf** | Confidence level 1-6 — lower if no designs exist yet |
| **Low Hrs** | Same as Hours |
| **High Hrs** | Hours × (1 + Conf buffer %) |
| **Assumptions** | What: design assumptions, interaction behavior, responsive breakpoints (ref TOR/Q&A). Impact if wrong: effort/scope change. |
| **Exclusions** | What is NOT included (e.g., "Animation beyond CSS transitions", "CMS integration — see Backend tab") |
| **Reference Links** | **Visual reference links** — URLs of similar components on comparable sites showing how this should look |

#### Fixed Cost Items Tab Columns
| Column | Content |
|--------|---------|
| **Task** | Task name (e.g., "CMS Training", "Deployment & CI/CD Setup") |
| **Description** | What this delivers — sessions, deliverables, scope |
| **Hours** | Effort in hours |
| **Conf** | Confidence level 1-6 |
| **Low Hrs** | Same as Hours |
| **High Hrs** | Hours × (1 + Conf buffer %) |
| **Assumptions** | What: scope boundaries (ref TOR/Q&A). Impact if wrong: effort/scope change. |
| **Reference Links** | Relevant documentation or tool links |

### Step 4B: Integration Tier Classification
For every integration, classify using the tiers in `benchmarks/drupal-effort-ranges.md`:
- **T1 — Simple** (8-16h): One-way REST, well-documented API, no auth complexity
- **T2 — Standard** (16-32h): Auth required, field mapping, error handling
- **T3 — Complex** (32-60h): Bidirectional, real-time, poorly documented API

State the tier in the Description column. If API docs are unknown, bump up one tier.

### Step 4C: Always-Include Task Validation
Before generating the estimate, verify these tasks are present (from `benchmarks/drupal-effort-ranges.md`):

**Backend (always-include):**
- [ ] Discovery & Requirements Analysis (8-16h)
- [ ] Environment Setup (6-12h)
- [ ] Drupal Installation & Base Configuration (4-8h)
- [ ] Configuration Management Setup (4-6h)
- [ ] Roles & Permissions (4-8h)
- [ ] Media Library Setup (3-6h)
- [ ] Deployment Pipeline (4-8h)
- [ ] QA, Bug Fixes & Stabilisation (10-15% of total)

**Frontend (always-include):**
- [ ] Design System Setup (create new or reuse existing)

If any is missing, add it. These are non-negotiable baseline tasks.

### Step 5: Confidence (Conf) Guidelines
Assign Conf values judiciously based on:

| Conf | When to use |
|------|-------------|
| 1 | Requirement is speculative — TOR barely mentions it, no details, purely inferred |
| 2 | Requirement exists but is vague — multiple interpretations possible |
| 3 | Requirement is described but key details missing — moderate assumption load |
| 4 | Requirement is mostly clear but could use more detail — minor assumptions |
| 5 | Requirement is well-defined in TOR — high confidence in proposed solution |
| 6 | Requirement is crystal clear AND the proposed solution is proven/standard |

**Frontend-specific Conf guidance:**
- No designs available → typically Conf 2-4 (depending on how clear the TOR describes the UI)
- Designs provided → typically Conf 4-6
- Reusing a known design system → bump Conf by +1

### Step 6: Coverage Check
Before finalizing, verify against CARL presales rules:
- [ ] All TOR requirements mapped to estimate line items across correct tabs (no GAPS)
- [ ] Each line item placed in correct tab (Backend/Frontend need QA+PM; Fixed Cost = no QA/PM)
- [ ] Conf values assigned to every line item (1-6 scale)
- [ ] Low Hrs / High Hrs computed using Conf buffer formula for every line item
- [ ] All Conf ≤ 4 items listed in Risk Register with open questions and de-risk actions
- [ ] Always-include Backend tasks present (see Step 4C)
- [ ] Frontend estimated at component level with visual reference links and Exclusions column
- [ ] Design system creation or reuse line item included in Frontend tab
- [ ] Integrations classified by tier (T1/T2/T3) with tier stated in Description
- [ ] Common Fixed Cost categories included: Discovery, Onboarding, Deployment, Documentation, Training, UAT, Warranty, Environments
- [ ] No development tasks in Fixed Cost Items
- [ ] Effort figures within benchmark ranges (lower end acceptable, below range NOT acceptable)
- [ ] All assumptions documented with TOR/Q&A reference AND impact-if-wrong

### Step 7: Output
1. Generate `estimates/optimistic-estimate.md` using `templates/optimistic-estimate-template.md`
2. Generate state file `estimates/[CLIENT_NAME]-estimate-state.md` with `<!-- OPTIMISTIC-ESTIMATE-STATE -->` marker (see template for structure)
3. Run the Excel population script:
   ```bash
   python3 scripts/populate-estimate-xlsx.py estimates/optimistic-estimate.md
   ```
4. Report summary: Low/High/Avg hours per tab, category breakdown, assumption count, risk register count, confidence assessment

### Step 8: Suggest Next Steps
- Recommend running `/tech-proposal` to generate the client-facing proposal document
- If clarification questions were generated, instruct: "Fill in answers in the state file, then re-run `/optimistic-estimate estimates/[CLIENT_NAME]-estimate-state.md` to refine"
- Suggest storing learnings via claude-mem for future engagements

## Resume Mode

If `$ARGUMENTS` points to a file containing `<!-- OPTIMISTIC-ESTIMATE-STATE -->` at the top, this is a **resume session**:

1. Read the full state file
2. Identify which clarification questions have been answered (Answer ≠ `PENDING`)
3. For each answered question, re-evaluate affected tasks:
   - Answer reduces uncertainty → raise Conf, recalculate Low/High Hrs
   - Answer reveals complexity → adjust hours upward, keep or lower Conf
4. Regenerate the full estimate with updated numbers
5. Update Risk Register — remove resolved items
6. Overwrite the state file with updated estimate
7. Re-run the Excel population script

Present a **"What Changed"** summary before the updated tables.

## Important Rules

1. **Never estimate below benchmark minimums** — optimistic means lower end, not fantasy
2. **Every ambiguity = documented assumption** — no silent assumptions
3. **Prefer existing solutions** — contrib modules, platform features, community packages over custom code
4. **Tab placement matters** — Backend/Frontend items get auto-calculated PM+QA overhead in the sheet; Fixed Cost items do NOT. Misplacing items inflates or deflates the total.
5. **Assumptions protect against CRs** — each assumption should make it crystal clear what is in-scope and what triggers a change request
6. **Cross-reference Phase 0 research** — if site audit revealed complexity (e.g., heavy integrations, large content volume), don't ignore it even with optimistic stance
7. **Frontend = component level** — never group frontend as "theming: 200 hours". Break into individual components with visual references.
8. **Design system is mandatory** — always include either creating a design system or integrating an existing one. This is not optional.
9. **Conf reflects solution confidence** — don't default everything to 5. Use the full range based on requirement clarity AND confidence in the technical approach.
10. **Conf drives buffer math** — every line item needs Low Hrs and High Hrs computed from the Conf buffer formula. This is not optional.
11. **Risk Register is mandatory** — every Conf ≤ 4 item MUST appear in the Risk Register with an open question that would resolve the uncertainty.
12. **Always-include tasks are non-negotiable** — if any of the 8 mandatory Backend tasks or the Design System Frontend task is missing, add it before finalizing.
13. **Integration tiers standardize effort** — classify every integration as T1/T2/T3 and state the tier in the Description column. Don't estimate integrations without tier classification.
14. **Assumptions need impact analysis** — every assumption must include "Impact if wrong:" stating what changes in the estimate. TOR/Q&A sourcing requirement still applies.
15. **State file enables iteration** — always write a state file alongside the estimate. This allows refinement when clarification answers arrive.
