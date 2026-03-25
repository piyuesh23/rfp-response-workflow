# Drupal Effort Ranges — Drupal 10/11 Benchmarks

Reference ranges for Drupal-specific estimation. Update with actuals via Phase 5.

---

## Content Architecture

| Task | Effort Range | Notes |
|------|-------------|-------|
| Content type (simple, < 10 fields) | 4-8 hours | Including form display, view modes |
| Content type (complex, 10-25 fields) | 8-20 hours | Paragraphs/Layout Builder, multiple view modes |
| Content type (enterprise, 25+ fields, workflows) | 20-40 hours | Editorial workflows, revisions, access control |
| Taxonomy vocabulary + terms | 2-4 hours each | More if hierarchical with 100+ terms |
| Views (simple listing) | 2-4 hours | Basic content listing with filters |
| Views (complex, exposed filters, AJAX) | 8-16 hours | Faceted search, contextual filters, REST export |
| Media types configuration | 4-8 hours per type | Image, video, document, remote video |

---

## Custom Module Development

| Complexity | Effort Range | Examples |
|-----------|-------------|---------|
| Simple | 8-24 hours | Custom block plugin, simple form alter, token provider |
| Medium | 24-60 hours | Custom entity type, queue worker, event subscriber with business logic |
| Complex | 60-160 hours | Custom migration source plugin, complex access control, API integration service |

---

## Contrib Module Configuration

| Module | Typical Effort | Notes |
|--------|---------------|-------|
| Paragraphs / Layout Builder | 16-40 hours | Depends on number of component types |
| Search API + Solr/Elasticsearch | 40-80 hours | Including facets, autocomplete, custom processors |
| Webform | 8-24 hours | Per complex form with conditional logic |
| Commerce | 80-200 hours | Depends on product types, payment gateways, tax rules |
| Group / Organic Groups | 40-80 hours | Multi-group content access patterns |
| JSON:API / GraphQL (decoupled) | 24-60 hours | Schema customization, auth, includes/fields |

---

## Theme Development

| Approach | Effort Range | Notes |
|----------|-------------|-------|
| Admin theme customization | 8-16 hours | Gin/Claro tweaks |
| Sub-theme (Starter kit, e.g., Olivero) | 40-80 hours | Basic frontend implementation |
| Custom theme (component-based) | 80-200 hours | Full Storybook/Pattern Lab integration |
| Design system implementation | 120-300 hours | Shared component library across projects |

---

## Migration

| Source | Effort Multiplier | Notes |
|--------|-------------------|-------|
| Drupal 7 → Drupal 10/11 | 1x (baseline) | Core migration framework, well-supported path |
| WordPress → Drupal | 1.3-1.5x | Custom migration plugins, URL mapping |
| Static HTML → Drupal | 1.5-2x | Content parsing, no structured source |
| Custom CMS / Database → Drupal | 1.5-2.5x | Custom source plugins, data mapping |
| Sitecore / AEM → Drupal | 2-3x | Complex content models, workflow mapping |

**Base effort per content type migration:** 16-40 hours (source plugin + process + destination + QA)

---

## Decoupled / Headless

| Item | Effort Overhead | Notes |
|------|----------------|-------|
| API design + JSON:API config | 24-40 hours | Resource configuration, includes, field aliasing |
| GraphQL schema + resolvers | 40-80 hours | If using GraphQL instead of JSON:API |
| Preview mode (draft content) | 16-40 hours | Depends on frontend framework |
| Authentication for API consumers | 16-40 hours | OAuth2, JWT, Simple OAuth module |
| Frontend overhead multiplier | +30-50% | On top of standard frontend estimates |

---

## DevOps

| Task | Effort Range | Notes |
|------|-------------|-------|
| Config management (CMI) setup | 8-16 hours | Config split, environment overrides |
| CI/CD pipeline | 24-60 hours | Linting, tests, deploy scripts, environments |
| Hosting setup (Acquia/Pantheon/Platform.sh) | 16-40 hours | Platform-specific configuration |
| Hosting setup (custom/AWS/GCP) | 40-80 hours | Docker, orchestration, CDN, SSL |
| Performance tuning | 16-40 hours | Caching layers, CDN, database optimization |
| Security hardening | 8-24 hours | CSP headers, permissions audit, update policy |

---

## Notes

- All ranges assume Drupal 10.3+ / Drupal 11. Older versions may need additional upgrade effort.
- Multisite: add 20-30% per additional site for shared config management and deployment complexity.
- Multilingual: add 40-60% overall for translation workflows, content translation, interface translation.
