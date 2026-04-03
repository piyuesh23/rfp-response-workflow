# Frontend Effort Ranges — Component-Level Benchmarks

Reference ranges for frontend/theming estimation at the component level. These apply whether the frontend is Twig-based (Drupal theme), decoupled (Next.js/React), or any other framework. Update with actuals via Phase 5.

---

## Design System / Theme Foundation

| Task | Effort Range | Notes |
|------|-------------|-------|
| Theme setup (from scratch) | 16-40 hours | Build tooling (Gulp/Webpack/Vite), base config, folder structure |
| Theme setup (existing design system) | 8-16 hours | Integrating provided design system tokens/variables |
| Design system creation | 40-80 hours | Tokens, typography scale, color system, spacing, grid, breakpoints |
| Design system integration (reuse existing) | 16-32 hours | Mapping existing design system to project components |
| Generic elements / styleguide | 4-8 hours | Headings H1-H6, paragraphs, lists, CTAs, links, colors, fonts |
| Grid settings & layout system | 4-8 hours | Column grid, container widths, responsive breakpoints |
| Image styles & responsive images | 8-24 hours | Art direction, focal point, image styles (12-15 typical) |
| Animation & transitions (base) | 4-8 hours | Micro-interactions, hover states, page transitions |
| Browser testing & cross-browser fixes | 8-16 hours | Chrome, Safari, Firefox, Edge (current - 1) |
| Accessibility (WCAG AA compliance) | 8-24 hours | Keyboard nav, ARIA, color contrast, screen reader testing |
| RTL / LTR support | 8-16 hours | Bidirectional text, mirrored layouts |

---

## Global Components

| Component | Effort Range | Notes |
|-----------|-------------|-------|
| Header (simple — logo, nav, CTA) | 8-16 hours | Responsive, sticky/fixed behavior, mobile hamburger |
| Header (complex — mega menu, search, multi-level) | 16-32 hours | Dropdown panels, search overlay, multi-column menus |
| Footer (standard) | 4-8 hours | Logo, links, social icons, copyright |
| Footer (complex — multi-column, newsletter, sitemap) | 8-16 hours | Newsletter signup, multi-column link groups, legal links |
| Navigation (primary) | 8-16 hours | Multi-level dropdown, mobile drawer, active states |
| Navigation (breadcrumb) | 2-4 hours | Schema markup, responsive truncation |
| Navigation (sidebar/secondary) | 4-8 hours | Collapsible, active trail highlighting |
| Search bar (basic) | 4-8 hours | Input, submit, clear, mobile responsive |
| Search bar (with autocomplete/suggestions) | 8-16 hours | Dropdown suggestions, keyboard navigation, debounce |
| Skip navigation / accessibility nav | 2-4 hours | Skip links, focus management |

---

## Content Components

| Component | Effort Range | Notes |
|-----------|-------------|-------|
| Hero banner (simple — image, title, CTA) | 4-8 hours | Responsive image, overlay text, single CTA |
| Hero banner (complex — video, carousel, animated) | 12-24 hours | Video background, slide transitions, multiple CTAs |
| Card (basic — image, title, excerpt, link) | 4-8 hours | Responsive, hover states, image aspect ratio |
| Card (complex — tags, date, author, multiple CTAs) | 8-12 hours | Metadata, badge overlays, multi-action |
| Card grid / listing layout | 4-8 hours | Responsive grid, load more / pagination |
| Carousel / slider | 8-16 hours | Touch/swipe, dots/arrows, autoplay, a11y |
| Accordion / collapsible | 4-8 hours | Expand/collapse, animation, multi-open vs single |
| Tabs | 4-8 hours | Responsive (tabs → accordion on mobile), keyboard nav |
| Modal / dialog | 4-8 hours | Focus trap, backdrop, close on escape, a11y |
| Table (responsive) | 4-8 hours | Horizontal scroll, stacked on mobile, sortable headers |
| CTA banner / callout | 4-6 hours | Background color/image, text, button(s) |
| Testimonial / quote block | 4-6 hours | Attribution, avatar, quote styling |
| Statistics / counter block | 4-8 hours | Animated counters, grid layout |
| Timeline | 8-16 hours | Vertical/horizontal, responsive, milestone markers |
| Map embed (Google/Leaflet) | 4-8 hours | Responsive iframe or interactive map |
| Social media feed embed | 4-8 hours | Twitter/Instagram/LinkedIn embed, responsive |
| Video embed (YouTube/Vimeo) | 4-6 hours | Responsive 16:9, lazy load, thumbnail fallback |
| Image gallery / lightbox | 8-16 hours | Grid layout, lightbox viewer, touch gestures |
| FAQ section | 4-8 hours | Accordion-based, schema markup |

---

## Form Components

| Component | Effort Range | Notes |
|-----------|-------------|-------|
| Contact form (basic) | 4-8 hours | Name, email, message, validation, submit |
| Multi-step form | 12-24 hours | Step indicator, validation per step, summary |
| Newsletter signup | 2-4 hours | Email input, submit, success/error states |
| Search filters / faceted search UI | 8-16 hours | Checkboxes, range sliders, active filter tags, clear all |
| File upload component | 4-8 hours | Drag & drop, progress bar, file type validation |
| Date picker | 4-8 hours | Calendar widget, range selection, a11y |

---

## Page Templates

| Template | Effort Range | Notes |
|----------|-------------|-------|
| Homepage | 16-32 hours | Assembly of multiple components, unique layout |
| Landing page (flexible/builder) | 12-24 hours | Component-based assembly, layout variations |
| Article / blog detail | 8-16 hours | Long-form content, sidebar, related articles |
| Listing page (archive/index) | 8-16 hours | Filters, pagination, card grid |
| Detail page (generic) | 8-12 hours | Content region, sidebar, metadata |
| Search results page | 8-16 hours | Result cards, facets, pagination, empty state |
| Error pages (404, 500) | 4-6 hours | Branded, helpful navigation |
| User dashboard / profile | 12-24 hours | Tabs, data tables, action buttons |

---

## Decoupled / Headless Frontend Overhead

| Item | Effort Overhead | Notes |
|------|----------------|-------|
| SSR/SSG setup (Next.js/Nuxt) | 16-32 hours | Routing, data fetching, build config |
| API integration layer | 16-40 hours | REST/GraphQL client, caching, error handling |
| Preview mode (draft content) | 12-24 hours | Authenticated preview, draft rendering |
| Auth flow (frontend) | 8-16 hours | Login/logout, token management, protected routes |
| Component overhead multiplier | +20-40% | On top of Twig-based estimates for same components |

---

## Notes

- All component estimates assume **designs are provided** (Figma/Sketch/XD). If no designs exist, add design system creation effort.
- If designs will be done by another agency or later: estimate assumes visual reference links (similar sites/components) serve as the design spec. Include assumptions about what the component should look like.
- Estimates cover: HTML/CSS/JS implementation, responsive behavior (mobile/tablet/desktop), basic accessibility, and browser testing.
- They do NOT cover: backend integration (covered in Backend tab), content population, or CMS configuration.
- For projects **without designs**: always include a line item for either design system creation or adoption of an existing system (e.g., Material UI, Radix, Tailwind UI). This is not optional.
- Accessibility compliance level (A/AA/AAA) significantly impacts effort — AA is the typical default.
- Multilingual adds 15-25% to frontend effort for RTL support, string externalization, and layout adjustments.
