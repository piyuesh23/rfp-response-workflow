# Customer & Site Research — [CLIENT_NAME]

**Date:** [DATE]
**Researcher:** Claude Code (Senior Technical Architect)
**TOR Document(s):** [list source files from tor/]
**Existing Site URL:** [URL or "N/A"]
**Engagement Type:** [New Build / Migration / Redesign / Enhancement]

---

## How This Document Was Produced

This research document combines three sources:
1. **Web research** about the customer organization (public information)
2. **TOR analysis** for project context and business drivers
3. **Existing site audit** (if a public URL was provided or discovered)

All findings should be verified with the customer during the engagement. Web-sourced data is point-in-time and may be outdated.

**Companion CSVs:** Tabular data in this document is also exported as CSV files in `research/csv/` for import into spreadsheets or project management tools.

---

## Part 1: Customer Profile (Web Research)

### 1.1 Organization Overview

| Field | Detail |
|-------|--------|
| Legal Name | [from web research] |
| Industry / Sector | [e.g., Higher Education, Government, Healthcare, Retail] |
| Sub-sector | [e.g., Public University, Regional Health Authority] |
| Headquarters | [city, country] |
| Founded | [year] |
| Organization Size | [employees, revenue if public, or tier: SMB / Mid-market / Enterprise] |
| Geographic Presence | [regions / countries of operation] |
| Public/Private | [publicly traded / private / government / non-profit] |

### 1.2 Digital Presence

| Channel | URL / Handle | Status | Notes |
|---------|-------------|--------|-------|
| Primary Website | [URL] | Active / Redesigning / Decommissioning | |
| Secondary Sites | [URLs] | | [microsites, campaign sites, portals] |
| Mobile App(s) | [App Store / Play Store links] | | |
| LinkedIn | [URL] | | [follower count, activity level] |
| Twitter/X | [URL] | | |
| Facebook | [URL] | | |
| YouTube | [URL] | | |
| Other Social | [URLs] | | |

### 1.3 Business Context

| Area | Finding | Source |
|------|---------|--------|
| Recent News / Press | [key announcements, mergers, launches] | [source URL] |
| Strategic Initiatives | [digital transformation, rebrand, expansion] | [source URL] |
| Regulatory Environment | [compliance requirements: GDPR, HIPAA, WCAG, etc.] | [source URL or inferred] |
| Competitive Landscape | [key competitors, market position] | [source URL] |
| Technology Investments | [known tech partnerships, platform migrations, innovation labs] | [source URL] |

### 1.4 Key Stakeholders (from TOR / Public Sources)

| Name | Role | Relevance to Project | Source |
|------|------|---------------------|--------|
| [name] | [title] | [decision maker / technical lead / content owner] | [TOR / LinkedIn / web] |

---

## Part 2: Project Context (TOR Alignment)

### 2.1 Business Drivers

| Driver | Evidence from TOR | Implications for Estimation |
|--------|------------------|---------------------------|
| [e.g., Rebrand / merger] | [TOR reference] | [impacts design, content migration scope] |
| [e.g., Platform EOL] | [TOR reference] | [hard deadline, migration complexity] |
| [e.g., Performance issues] | [TOR reference] | [performance requirements, benchmarking needed] |
| [e.g., Accessibility compliance] | [TOR reference] | [WCAG level, audit scope] |

### 2.2 Project Scope Alignment

| TOR Stated Scope | Research Finding | Alignment | Risk |
|-----------------|------------------|-----------|------|
| [what TOR says about scope] | [what research reveals about actual needs] | Aligned / Gap / Conflict | [risk description] |

### 2.3 Hidden Scope Indicators

Items not explicitly in the TOR but strongly implied by research:

| # | Hidden Scope Area | Evidence | Likely Effort Impact | Confidence |
|---|------------------|----------|---------------------|------------|
| 1 | [e.g., multilingual support] | [customer operates in 3 countries] | [H/M/L] | [H/M/L] |
| 2 | [e.g., SSO integration] | [customer uses Okta per job listings] | [H/M/L] | [H/M/L] |

---

## Part 3: Existing Site Audit

> **Skip this section if no existing site URL is available.**
> If the TOR doesn't include a URL, attempt to discover it from customer name / web research.

### 3.1 Technical Stack Detection

| Layer | Technology | Version (if detectable) | Detection Method | Confidence |
|-------|-----------|------------------------|-----------------|------------|
| CMS / Backend | [e.g., Drupal 9, WordPress 6.x, Sitecore] | [version] | [HTTP headers / HTML meta / Wappalyzer signatures] | H/M/L |
| Frontend Framework | [e.g., jQuery, React, Vue, vanilla] | [version] | [JS bundle analysis / source inspection] | H/M/L |
| CSS Framework | [e.g., Bootstrap 4, Tailwind, custom] | [version] | [class naming patterns] | H/M/L |
| Server / Runtime | [e.g., Apache, Nginx, Node.js] | [version] | [HTTP headers] | H/M/L |
| Hosting / CDN | [e.g., Acquia, AWS, Cloudflare, Akamai] | | [DNS / headers / IP range] | H/M/L |
| Database | [e.g., MySQL, PostgreSQL — often not detectable] | | [inferred from CMS] | H/M/L |
| PHP Version | [if detectable] | | [HTTP headers / known CMS requirements] | H/M/L |
| SSL Certificate | [issuer, expiry] | | [certificate inspection] | H |

**CSV Export:** `research/csv/tech-stack.csv`

### 3.2 Site Structure & Information Architecture

#### Top-Level Navigation

| Menu Item | URL Path | Content Type | Depth (levels) | Notes |
|-----------|----------|-------------|----------------|-------|
| [e.g., About Us] | /about | Static page | 2 | [sub-pages listed] |
| [e.g., Services] | /services | Listing + detail | 3 | [taxonomy-driven] |
| [e.g., Blog] | /blog | Blog listing | 2 | [paginated, categories] |

**CSV Export:** `research/csv/site-structure.csv`

#### Content Types Identified

| Content Type | URL Pattern | Estimated Count | Template Variations | Notes |
|-------------|------------|-----------------|--------------------:|-------|
| [e.g., Landing Page] | /[slug] | [count] | [variations] | |
| [e.g., Blog Post] | /blog/[slug] | [count] | [1-2] | |
| [e.g., Event] | /events/[slug] | [count] | [1] | |
| [e.g., Staff Profile] | /team/[slug] | [count] | [1] | |
| [e.g., Case Study] | /work/[slug] | [count] | [1-2] | |
| [e.g., FAQ] | /faq | [count] | [accordion] | |
| [e.g., Location] | /locations/[slug] | [count] | [1] | [map integration] |

**CSV Export:** `research/csv/content-types.csv`

### 3.3 Page Volume & Content Scale

| Metric | Value | Method |
|--------|-------|--------|
| Total indexed pages (Google) | [site:domain.com count] | Google search operator |
| Sitemap page count | [count or "no sitemap found"] | /sitemap.xml inspection |
| Estimated unique templates | [count] | Visual inspection |
| Blog / news post count | [count] | Archive / pagination analysis |
| Media library estimate | [rough count] | Sampling / page inspection |
| Languages | [count + list] | URL patterns / hreflang |
| Subdomains | [list] | DNS / web research |

**CSV Export:** `research/csv/content-volume.csv`

### 3.4 Traffic & Audience Estimates

> Sources: SimilarWeb (public tier), BuiltWith, Google Trends, or other publicly available data.

| Metric | Value | Source | Period |
|--------|-------|--------|--------|
| Estimated monthly visits | [range] | [source] | [month/year] |
| Bounce rate (estimate) | [%] | [source] | |
| Avg. visit duration | [time] | [source] | |
| Top traffic sources | [organic / direct / referral / social] | [source] | |
| Top countries | [list] | [source] | |
| Mobile vs. Desktop split | [%] | [source or inferred] | |
| Trend (growing / stable / declining) | [trend] | [source] | |

### 3.5 Performance Baseline

| Metric | Mobile | Desktop | Rating | Notes |
|--------|--------|---------|--------|-------|
| Largest Contentful Paint (LCP) | [sec] | [sec] | Good / Needs Work / Poor | |
| Interaction to Next Paint (INP) | [ms] | [ms] | Good / Needs Work / Poor | |
| Cumulative Layout Shift (CLS) | [score] | [score] | Good / Needs Work / Poor | |
| First Contentful Paint (FCP) | [sec] | [sec] | | |
| Time to First Byte (TTFB) | [sec] | [sec] | | |
| Total Page Weight (homepage) | [MB] | [MB] | | |
| Number of Requests (homepage) | [count] | [count] | | |
| PageSpeed Insights Score | [/100] | [/100] | | |

**Source:** Google PageSpeed Insights / Lighthouse
**CSV Export:** `research/csv/performance-baseline.csv`

### 3.6 SEO Health

| Area | Finding | Impact on Migration | Notes |
|------|---------|-------------------|-------|
| Meta titles | [present / missing / inconsistent] | [redirect mapping, meta migration] | |
| Meta descriptions | [present / missing / inconsistent] | | |
| H1 tags | [proper / missing / multiple per page] | | |
| Open Graph tags | [present / missing] | | |
| Structured data (JSON-LD / microdata) | [types found or "none"] | [need to rebuild / migrate] | |
| Canonical tags | [present / missing / misconfigured] | | |
| Hreflang tags | [present / N/A] | | |
| Sitemap.xml | [present / valid / missing] | | |
| Robots.txt | [present / contents summary] | | |
| URL structure quality | [clean slugs / query params / hashes] | [URL mapping complexity] | |
| 301/302 redirects observed | [count if detectable] | | |
| Broken links (sample) | [count from sample crawl] | | |

**CSV Export:** `research/csv/seo-health.csv`

### 3.7 Third-Party Integrations & Services

| # | Service | Category | Detection Method | Migration Impact | Notes |
|---|---------|----------|-----------------|-----------------|-------|
| 1 | [e.g., Google Analytics 4] | Analytics | [script tag / network request] | Low | |
| 2 | [e.g., Google Tag Manager] | Tag Management | [script tag] | Low | [container ID: GTM-XXXX] |
| 3 | [e.g., HubSpot] | CRM / Marketing | [script / forms] | Medium | [forms, tracking, chat] |
| 4 | [e.g., Salesforce] | CRM | [form submissions / API calls] | High | |
| 5 | [e.g., Algolia] | Search | [JS bundle / API calls] | High | [index migration needed] |
| 6 | [e.g., Stripe] | Payments | [checkout flow] | High | |
| 7 | [e.g., Auth0 / Okta] | Authentication | [login flow / headers] | High | |
| 8 | [e.g., Cloudflare] | CDN / Security | [DNS / headers] | Medium | |
| 9 | [e.g., Hotjar / FullStory] | Session Replay | [script tag] | Low | |
| 10 | [e.g., Cookiebot / OneTrust] | Cookie Consent | [script tag / banner] | Medium | |
| 11 | [e.g., reCAPTCHA] | Spam Protection | [script / form] | Low | |
| 12 | [e.g., YouTube / Vimeo] | Video | [embeds] | Low | |
| 13 | [e.g., Google Maps] | Maps | [embed / API] | Low | [API key migration] |
| 14 | [e.g., Mailchimp / SendGrid] | Email | [forms / inferred] | Medium | |
| 15 | [e.g., Social login providers] | Auth | [login buttons] | Medium | |
| 16 | [e.g., Live chat widget] | Support | [script tag] | Low | |

**CSV Export:** `research/csv/third-party-integrations.csv`

### 3.8 Accessibility Snapshot

| Area | Finding | WCAG Level Concern | Notes |
|------|---------|-------------------|-------|
| Alt text on images | [present / missing / partial] | A | |
| Keyboard navigation | [functional / broken / partial] | A | |
| Color contrast | [pass / fail on sample pages] | AA | |
| ARIA landmarks | [present / missing] | A | |
| Form labels | [present / missing] | A | |
| Skip navigation link | [present / missing] | A | |
| Focus indicators | [visible / hidden] | AA | |
| Heading hierarchy | [proper / skipped levels] | A | |
| Automated scan error count (sample) | [count from axe / WAVE on homepage] | | |

### 3.9 Security Observations

| Area | Finding | Notes |
|------|---------|-------|
| HTTPS enforcement | [yes / no / mixed content] | |
| HSTS header | [present / missing] | |
| X-Frame-Options | [present / missing / value] | |
| Content-Security-Policy | [present / missing / strict?] | |
| X-Content-Type-Options | [present / missing] | |
| Cookie flags (Secure, HttpOnly, SameSite) | [compliant / issues] | |
| Known CMS version vulnerabilities | [yes / no / unknown] | |
| Exposed admin paths | [yes / no] | [e.g., /user/login, /wp-admin] |

### 3.10 Mobile Experience

| Area | Finding | Notes |
|------|---------|-------|
| Responsive design | [yes / no / partially] | |
| Viewport meta tag | [present / correct / missing] | |
| Mobile navigation pattern | [hamburger / tab bar / accordion] | |
| Touch target sizing | [adequate / too small] | |
| Mobile page speed score | [/100] | |
| AMP pages | [yes / no] | |

---

## Part 4: Research-Informed Risk Assessment

### 4.1 Migration Complexity (if applicable)

| Factor | Assessment | Impact on Effort | Notes |
|--------|-----------|-----------------|-------|
| Content volume | [Low / Medium / High / Very High] | [multiplier factor] | [page count, media] |
| Content type complexity | [Low / Medium / High] | | [paragraphs, layouts, references] |
| URL structure change | [None / Minor / Major overhaul] | [redirect mapping effort] | |
| SEO equity preservation | [Low / Medium / High risk] | [redirect planning, meta migration] | |
| Third-party integration count | [count] | [per-integration assessment needed] | |
| Custom functionality | [Low / Medium / High] | [custom modules/features to rebuild] | |
| User data migration | [None / Low / High] | | [accounts, profiles, permissions] |
| Multi-language content | [None / Few / Many languages] | [per-language migration effort] | |

### 4.2 Consolidated Risk Register

| Risk ID | Source | Description | Severity | Likelihood | Impact Area | Mitigation |
|---------|--------|------------|----------|------------|-------------|------------|
| CR-001  | Web Research | [risk from research] | [H/M/L] | [H/M/L] | [estimation area] | [mitigation] |
| CR-002  | Site Audit | [risk from audit] | [H/M/L] | [H/M/L] | [estimation area] | [mitigation] |
| CR-003  | TOR Gap | [risk from TOR alignment] | [H/M/L] | [H/M/L] | [estimation area] | [mitigation] |

---

## Part 5: Research Summary & Estimation Impact

### Key Findings

1. [Most important finding and its estimation impact]
2. [Second finding]
3. [Third finding]

### Estimation Adjustments Recommended

| Area | Standard Estimate | Adjustment | Reason (from research) |
|------|------------------|------------|----------------------|
| Content Migration | [baseline] | [+X% or +Y hrs] | [page volume / complexity from audit] |
| Integration Work | [baseline] | [+X% or +Y hrs] | [third-party count from audit] |
| SEO Migration | [baseline] | [+X% or +Y hrs] | [URL structure / redirect complexity] |
| Performance | [baseline] | [+X% or +Y hrs] | [current baseline vs. targets] |
| Accessibility | [baseline] | [+X% or +Y hrs] | [current compliance level vs. requirements] |

### Questions Informed by Research

| # | Question | Research Evidence | Why It Matters for Estimation |
|---|---------|-------------------|------------------------------|
| 1 | [specific question] | [what research revealed] | [effort impact if answer is X vs Y] |

---

## CSV Export Manifest

All CSV files are in `research/csv/`. Import into any spreadsheet tool for further analysis.

| File | Contents | Rows |
|------|----------|------|
| `tech-stack.csv` | Technology stack detection results | [count] |
| `site-structure.csv` | Top-level navigation and IA mapping | [count] |
| `content-types.csv` | Content type inventory with counts | [count] |
| `content-volume.csv` | Page volume and content scale metrics | [count] |
| `performance-baseline.csv` | Core Web Vitals and performance metrics | [count] |
| `seo-health.csv` | SEO health assessment by area | [count] |
| `third-party-integrations.csv` | All detected third-party services | [count] |
| `hidden-scope.csv` | Research-identified hidden scope items | [count] |
| `risk-register.csv` | Consolidated research risks | [count] |
| `estimation-adjustments.csv` | Recommended effort adjustments from research | [count] |
