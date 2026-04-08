# WordPress Effort Ranges — WordPress 6.x Benchmarks

Reference ranges for WordPress-specific estimation. Update with actuals via Phase 5.

---

## Content Architecture

| Task | Effort Range | Notes |
|------|-------------|-------|
| Simple Custom Post Type (ACF/CPT UI) | 4-8 hours | Registration, labels, admin columns, basic meta |
| Complex Custom Post Type (ACF Pro, relationships, conditional logic) | 8-16 hours | Relationship fields, conditional logic, multiple field groups |
| Taxonomy setup (categories, tags, custom) | 2-4 hours each | More if hierarchical with 100+ terms or custom rewrite rules |
| Custom Fields (ACF field groups) | 4-8 hours per group | Field group config, display templates, validation rules |
| Advanced Custom Queries (WP_Query, custom REST endpoints) | 8-16 hours | Complex query args, meta queries, custom REST routes |
| Page Builder configuration (Gutenberg blocks, patterns) | 8-16 hours | Custom block registration, block patterns, template parts |

---

## Plugin Development

| Complexity | Effort Range | Examples |
|-----------|-------------|---------|
| Simple | 8-16 hours | Shortcode, widget, simple filter/action hook, custom admin notice |
| Medium | 16-32 hours | Admin settings page (Settings API), custom admin UI, AJAX handlers |
| Complex | 32-60 hours | Custom DB tables, REST API integration, background processing, licensing |

---

## Plugin Configuration (Contrib Equivalent)

| Plugin | Typical Effort | Notes |
|--------|---------------|-------|
| WooCommerce basic setup | 16-24 hours | Products, payments, shipping, tax, email templates |
| WooCommerce custom extensions | 24-48 hours | Custom gateways, product types, checkout fields, subscription logic |
| ACF Pro advanced configuration | 8-16 hours | Flexible content, gallery fields, options pages, Gutenberg integration |
| Yoast SEO / Rank Math configuration | 4-8 hours | Schema setup, sitemap config, social previews, redirects |
| Gravity Forms / WPForms setup | 4-8 hours per form | Per complex form with conditional logic, notifications, and confirmations |
| WPML / Polylang multilingual setup | 16-32 hours | Language switcher, string translation, WooCommerce multilingual |
| WP Rocket / caching configuration | 4-8 hours | Cache rules, CDN integration, file optimization, exclusions |
| Wordfence / security hardening | 8-12 hours | Firewall rules, malware scan schedule, login security, alerts |
| SearchWP / Relevanssi custom search | 8-16 hours | Index configuration, custom weights, faceted filtering, AJAX search |

---

## Theme Development

| Approach | Effort Range | Notes |
|----------|-------------|-------|
| Child theme (existing parent) | 8-16 hours | Style overrides, template overrides, additional hooks |
| Custom theme (starter theme like Sage/Underscores) | 24-40 hours | Full classic theme build from starter, no block/FSE overhead |
| Block theme (Full Site Editing) | 32-48 hours | theme.json, templates, template parts, block patterns, style variations |
| Classic theme to block theme conversion | 40-60 hours | Template re-implementation, global styles migration, block pattern library |

---

## Migration

| Source | Effort Range | Notes |
|--------|-------------|-------|
| WordPress version upgrade (major) | 8-16 hours | Plugin compatibility audit, PHP version check, staging test cycle |
| Drupal to WordPress | 40-80 hours | Custom migration scripts, URL mapping, taxonomy mapping, media re-import |
| Wix / Squarespace to WordPress | 24-40 hours | Export-limited, manual content reconstruction likely required |
| Static HTML to WordPress | 16-32 hours | Content parsing, image harvesting, template mapping |
| Legacy CMS to WordPress | 40-80 hours | Custom source adapter, data mapping, URL redirect strategy |
| Content migration (per 1000 posts) | 8-16 hours | Includes post, meta, taxonomy terms, and featured image re-association |

**Notes:** WXR importer covers basic posts/pages; custom post types, ACF meta, and media attachments require custom WP-CLI scripts or migration plugins. Add 20-30% if redirects must be preserved via `.htaccess` or a redirect plugin.

---

## Headless / Decoupled (WordPress + Next.js)

| Item | Effort Range | Notes |
|------|-------------|-------|
| WPGraphQL setup + schema customization | 16-24 hours | Plugin install, CPT/ACF exposure, query depth config, persisted queries |
| REST API custom endpoints | 8-16 hours per endpoint group | Auth, schema validation, pagination, caching headers |
| Next.js frontend scaffold (App Router) | 16-24 hours | Project setup, routing, WP data fetching layer, env config |
| Preview mode (Faust.js / custom) | 12-20 hours | Draft preview tokens, secret routes, on-demand revalidation |
| Authentication (JWT / NextAuth) | 16-24 hours | WP JWT plugin, NextAuth provider, session handling, protected routes |
| ISR / SSG configuration | 8-12 hours | revalidate strategy per content type, fallback handling |
| Image optimization (next/image + WP media) | 4-8 hours | Domain allow-list, loader config, srcset mapping from WP |

**Frontend overhead multiplier:** Add 30-50% on top of standard frontend estimates for headless overhead (data fetching, hydration, preview wiring).

---

## DevOps

| Task | Effort Range | Notes |
|------|-------------|-------|
| Environment setup (Local/Docker/Valet) | 4-8 hours | Local dev tooling, DB import, wp-config wiring |
| wp-config environment management | 4-6 hours | Constants per environment, `.env` integration (Bedrock/Trellis pattern) |
| CI/CD pipeline (GitHub Actions / Bitbucket) | 8-16 hours | Lint, test, deploy-to-staging, deploy-to-prod with approvals |
| Hosting setup — managed (WP Engine / Kinsta) | 4-8 hours | DNS, SSL, PHP version, cache configuration, backup schedule |
| Hosting setup — self-managed (VPS / cloud) | 8-16 hours | Nginx/Apache, PHP-FPM, MySQL, SSL, swap, fail2ban, monitoring |
| Performance optimization (caching, CDN) | 8-16 hours | Object cache (Redis), page cache, CDN rules, DB query optimization |
| Security hardening (headers, firewall, 2FA) | 8-12 hours | CSP/HSTS headers, WAF rules, login protection, file permission audit |
| Backup & disaster recovery | 4-8 hours | Automated off-site backup, restoration runbook, retention policy |
| Multisite setup | 8-16 hours | Network activation, domain mapping, shared vs. per-site plugins |

---

## Integration Tiers

Classify integrations by complexity tier to standardize estimation:

| Tier | Description | Base Effort | Default Conf | Examples |
|------|-------------|-------------|-------------|----------|
| T1 — Simple | One-way REST push/pull, well-documented API, no auth complexity | 8-16 hours | 5 | Analytics embed, RSS feed, simple webhook, social media embed, Google Maps iframe |
| T2 — Standard | Auth required (OAuth/API key), field mapping, error handling, retry logic | 16-32 hours | 4-5 | CRM sync (HubSpot, Salesforce basic), payment gateway, email service (Mailchimp/SendGrid), booking system |
| T3 — Complex | Bidirectional sync, real-time/webhooks, poorly documented API, multi-step auth, data transformation | 32-60 hours | 4 | ERP integration (SAP/NetSuite), SSO (SAML/LDAP), real-time inventory sync, custom middleware layer |

**Tier selection rules:**
- If API documentation is incomplete or unknown → bump up one tier
- If bidirectional data flow → minimum T2
- If real-time or webhook-based → minimum T3
- If integration requires custom middleware/proxy → add 16-24h on top of tier base

---

## Always-Include Tasks (Backend)

These tasks MUST appear in every WordPress backend estimate. If any is missing, flag as a validation error.

| Task | Effort Range | Notes |
|------|-------------|-------|
| Discovery & Requirements Analysis | 16-24 hours | Kickoff, TOR deep-dive, plugin selection, architecture decisions |
| Environment Setup (Local/Docker/Valet) | 4-8 hours | Local dev environment + staging environment parity |
| WordPress Installation & Base Configuration | 4-8 hours | Site install, permalink structure, admin settings, timezone |
| Plugin Management & Configuration | 8-16 hours | Core plugin selection, license activation, baseline configuration |
| Roles & Capabilities Setup | 4-8 hours | Role definitions, custom capabilities, content access patterns |
| Media Library Configuration | 4-8 hours | Image sizes, upload limits, storage (local vs. S3/offload), EXIF stripping |
| Deployment Pipeline | 8-16 hours | Deploy scripts, WP-CLI sync commands, environment promotion workflow |
| QA, Bug Fixes & Stabilisation | 10-15% of total | End-of-sprint stabilisation, cross-browser/device testing, regression |

---

## Notes

- All ranges assume WordPress 6.4+ with PHP 8.2+. Older PHP versions or legacy plugin dependencies may require additional compatibility effort.
- Multisite: add 20-30% per additional site for network configuration, domain mapping, and shared plugin management complexity.
- Multilingual: add 40-60% overall for WPML/Polylang setup, string translation, WooCommerce multilingual, and URL structure decisions.
- Gutenberg / FSE: if the project mandates Full Site Editing, add 20-30% to theme estimates for theme.json tuning, block locking, and pattern library work.
- WooCommerce: treat as a platform-within-a-platform; always scope payments, tax, shipping, email, and order management separately rather than bundling into a single line item.
