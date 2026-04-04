"use client"

import * as React from "react"
import { FileDown, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArtefactViewer } from "@/components/artefact/ArtefactViewer"
import { VersionSelector } from "@/components/artefact/VersionSelector"

const MOCK_CLIENT_NAME = "Acme Corporation"

const MOCK_PROPOSAL_VERSIONS: Record<number, string> = {
  1: `# Technical Proposal

**Prepared for:** Acme Corporation
**Prepared by:** QED42
**Date:** April 2026
**Version:** v1

---

## 1. Executive Summary

QED42 is pleased to present this technical proposal for the redesign and redevelopment of Acme Corporation's digital presence. This engagement covers the full delivery of a modern, accessible, and performant web platform built on **Drupal 10** with a **Next.js** decoupled frontend.

Our proposal addresses all requirements outlined in the Terms of Reference (TOR) dated March 2026. We have structured our approach to minimise risk, deliver early value, and ensure a smooth transition from the existing legacy platform.

**Key highlights:**
- Estimated delivery: 20–24 weeks
- Technology: Drupal 10 + Next.js 15 (App Router)
- Team: 1 Architect, 2 Backend, 2 Frontend, 1 QA, 1 PM
- Effort range: 500–640 hours (development only; see Pricing Summary)

---

## 2. Project Understanding

Acme Corporation operates a content-heavy public-facing website serving over 150,000 monthly visitors. The current platform is built on Drupal 7 and is approaching end-of-life. The TOR identifies the following primary objectives:

1. Migrate content and taxonomy from Drupal 7 to Drupal 10
2. Introduce a decoupled frontend using Next.js for improved Core Web Vitals
3. Redesign the information architecture to support 12 new content types
4. Integrate with Salesforce CRM and Algolia search
5. Meet WCAG 2.1 AA accessibility standards
6. Achieve Lighthouse performance scores ≥ 90 across all page types

**Assumptions applied (no-response path):**
- Content volume: ~5,000 nodes across 8 legacy content types
- Media assets: ~2,500 images, ~200 documents
- No custom payment or e-commerce flows required
- Single language (English); multilingual out of scope

---

## 3. Technical Approach

### 3.1 Architecture

We propose a **fully decoupled Drupal + Next.js** architecture:

| Layer | Technology | Rationale |
|---|---|---|
| CMS / API | Drupal 10 (JSON:API) | Mature content modelling, editorial UX, contrib ecosystem |
| Frontend | Next.js 15 (App Router) | SSR/ISR, React Server Components, excellent DX |
| Search | Algolia | Fast faceted search, hosted index management |
| CRM | Salesforce REST API | Standard T2 integration via webhook + queue |
| CDN | Cloudflare | Edge caching, image optimisation, DDoS protection |
| Hosting | Acquia Cloud (Drupal) + Vercel (Next.js) | Managed PaaS reduces DevOps overhead |

### 3.2 Content Architecture

The following content types will be implemented in Drupal 10:

- **Article** — News, blog, and press releases
- **Event** — Dated events with registration links
- **Person** — Staff profiles with relationship fields
- **Organisation** — Partner/member directory entries
- **Resource** — Downloadable documents and reports
- **Landing Page** — Flexible layout via Paragraphs
- **Basic Page** — Standard informational pages
- **Case Study** — Project showcase with media gallery
- **FAQ** — Accordion-format structured Q&A
- **Testimonial** — Quote blocks with attribution
- **Service** — Service catalogue entries
- **Product** — Product detail pages (no e-commerce)

### 3.3 Integration Strategy

| Integration | Tier | Approach | Est. Hours |
|---|---|---|---|
| Salesforce CRM | T2 | REST API, OAuth2, webhook receiver, queue worker | 40–60h |
| Algolia Search | T2 | Search API + Algolia module, index config, facets | 24–32h |
| Google Analytics 4 | T1 | Tag Manager snippet, event layer | 4–8h |
| Mailchimp | T1 | API subscription form, double opt-in | 8–12h |

### 3.4 Migration Strategy

Migration from Drupal 7 will use the **Drupal Migrate API** with custom plugins for non-standard field mappings. The migration will be executed in two passes:

1. **Dry run** in staging — validate node counts, redirect mapping, media file integrity
2. **Production cutover** — scheduled maintenance window, DNS cutover, post-migration smoke tests

---

## 4. Frontend Architecture

### 4.1 Design System

A custom design system will be built in **Storybook** using **Tailwind CSS** and **shadcn/ui** as the component foundation. All components will be documented with usage guidelines and accessibility annotations.

### 4.2 Component Inventory (selected)

| Component | Visual Reference | Conf |
|---|---|---|
| Header (nav + mega-menu) | [Reference](https://www.gov.uk) | 4 |
| Footer (multi-column) | [Reference](https://www.gov.uk) | 5 |
| Hero (full-bleed image + CTA) | [Reference](https://stripe.com) | 5 |
| Article Card | [Reference](https://medium.com) | 6 |
| Event Listing | [Reference](https://eventbrite.com) | 5 |
| Search Results Page | [Reference](https://algolia.com/doc) | 4 |
| Resource Download Card | [Reference](https://www.oecd.org) | 5 |
| Person Profile | [Reference](https://www.gov.uk/government/people) | 5 |

### 4.3 Performance Targets

- **LCP** < 2.5s on mobile (4G)
- **CLS** < 0.1
- **INP** < 200ms
- Lighthouse Performance ≥ 90 (desktop), ≥ 85 (mobile)

---

## 5. Delivery Timeline

| Sprint | Duration | Key Deliverables |
|---|---|---|
| Discovery & Setup | Weeks 1–2 | Environment setup, architecture sign-off, design system scaffold |
| Content Architecture | Weeks 3–5 | All content types, taxonomy, roles, media library |
| Core Frontend | Weeks 6–10 | Design system, global components, article/event/resource templates |
| Integrations | Weeks 11–14 | Salesforce, Algolia, GA4, Mailchimp |
| Migration | Weeks 15–17 | D7 migration dry-run, redirect mapping, media transfer |
| QA & Stabilisation | Weeks 18–20 | Cross-browser, accessibility audit, performance tuning |
| UAT & Cutover | Weeks 21–24 | Client UAT, production migration, DNS cutover, hypercare |

---

## 6. Proposed Team

| Role | Allocation | Responsibility |
|---|---|---|
| Technical Architect | 25% | Architecture oversight, code review, client technical liaison |
| Backend Developer (×2) | 100% | Drupal development, API, migrations, integrations |
| Frontend Developer (×2) | 100% | Next.js, design system, component build |
| QA Engineer | 50% | Test plans, regression, accessibility, performance |
| Project Manager | 50% | Sprint planning, reporting, risk management |

---

## 7. Assumptions & Change Request Boundaries

The following assumptions underpin this estimate. Any deviation will be treated as a change request (CR):

1. **Content volume** does not exceed 6,000 nodes at migration time.
2. **Salesforce** instance is already provisioned; API credentials will be provided by week 2.
3. **Designs** will be provided as Figma files with exported assets; no design work is included in this estimate.
4. **Single language** site; multilingual (language switcher, translations) is out of scope.
5. **No custom e-commerce** or payment gateway integration required.
6. **Hosting environments** (Acquia + Vercel) will be provisioned by the client or via QED42 with a separate infrastructure engagement.
7. **UAT** will be completed within a 2-week window by the client team.

---

## 8. Pricing Summary

| Tab | Low (hrs) | High (hrs) |
|---|---|---|
| Backend | 240 | 320 |
| Frontend | 180 | 240 |
| Fixed Cost Items | 80 | 80 |
| **Total** | **500** | **640** |

*Day rate: £650/day (8h). Total investment range: £40,625 – £52,000 (exc. VAT and infrastructure costs)*

> Confidence levels range from 4–6 across line items. Items rated Conf 4 carry a +50% buffer already included in the High column. A detailed risk register is available in the Risks tab.
`,
  2: `# Technical Proposal (Revised)

**Prepared for:** Acme Corporation
**Prepared by:** QED42
**Date:** April 2026
**Version:** v2 — Updated after client Q&A responses

---

## Change Log (v1 → v2)

- Salesforce integration promoted from T2 to T3 following confirmation of custom object mappings
- Multilingual scope confirmed: 2 languages (EN + FR) — added to Backend and Frontend tabs
- Content volume revised upward: ~8,000 nodes (previously assumed 5,000)
- Design delivery timeline shifted: Figma handoff by end of Week 3 (was Week 1)

---

## 1. Executive Summary

This revised proposal incorporates responses received from Acme Corporation on 28 March 2026. The scope has been updated to reflect confirmed multilingual requirements (English + French), a revised content volume of ~8,000 nodes, and a more complex Salesforce integration involving custom objects.

**Updated effort range: 620–800 hours**

---

## 2. Updated Pricing Summary

| Tab | Low (hrs) | High (hrs) |
|---|---|---|
| Backend | 300 | 400 |
| Frontend | 220 | 280 |
| Fixed Cost Items | 100 | 120 |
| **Total** | **620** | **800** |

*Total investment range: £50,375 – £65,000 (exc. VAT and infrastructure costs)*

---

*Full technical sections remain as per v1 except where noted in the Change Log above.*
`,
}

const MOCK_METADATA = {
  1: { generatedAt: "2026-04-01T09:30:00Z", phase: "1A" },
  2: { generatedAt: "2026-04-03T14:15:00Z", phase: "1A" },
}

const AVAILABLE_VERSIONS = [1, 2]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ProposalPage() {
  const [currentVersion, setCurrentVersion] = React.useState(2)

  const contentMd = MOCK_PROPOSAL_VERSIONS[currentVersion] ?? ""
  const metadata = MOCK_METADATA[currentVersion as keyof typeof MOCK_METADATA]

  function handlePrint() {
    window.print()
  }

  function handleDownloadPdf() {
    // Placeholder — wire up real PDF generation when API is ready
    window.print()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Technical Proposal
          </h2>
          <p className="text-sm text-muted-foreground">{MOCK_CLIENT_NAME}</p>
        </div>

        {/* Actions — hidden when printing */}
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <FileDown className="mr-1.5 size-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 size-4" />
            Print
          </Button>
          <VersionSelector
            versions={AVAILABLE_VERSIONS}
            currentVersion={currentVersion}
            onChange={setCurrentVersion}
          />
        </div>
      </div>

      <Separator />

      {/* Proposal content */}
      <ArtefactViewer contentMd={contentMd} version={currentVersion} />

      {/* Metadata card */}
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap gap-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Generated:</span>
            <span className="text-xs font-medium">
              {metadata ? formatDate(metadata.generatedAt) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Version:</span>
            <Badge variant="secondary" className="text-xs">
              v{currentVersion}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Phase:</span>
            <Badge variant="outline" className="text-xs">
              {metadata?.phase ?? "—"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
