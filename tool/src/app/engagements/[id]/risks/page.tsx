"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { RiskRegister, type RiskItem } from "@/components/risk/RiskRegister"
import { AlertTriangleIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react"
import { getSeverity } from "@/components/risk/RiskBadge"

const MOCK_RISKS: RiskItem[] = [
  {
    id: "r1",
    task: "SSO / SAML Integration",
    tab: "Backend",
    conf: 2,
    risk: "Client has not confirmed IdP vendor. Integration effort varies significantly between Okta, Azure AD, and ADFS.",
    openQuestion: "Which Identity Provider is in use? Is SAML 2.0 or OIDC required?",
    recommendedAction: "Request IdP vendor confirmation before sprint planning. Allow 3-day spike.",
    hoursAtRisk: 48,
  },
  {
    id: "r2",
    task: "Content Migration — Legacy CMS",
    tab: "Backend",
    conf: 3,
    risk: "Volume and structure of legacy content is unknown. HTML in body fields may require significant cleanup.",
    openQuestion: "How many nodes are being migrated? Is there structured or free-form HTML in body fields?",
    recommendedAction: "Run a content audit on the legacy system. Agree on a migration scope cap.",
    hoursAtRisk: 32,
  },
  {
    id: "r3",
    task: "Hero — Full-bleed Video Banner",
    tab: "Frontend",
    conf: 3,
    risk: "No design provided. Video autoplay, mute toggle, and fallback image handling add complexity.",
    openQuestion: "Will video assets be provided or sourced from a video CDN (Vimeo/Wistia)?",
    recommendedAction: "Obtain design reference or approved visual. Confirm video hosting solution.",
    hoursAtRisk: 20,
  },
  {
    id: "r4",
    task: "Multilingual / i18n Setup",
    tab: "Backend",
    conf: 4,
    risk: "TOR mentions two languages but does not specify translation workflow or third-party translation service integration.",
    openQuestion: "Will translations be managed in-CMS or via a service like Phrase or Crowdin?",
    recommendedAction: "Clarify translation workflow before starting. Budget for translation module config.",
    hoursAtRisk: 16,
  },
  {
    id: "r5",
    task: "Payment Gateway Integration",
    tab: "Backend",
    conf: 2,
    risk: "PCI-DSS scope unclear. If client takes card-present payments, server-side tokenisation is required and estimate increases substantially.",
    openQuestion: "Is the site required to be PCI-DSS compliant? Which gateway provider (Stripe, Braintree, PayPal)?",
    recommendedAction: "Confirm PCI scope with client. Use hosted fields / Stripe Elements to reduce PCI burden.",
    hoursAtRisk: 56,
  },
  {
    id: "r6",
    task: "Design System — Component Library",
    tab: "Frontend",
    conf: 4,
    risk: "No existing design tokens or Figma file provided. Building tokens from scratch adds setup overhead.",
    openQuestion: "Is there an existing Figma design system or brand style guide available?",
    recommendedAction: "Request Figma access before frontend sprint starts.",
    hoursAtRisk: 18,
  },
  {
    id: "r7",
    task: "CI/CD Pipeline Setup",
    tab: "Fixed Cost",
    conf: 5,
    risk: "Hosting provider not yet selected. Pipeline config differs between Acquia, Pantheon, and self-hosted k8s.",
    openQuestion: "Has hosting provider been confirmed?",
    recommendedAction: "Confirm hosting provider. Use platform-native CI tooling where possible.",
    hoursAtRisk: 10,
  },
  {
    id: "r8",
    task: "AI-Powered Search (Semantic)",
    tab: "AI",
    conf: 3,
    risk: "Scope of AI search is unclear — full RAG pipeline vs. simple vector similarity search have very different effort profiles.",
    openQuestion: "Should search results include generative summaries or only ranked results?",
    recommendedAction: "Define AI search output format with client. Prototype with a constrained dataset first.",
    hoursAtRisk: 24,
  },
]

export default function RisksPage() {
  const highCount = MOCK_RISKS.filter((r) => getSeverity(r.conf, r.hoursAtRisk) === "High").length
  const mediumCount = MOCK_RISKS.filter((r) => getSeverity(r.conf, r.hoursAtRisk) === "Medium").length
  const lowCount = MOCK_RISKS.filter((r) => getSeverity(r.conf, r.hoursAtRisk) === "Low").length
  const totalHours = MOCK_RISKS.reduce((sum, r) => sum + r.hoursAtRisk, 0)

  const summaryCards = [
    {
      label: "Total Risks",
      value: MOCK_RISKS.length,
      icon: ShieldIcon,
      className: "text-foreground",
    },
    {
      label: "High",
      value: highCount,
      icon: ShieldAlertIcon,
      className: "text-red-600 dark:text-red-400",
    },
    {
      label: "Medium",
      value: mediumCount,
      icon: AlertTriangleIcon,
      className: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Low",
      value: lowCount,
      icon: ShieldCheckIcon,
      className: "text-green-600 dark:text-green-400",
    },
    {
      label: "Hours at Risk",
      value: `${totalHours}h`,
      icon: ShieldAlertIcon,
      className: "text-foreground",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Risk Register</h2>
        <Badge variant="secondary" className="tabular-nums">
          {MOCK_RISKS.length}
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map(({ label, value, icon: Icon, className }) => (
          <Card key={label} className="ring-1 ring-foreground/10">
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`size-4 ${className}`} />
              </div>
              <span className={`text-2xl font-bold tabular-nums ${className}`}>{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk table */}
      <RiskRegister items={MOCK_RISKS} />
    </div>
  )
}
