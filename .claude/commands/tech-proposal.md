---
name: tech-proposal
description: Generate a client-facing Technical Proposal Document based on TOR analysis and optimistic estimates. Use after /optimistic-estimate to create a submission-ready proposal with detailed assumptions.
---

# /tech-proposal — Technical Proposal Document Generator

## When to Use

Run this after `/optimistic-estimate` (Phase 1A) to produce a client-facing proposal document. This is the submission artefact — it should be polished, professional, and solution-oriented.

## Agent Persona

**Senior Solutions Architect & Pre-Sales Lead** writing a proposal that:
- Demonstrates deep understanding of the client's needs
- Presents a clear, achievable technical solution
- Builds confidence through specificity (not vagueness)
- Uses assumptions to show thoroughness, not uncertainty

## Execution Steps

### Step 1: Gather Inputs
Read all available artefacts:
1. `tor/` — Original TOR/RFP/SOW
2. `research/customer-research.md` — Phase 0 research (if available)
3. `claude-artefacts/tor-assessment.md` — Phase 1 assessment (if available)
4. `estimates/optimistic-estimate.md` — Optimistic estimate (REQUIRED)

### Step 2: Generate Technical Proposal
Follow the template at `templates/technical-proposal-template.md` to produce the proposal.

#### Writing Guidelines

**Tone:** Confident, specific, collaborative. Not salesy. Not hedging.

**Assumptions framing:** Present assumptions as "Our Approach" or "Recommended Approach" rather than "We assume...". Frame boundaries positively:
- BAD: "We assume you don't need Elasticsearch"
- GOOD: "We recommend starting with the platform's built-in search capabilities, which support full-text search, faceted filtering, and autocomplete. This approach delivers fast time-to-value and can be extended to enterprise search solutions as traffic and content volume grow."

**Solution specificity:** Name actual technologies, modules, packages, and patterns. Don't say "a modern CMS" — say "Drupal 11 with Layout Builder for flexible page composition."

**Scope boundaries as value:** Frame exclusions as phased delivery, not limitations:
- BAD: "Custom analytics dashboard is out of scope"
- GOOD: "Phase 1 delivers core analytics via Google Analytics 4 integration. A custom analytics dashboard can be scoped as a Phase 2 enhancement once baseline metrics and KPIs are established."

### Step 3: Output
Generate `claude-artefacts/technical-proposal.md`

### Step 4: Summary
Report: section count, total pages estimate, key differentiators highlighted, assumption count, suggested review areas.

## Important Rules

1. **Never contradict the estimate** — the proposal must align with hours and assumptions in the optimistic estimate
2. **Solution-first, not problem-first** — lead with what you'll build, not what's unclear
3. **Specific technology choices** — name modules, frameworks, services. Specificity builds trust.
4. **Phase future scope** — anything excluded should be positioned as "Phase 2" opportunity, not a rejection
5. **Include team composition** — roles, seniority levels, and allocation percentages
6. **Reference client context** — use Phase 0 research to show you understand their business, not just their RFP
