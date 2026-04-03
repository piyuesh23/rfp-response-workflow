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
| Conf | Meaning |
|------|---------|
| 1 | Scope is purely speculative |
| 2 | Scope is vague |
| 3 | Scope definition is moderate |
| 4 | Scope could use more detail |
| 5 | High confidence in scope definition |
| 6 | No uncertainty to apply |

---

## Summary

| Tab | Hours | Line Items | Assumptions |
|-----|-------|------------|-------------|
| Backend | [hrs] | [n] | [n] |
| Frontend | [hrs] | [n] | [n] |
| Fixed Cost Items | [hrs] | [n] | [n] |
| AI | [hrs] | [n] | [n] |
| **TOTAL** | **[hrs]** | **[n]** | **[n]** |

---

# Backend Tab

Items in this tab require Project Management oversight and Quality Assurance effort (auto-calculated in the Excel sheet).

## Content Architecture

| Task | Description | Hours | Conf | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [1-6] | [assumptions referencing TOR sections/clauses or customer Q&A — never internal assessment IDs] | [specific technical approach] | [links] |

---

## Integrations

| Task | Description | Hours | Conf | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [1-6] | [assumptions] | [solution] | [links] |

---

## Migrations

| Task | Description | Hours | Conf | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [1-6] | [assumptions] | [solution] | [links] |

---

## Custom Module Development

| Task | Description | Hours | Conf | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [1-6] | [assumptions] | [solution] | [links] |

---

## SEO / Accessibility / Performance

| Task | Description | Hours | Conf | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [1-6] | [assumptions] | [solution] | [links] |

---

## Security

| Task | Description | Hours | Conf | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [1-6] | [assumptions] | [solution] | [links] |

---

# Frontend Tab

Component-level estimates. Each line item is a UI component or template with visual reference links showing what it should look like. This is especially important when designs are not yet available.

Items in this tab require Project Management oversight and Quality Assurance effort (auto-calculated in the Excel sheet).

## Design System / Theme Foundation

| Task | Description | Hours | Conf | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|------|-------------|------------|-----------------|
| Design System Setup | [create new / reuse existing — specify which] | [hrs] | [1-6] | [assumptions about design availability, brand guidelines] | [what's excluded] | [link to design system being reused, or similar reference] |
| Theme Setup | [build tooling, base config, folder structure] | [hrs] | [1-6] | [assumptions] | [exclusions] | [links] |
| Generic Elements / Styleguide | [headings, lists, CTAs, typography, colors] | [hrs] | [1-6] | [assumptions] | [exclusions] | [links] |

---

## Global Components

| Task | Description | Hours | Conf | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|------|-------------|------------|-----------------|
| Header | [describe layout, nav levels, mobile behavior] | [hrs] | [1-6] | [assumptions about nav depth, mega menu, search inclusion] | [exclusions] | [visual reference link — similar site header] |
| Footer | [describe columns, content] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link] |
| Navigation | [primary, breadcrumbs, sidebar] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link] |
| Search | [bar, autocomplete, overlay] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link] |

---

## Content Components

| Task | Description | Hours | Conf | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|------|-------------|------------|-----------------|
| Hero Banner | [image/video, overlay, CTAs] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link — e.g., similar hero on comparable site] |
| Card | [image, title, excerpt, metadata] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link] |
| [component] | [description] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link] |

---

## Form Components

| Task | Description | Hours | Conf | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|------|-------------|------------|-----------------|
| [form component] | [description] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link] |

---

## Page Templates

| Task | Description | Hours | Conf | Assumptions | Exclusions | Reference Links |
|------|-------------|-------|------|-------------|------------|-----------------|
| Homepage | [component assembly, layout] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link — similar homepage] |
| [template] | [description] | [hrs] | [1-6] | [assumptions] | [exclusions] | [visual reference link] |

---

# Fixed Cost Items Tab

Items that do NOT require QA effort or Project Management oversight. These are administrative, operational, or one-time setup tasks.

| Task | Description | Hours | Conf | Assumptions | Reference Links |
|------|-------------|-------|------|-------------|-----------------|
| Discovery & Discussions | [kickoff, requirement deep-dives, architecture review] | [hrs] | [1-6] | [assumptions] | |
| Developer Onboarding | [environment setup, codebase walkthrough, access provisioning] | [hrs] | [1-6] | [assumptions] | |
| Deployment & CI/CD Setup | [pipeline creation, environment provisioning, release process] | [hrs] | [1-6] | [assumptions] | |
| CMS Training | [sessions, recordings, materials] | [hrs] | [1-6] | [assumptions] | |
| User Manual / Documentation | [technical docs, content author guides] | [hrs] | [1-6] | [assumptions] | |
| Technical Documentation | [architecture docs, API docs, runbooks] | [hrs] | [1-6] | [assumptions] | |
| UAT Support | [test environment, bug triage during UAT] | [hrs] | [1-6] | [assumptions] | |
| Warranty / Hypercare | [post-launch support window] | [hrs] | [1-6] | [assumptions] | |
| Environment Setup | [dev, staging, production environments] | [hrs] | [1-6] | [assumptions] | |

---

# AI Tab (if applicable)

AI-powered features and integrations. Include only if the TOR contains AI/ML requirements.

| Task | Description | Hours | Conf | Assumptions | Proposed Solution | Reference Links |
|------|-------------|-------|------|-------------|-------------------|-----------------|
| [task] | [description] | [hrs] | [1-6] | [assumptions] | [solution] | [links] |

---

## Assumption Register

All assumptions that bound scope and define change-request triggers.

| # | Tab | Domain | Assumption | CR Trigger | Effort Impact if Changed |
|---|-----|--------|-----------|------------|--------------------------|
| A-001 | [Backend/Frontend/Fixed/AI] | [domain] | [assumption text] | [what would trigger a CR] | [estimated additional hours] |
| A-002 | ... | ... | ... | ... | ... |

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
- [ ] All effort figures within benchmark ranges
- [ ] All assumptions documented separately
