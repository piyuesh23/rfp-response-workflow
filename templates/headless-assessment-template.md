# Headless Architecture Assessment — [CLIENT_NAME]

**Date:** [DATE]
**Analyst:** Claude Code (Senior Drupal + Next.js Architect)
**TOR Document(s):** [list source files from tor/]
**Customer Research:** [link to research/customer-research.md or "Phase 0 not yet completed"]
**Engagement Type:** Headless / Decoupled (Drupal Backend + Next.js Frontend)

---

## Executive Summary

[2-3 paragraphs: headless readiness assessment, architectural complexity rating, key integration risks, recommendation on approach (fully decoupled vs. progressively decoupled)]

**Architecture Complexity:** [Low / Medium / High / Very High]
**Headless Readiness:** [Ready / Needs Refinement / Significant Gaps]

---

## Architecture Decision Record

### Decoupling Strategy

| Decision Area | Options | Recommendation | Rationale |
|--------------|---------|---------------|-----------|
| Decoupling Level | Fully Decoupled / Progressively Decoupled / Hybrid | [recommendation] | [rationale] |
| API Protocol | JSON:API / GraphQL (graphql_compose) / REST (custom) / Mixed | [recommendation] | [rationale] |
| Rendering Strategy | SSG / SSR / ISR / CSR / Mixed | [recommendation] | [rationale] |
| Hosting Topology | Same Server / Separate Servers / Edge (Vercel/Netlify) + Drupal Cloud | [recommendation] | [rationale] |

---

## Headless Domain Assessment

### 1. Content Modeling & API Layer

| Req ID | Requirement | Clarity | Headless Impact | Notes |
|--------|------------|---------|-----------------|-------|
| H-001  | [requirement] | [rating] | [Low/Med/High] | [notes] |

**Key Questions:**
- Are content types designed for API consumption (flat vs. nested entity references)?
- Are there paragraph/layout builder requirements that need frontend component mapping?
- Is there a clear content type to Next.js route/component mapping?
- Are entity references and media fields structured for efficient API querying?
- Does the content model require Drupal-side computed fields or virtual properties?

---

### 2. API Design & Data Fetching

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| API protocol selection (JSON:API / GraphQL) | Yes / No / Implicit | [rating] | [H/M/L] | |
| Custom API endpoints beyond CRUD | Yes / No | [rating] | [H/M/L] | |
| API pagination strategy | Yes / No | [rating] | [H/M/L] | |
| API filtering / sorting requirements | Yes / No | [rating] | [H/M/L] | |
| Response shaping / sparse fieldsets | Yes / No | [rating] | [H/M/L] | |
| API versioning strategy | Yes / No | [rating] | [H/M/L] | |
| Rate limiting / throttling | Yes / No | [rating] | [H/M/L] | |

---

### 3. Authentication & Authorization

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Auth mechanism (OAuth2 / JWT / Session / SSO) | Yes / No | [rating] | [H/M/L] | |
| User roles synced across Drupal ↔ Next.js | Yes / No | [rating] | [H/M/L] | |
| Protected content / gated pages | Yes / No | [rating] | [H/M/L] | |
| Token refresh / session management | Yes / No | [rating] | [H/M/L] | |
| SSO / SAML / OIDC integration | Yes / No | [rating] | [H/M/L] | |
| Middleware-level auth in Next.js | Yes / No | [rating] | [H/M/L] | |

---

### 4. Preview & Editorial Experience

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Live/real-time content preview | Yes / No | [rating] | [H/M/L] | |
| Draft/revision preview workflow | Yes / No | [rating] | [H/M/L] | |
| Preview across content types | Yes / No | [rating] | [H/M/L] | |
| Editorial toolbar / contextual editing | Yes / No | [rating] | [H/M/L] | |
| Preview environment setup (draft mode / preview API routes) | Yes / No | [rating] | [H/M/L] | |
| Multi-language preview | Yes / No | [rating] | [H/M/L] | |
| Layout builder / paragraphs preview fidelity | Yes / No | [rating] | [H/M/L] | |

---

### 5. Routing & Navigation

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| URL alias / path auto sync strategy | Yes / No | [rating] | [H/M/L] | |
| Dynamic routing (catch-all routes) | Yes / No | [rating] | [H/M/L] | |
| Drupal menu → Next.js navigation sync | Yes / No | [rating] | [H/M/L] | |
| Breadcrumb generation | Yes / No | [rating] | [H/M/L] | |
| Redirect handling (Drupal redirects → Next.js) | Yes / No | [rating] | [H/M/L] | |
| Multi-language routing (i18n prefixes) | Yes / No | [rating] | [H/M/L] | |
| Pagination routes | Yes / No | [rating] | [H/M/L] | |

---

### 6. Search

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Search provider (Drupal Search API / Solr / Elasticsearch / Algolia / Typesense) | Yes / No | [rating] | [H/M/L] | |
| Faceted search requirements | Yes / No | [rating] | [H/M/L] | |
| Search API exposed to Next.js (direct vs. proxy) | Yes / No | [rating] | [H/M/L] | |
| Autocomplete / typeahead | Yes / No | [rating] | [H/M/L] | |
| Search indexing strategy (Drupal-side vs. external) | Yes / No | [rating] | [H/M/L] | |

---

### 7. Media & Asset Handling

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Image optimization strategy (Drupal image styles vs. Next.js Image / CDN) | Yes / No | [rating] | [H/M/L] | |
| Media CDN / asset delivery | Yes / No | [rating] | [H/M/L] | |
| File upload from Next.js → Drupal | Yes / No | [rating] | [H/M/L] | |
| Responsive image handling (srcset generation source) | Yes / No | [rating] | [H/M/L] | |
| Video / embedded media handling | Yes / No | [rating] | [H/M/L] | |
| SVG / icon handling | Yes / No | [rating] | [H/M/L] | |

---

### 8. Multilingual / Internationalization

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Number of languages | Yes / No | [rating] | [H/M/L] | |
| Translation workflow (Drupal → Next.js sync) | Yes / No | [rating] | [H/M/L] | |
| UI string translation (Next.js i18n vs. Drupal-sourced) | Yes / No | [rating] | [H/M/L] | |
| Language negotiation strategy | Yes / No | [rating] | [H/M/L] | |
| RTL support | Yes / No | [rating] | [H/M/L] | |
| Per-language URL structure | Yes / No | [rating] | [H/M/L] | |

---

### 9. Forms & User Interactions

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Webforms / contact forms (Drupal Webform → Next.js) | Yes / No | [rating] | [H/M/L] | |
| Form submission API (custom REST / JSON:API) | Yes / No | [rating] | [H/M/L] | |
| Client-side validation + server-side validation | Yes / No | [rating] | [H/M/L] | |
| CAPTCHA / spam protection (reCAPTCHA integration) | Yes / No | [rating] | [H/M/L] | |
| File uploads via forms | Yes / No | [rating] | [H/M/L] | |
| Multi-step forms | Yes / No | [rating] | [H/M/L] | |
| User-generated content (comments, reviews) | Yes / No | [rating] | [H/M/L] | |

---

### 10. Caching & Performance

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| ISR / on-demand revalidation strategy | Yes / No | [rating] | [H/M/L] | |
| Cache invalidation (Drupal → Next.js cache purge) | Yes / No | [rating] | [H/M/L] | |
| CDN layer (Cloudflare / Fastly / Vercel Edge) | Yes / No | [rating] | [H/M/L] | |
| Drupal cache tags → frontend invalidation mapping | Yes / No | [rating] | [H/M/L] | |
| Static generation page count / build time constraints | Yes / No | [rating] | [H/M/L] | |
| API response caching (Drupal-side: page cache / Dynamic Page Cache / CDN) | Yes / No | [rating] | [H/M/L] | |
| Core Web Vitals targets | Yes / No | [rating] | [H/M/L] | |

---

### 11. DevOps & Deployment

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Separate deployment pipelines (Drupal + Next.js) | Yes / No | [rating] | [H/M/L] | |
| Environment parity (dev/staging/prod for both) | Yes / No | [rating] | [H/M/L] | |
| Drupal hosting (Acquia / Pantheon / Platform.sh / self-hosted) | Yes / No | [rating] | [H/M/L] | |
| Next.js hosting (Vercel / self-hosted Node / containerized) | Yes / No | [rating] | [H/M/L] | |
| CORS configuration | Yes / No | [rating] | [H/M/L] | |
| Environment variable management across both systems | Yes / No | [rating] | [H/M/L] | |
| Monorepo vs. separate repos | Yes / No | [rating] | [H/M/L] | |
| CI/CD for both applications | Yes / No | [rating] | [H/M/L] | |
| Health check / uptime monitoring (both systems) | Yes / No | [rating] | [H/M/L] | |

---

### 12. SEO in Decoupled Architecture

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| Meta tags sourced from Drupal (Metatag module → Next.js Head) | Yes / No | [rating] | [H/M/L] | |
| Sitemap generation (Drupal-side / Next.js-side / hybrid) | Yes / No | [rating] | [H/M/L] | |
| Structured data / JSON-LD (source of truth) | Yes / No | [rating] | [H/M/L] | |
| Open Graph / social sharing metadata | Yes / No | [rating] | [H/M/L] | |
| Canonical URL management | Yes / No | [rating] | [H/M/L] | |
| robots.txt management | Yes / No | [rating] | [H/M/L] | |
| SSR for SEO-critical pages | Yes / No | [rating] | [H/M/L] | |

---

### 13. Security

| Area | Requirement Present? | Clarity | Effort Impact | Notes |
|------|---------------------|---------|---------------|-------|
| CORS policy (Drupal → Next.js allowed origins) | Yes / No | [rating] | [H/M/L] | |
| API authentication for public vs. authenticated endpoints | Yes / No | [rating] | [H/M/L] | |
| CSP headers (Content Security Policy) | Yes / No | [rating] | [H/M/L] | |
| Rate limiting on API endpoints | Yes / No | [rating] | [H/M/L] | |
| Secrets management across both systems | Yes / No | [rating] | [H/M/L] | |
| HTTPS enforcement / TLS between Drupal ↔ Next.js | Yes / No | [rating] | [H/M/L] | |
| Input sanitization (both ends) | Yes / No | [rating] | [H/M/L] | |

---

## Headless-Specific Estimation Checklist

Categories commonly missed in headless project estimates:

| Category | Present in Estimate? | Suggested Range | Notes |
|----------|---------------------|-----------------|-------|
| API layer setup & configuration (JSON:API / GraphQL) | Yes / No | | |
| Content type → component mapping | Yes / No | | |
| Preview mode implementation | Yes / No | | |
| Cache invalidation pipeline (Drupal → Next.js) | Yes / No | | |
| Authentication bridge (Drupal ↔ Next.js) | Yes / No | | |
| Drupal menu / navigation API sync | Yes / No | | |
| Redirect sync (Drupal → Next.js middleware) | Yes / No | | |
| Webform / form API integration | Yes / No | | |
| Search integration layer | Yes / No | | |
| Media / image optimization pipeline | Yes / No | | |
| SEO metadata API integration | Yes / No | | |
| Multilingual routing & content sync | Yes / No | | |
| CORS & security hardening | Yes / No | | |
| Dual deployment pipeline setup | Yes / No | | |
| Dual environment provisioning (Drupal + Next.js) | Yes / No | | |
| Next.js component library / design system | Yes / No | | |
| API error handling & fallback UI | Yes / No | | |
| E2E testing across both systems | Yes / No | | |
| Performance testing (API + frontend) | Yes / No | | |
| Editorial training (decoupled workflow changes) | Yes / No | | |

---

## Ecosystem & Module Assessment

### Drupal Modules (Headless-Critical)

| Module | Required? | Purpose | Maturity | Notes |
|--------|----------|---------|----------|-------|
| JSON:API (core) | Yes / No | Content API | Core/Stable | |
| JSON:API Extras | Yes / No | API customization | Contrib | |
| GraphQL Compose | Yes / No | GraphQL API | Contrib | |
| Next.js module (next) | Yes / No | Preview, revalidation, sites | Contrib | |
| Simple OAuth | Yes / No | OAuth2 authentication | Contrib | |
| Consumers | Yes / No | API consumer management | Contrib | |
| Subrequests | Yes / No | Batch API requests | Contrib | |
| Decoupled Router | Yes / No | Route resolution API | Contrib | |
| Metatag | Yes / No | SEO metadata API | Contrib | |
| Redirect | Yes / No | Redirect management | Contrib | |
| Simple Sitemap | Yes / No | Sitemap generation | Contrib | |

### Next.js Packages (Headless-Critical)

| Package | Required? | Purpose | Notes |
|---------|----------|---------|-------|
| next-drupal | Yes / No | Drupal integration SDK | |
| next/image | Yes / No | Image optimization | |
| next-intl / next-i18next | Yes / No | Internationalization | |
| next-auth | Yes / No | Authentication | |
| @tanstack/react-query / SWR | Yes / No | Data fetching / caching | |
| react-hook-form / formik | Yes / No | Form handling | |

---

## Cross-System Integration Risks

> **If Phase 0 research is available**, import third-party integrations from `research/csv/third-party-integrations.csv` and assess each for headless compatibility. Flag any integration that requires Drupal-side rendering (e.g., embedded widgets) as a decoupling risk.

| Risk ID | Systems Involved | Description | Severity | Likelihood | Mitigation |
|---------|-----------------|------------|----------|------------|------------|
| HI-001  | Drupal ↔ Next.js | [risk description] | [H/M/L] | [H/M/L] | [mitigation] |

**Common Headless Risks to Evaluate:**
1. API contract drift between Drupal content model changes and Next.js expectations
2. Preview mode complexity with paragraphs/layout builder
3. Cache invalidation reliability (stale content after Drupal edits)
4. Build time growth as content volume scales (if using SSG)
5. Editorial experience degradation vs. traditional Drupal
6. Dual-system debugging complexity increasing support effort
7. Version coupling between Drupal and Next.js releases

---

## Recommendations

### Architecture Recommendations
1. [recommendations on decoupling approach, API protocol, rendering strategy]

### Estimation Adjustments
1. [specific areas where effort needs to increase/decrease for headless approach]

### Risk Mitigations
1. [prioritized actions to reduce headless-specific risks]
