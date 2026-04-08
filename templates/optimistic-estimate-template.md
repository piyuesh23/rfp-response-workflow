# Optimistic Estimate — [CLIENT_NAME]

**Date:** [DATE]
**Estimator:** Claude Code (Senior [TECH_STACK] Architect)
**Estimation Mode:** Optimistic (No-Response Path — Phase 1A)
**Inputs:** TOR, Phase 0 Research, Phase 1 Assessment (no customer Q&A responses)

---

## Estimation Approach

This estimate follows the **optimistic methodology**: requirements are interpreted at their minimal viable scope, platform-native and community solutions are preferred over custom development, and all ambiguities are resolved via documented assumptions that serve as change-request boundaries.

**Benchmark source:** `benchmarks/` reference ranges (lower bound targeted)

**Tab structure:** Estimates are organized into separate tabs matching the QED42 Excel template:
- **Backend** — All CMS/server-side work requiring PM oversight and QA effort
- **Frontend** — Component-level UI implementation with visual references
- **Fixed Cost Items** — Overhead items that don't require QA or PM tracking (deployment, documentation, onboarding, etc.)
- **AI** — AI-powered features and integrations (if applicable)

**Confidence (Conf) scale:** 1-6 per line item, based on confidence in delivering the proposed solution:
| Conf | Meaning | Buffer (High Hrs) |
|------|---------|-------------------|
| 1 | Scope is purely speculative | +100% |
| 2 | Scope is vague | +75% |
| 3 | Scope definition is moderate | +50% |
| 4 | Scope could use more detail | +50% |
| 5 | High confidence in scope definition | +25% |
| 6 | No uncertainty to apply | 0% |

**Hour computation:**
- `Low Hrs` = base `Hours` (optimistic estimate)
- `High Hrs` = `Hours × (1 + buffer%)` based on Conf level above
- Summary totals include `Avg Hrs` = `(Total Low + Total High) / 2`

---

## Summary

| Tab | Low Hrs | High Hrs | Avg Hrs | Line Items | Assumptions |
|-----|---------|----------|---------|------------|-------------|
| Backend | [hrs] | [hrs] | [hrs] | [n] | [n] |
| Frontend | [hrs] | [hrs] | [hrs] | [n] | [n] |
| Fixed Cost Items | [hrs] | [hrs] | [hrs] | [n] | [n] |
| AI | [hrs] | [hrs] | [hrs] | [n] | [n] |
| **TOTAL** | **[hrs]** | **[hrs]** | **[hrs]** | **[n]** | **[n]** |

---

# Backend Tab

Items in this tab require Project Management oversight and Quality Assurance effort (auto-calculated in the Excel sheet).

## Content Architecture

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [benchmark-key or N/A] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption referencing TOR sections/clauses or customer Q&A. Impact if wrong: effort/scope change] | [specific technical approach] | [links] |

---

## Integrations

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [benchmark-key or N/A] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption referencing TOR/Q&A. Impact if wrong: effort/scope change] | [solution] | [links] |

---

## Migrations

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [benchmark-key or N/A] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption referencing TOR/Q&A. Impact if wrong: effort/scope change] | [solution] | [links] |

---

## Custom Module Development

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [benchmark-key or N/A] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption referencing TOR/Q&A. Impact if wrong: effort/scope change] | [solution] | [links] |

---

## SEO / Accessibility / Performance

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [benchmark-key or N/A] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption referencing TOR/Q&A. Impact if wrong: effort/scope change] | [solution] | [links] |

---

## Security

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [benchmark-key or N/A] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption referencing TOR/Q&A. Impact if wrong: effort/scope change] | [solution] | [links] |

---

# Frontend Tab

Component-level estimates. Each line item is a UI component or template with visual reference links showing what it should look like. This is especially important when designs are not yet available.

Items in this tab require Project Management oversight and Quality Assurance effort (auto-calculated in the Excel sheet).

## Design System / Theme Foundation

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|------------|-----------------|
| Design System Setup | [create new / reuse existing — specify which] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption about design availability, brand guidelines (ref TOR/Q&A). Impact if wrong: effort/scope change] | [what's excluded] | [link to design system being reused, or similar reference] |
| Theme Setup | [build tooling, base config, folder structure] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [links] |
| Generic Elements / Styleguide | [headings, lists, CTAs, typography, colors] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [links] |

---

## Global Components

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|------------|-----------------|
| Header | [describe layout, nav levels, mobile behavior] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link — similar site header] |
| Footer | [describe columns, content] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link] |
| Navigation | [primary, breadcrumbs, sidebar] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link] |
| Search | [bar, autocomplete, overlay] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link] |

---

## Content Components

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|------------|-----------------|
| Hero Banner | [image/video, overlay, CTAs] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link — e.g., similar hero on comparable site] |
| Card | [image, title, excerpt, metadata] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link] |
| [component] | [description] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link] |

---

## Form Components

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|------------|-----------------|
| [form component] | [description] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link] |

---

## Page Templates

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|------------|-----------------|
| Homepage | [component assembly, layout] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link — similar homepage] |
| [template] | [description] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | [exclusions] | [visual reference link] |

---

# Fixed Cost Items Tab

Items that do NOT require QA effort or Project Management oversight. These are administrative, operational, or one-time setup tasks.

| Task | Description | Hours | Conf | Low Hrs | High Hrs | Assumptions | Reference Links |
|------|-------------|-------|------|---------|----------|-------------|-----------------|
| Discovery & Discussions | [kickoff, requirement deep-dives, architecture review] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| Developer Onboarding | [environment setup, codebase walkthrough, access provisioning] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| Deployment & CI/CD Setup | [pipeline creation, environment provisioning, release process] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| CMS Training | [sessions, recordings, materials] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| User Manual / Documentation | [technical docs, content author guides] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| Technical Documentation | [architecture docs, API docs, runbooks] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| UAT Support | [test environment, bug triage during UAT] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| Warranty / Hypercare | [post-launch support window] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |
| Environment Setup | [dev, staging, production environments] | [hrs] | [1-6] | [hrs] | [hrs × buffer] | [assumptions ref TOR/Q&A. Impact if wrong: ...] | |

---

# AI Tab (if applicable)

AI-powered features and integrations. Include only if the TOR contains AI/ML requirements.

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|--------------|------|---------|----------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [benchmark-key or N/A] | [1-6] | [hrs] | [hrs × buffer] | [What: assumption referencing TOR/Q&A. Impact if wrong: effort/scope change] | [solution] | [links] |

---

## Risk Register

All items with Conf ≤ 4. These represent areas of significant uncertainty that could materially affect the estimate.

| Task | Tab | Conf | Risk / Dependency | Open Question for PM/Client | Recommended Action | Hours at Risk |
|------|-----|------|-------------------|----------------------------|-------------------|---------------|
| [task] | [Backend/Frontend/Fixed/AI] | [1-4] | [what's uncertain] | [specific question that resolves it] | [de-risk action] | [additional hrs if assumption is wrong] |

---

## Assumption Register

All assumptions that bound scope and define change-request triggers.

| # | Tab | Domain | Assumption (ref TOR/Q&A) | Impact if Wrong | CR Trigger | Effort Impact if Changed |
|---|-----|--------|--------------------------|-----------------|------------|--------------------------|
| A-001 | [Backend/Frontend/Fixed/AI] | [domain] | [What: assumption text referencing TOR section/clause or Q&A response] | [What changes in the estimate if this assumption doesn't hold] | [what would trigger a CR] | [estimated additional hours] |
| A-002 | ... | ... | ... | ... | ... | ... |

---

## Questions Resolved via Assumptions

Mapping of Phase 1 clarifying questions to the assumptions used in this estimate.

| Question ID | Original Question | Assumption Applied | Option Selected |
|-------------|------------------|-------------------|-----------------|
| Q-001 | [question] | A-XXX | [which option / minimal interpretation] |

---

## Confidence Assessment

| Area | Tab | Avg Conf | Reason |
|------|-----|----------|--------|
| [area] | [Backend/Frontend/Fixed/AI] | [1-6] | [why — e.g., "clear in TOR" or "no designs available yet"] |

**Overall Confidence:** [Medium] — This estimate is assumption-heavy due to the absence of customer Q&A responses. [n] assumptions serve as scope boundaries. If more than [threshold] assumptions prove incorrect, a re-estimation is recommended.

---

## Coverage Checklist

- [ ] All TOR requirements mapped to at least one estimate line item across Backend/Frontend/Fixed Cost/AI tabs
- [ ] No orphan line items (every line traces to a TOR requirement)
- [ ] Each line item placed in correct tab (Backend/Frontend need QA+PM → auto-calculated; Fixed Cost → no QA/PM overhead)
- [ ] Conf values assigned to every line item (1-6 scale)
- [ ] Frontend estimates at component level with visual reference links
- [ ] Design system creation or reuse included in Frontend tab
- [ ] Fixed Cost Items include: Discovery, Onboarding, Deployment, Documentation, Training, UAT, Warranty, Environments
- [ ] Fixed Cost Items do NOT include development tasks requiring QA/PM
- [ ] Low Hrs / High Hrs computed using Conf buffer formula for every line item
- [ ] All Conf ≤ 4 items listed in Risk Register with open questions and de-risk actions
- [ ] All effort figures within benchmark ranges
- [ ] All assumptions documented with TOR/Q&A reference AND impact-if-wrong
- [ ] Always-include tasks present: Discovery, Environment Setup, Base Configuration, Config Management, Roles & Permissions, Media Library, Deployment Pipeline, QA/Stabilisation (Backend); Design System (Frontend)

---

## State File & Resume

After generating the estimate, write a state file: `estimates/[CLIENT_NAME]-estimate-state.md`

The state file captures the estimate session for iterative refinement. Include this marker at the top:

```
<!-- OPTIMISTIC-ESTIMATE-STATE -->
```

### State File Structure

```markdown
<!-- OPTIMISTIC-ESTIMATE-STATE -->
# Estimate State — [CLIENT_NAME]

## Confirmed Scope
[Summary of what was confirmed before estimating]

## Estimator Assumptions
[Any assumptions provided by the estimator beyond the TOR]

## Clarification Questions for PM/Client
### Q1: [question text]
- **Why it matters:** [1 line]
- **Affected tasks:** [task names]
- **Answer:** PENDING

### Q2: ...

## Draft Estimate
[Full estimate tables embedded inline — Backend, Frontend, Fixed Cost, AI tabs]

## Risk Register
[Copy of risk register]

## Assumption Register
[Copy of assumption register]
```

### Resume Mode

When the input file contains `<!-- OPTIMISTIC-ESTIMATE-STATE -->`:

1. Read the full state file
2. Identify which questions have been answered (Answer is no longer `PENDING`)
3. For each answered question, re-evaluate affected tasks:
   - Answer reduces uncertainty → raise Conf, adjust hours if needed
   - Answer reveals complexity → keep or lower Conf, increase hours
4. Regenerate the full estimate with updated numbers
5. Update Risk Register — remove resolved items, keep pending ones
6. Overwrite the state file with the updated estimate

Present a **"What Changed"** summary:

> **What Changed Since the Draft Estimate:**
> - [Task name]: Conf raised from 4 → 5 / hours adjusted from X → Y. Reason: [answer received]
> - [Task name]: No change — answer confirmed original assumption
> - [Task name]: Hours increased from X → Y. Reason: [answer revealed additional complexity]
