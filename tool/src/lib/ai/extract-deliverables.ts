/**
 * AI-powered structured metadata extraction from imported documents.
 * Uses Sonnet for accuracy. Each extractor is tailored to its document type.
 */
import Anthropic from "@anthropic-ai/sdk";

const SONNET_MODEL = "claude-sonnet-4-20250514";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TorMetadata {
  requirementCount: number;
  clarityBreakdown: {
    clear: number;
    needsClarification: number;
    ambiguous: number;
    missingDetail: number;
  };
  domains: string[];
  integrationCount: number;
  integrationNames: string[];
  submissionDeadline: string | null;
  projectTimeline: string | null;
  estimatedBudget: number | null;
}

export interface EstimateMetadata {
  totalHours: { low: number; high: number };
  hoursByTab: {
    backend: { low: number; high: number };
    frontend: { low: number; high: number };
    fixedCost: { low: number; high: number };
    ai: { low: number; high: number };
  };
  lineItemCount: number;
  confidenceDistribution: { high56: number; medium4: number; low123: number };
  assumptionCount: number;
  riskCount: number;
  techStack: string | null;
}

export interface ProposalMetadata {
  sections: string[];
  techStackDecisions: Array<{ technology: string; rationale: string }>;
  teamSize: number | null;
  timeline: string | null;
  investmentSummary: { totalHours: number | null; totalCost: number | null } | null;
  architectureStyle: string | null;
}

export interface FinancialMetadata {
  totalCost: number | null;
  currency: string;
  costBreakdown: Array<{ category: string; amount: number }>;
  paymentTerms: string | null;
  validityPeriod: string | null;
}

export interface QaMetadata {
  questionCount: number;
  answeredCount: number;
  stillAmbiguousCount: number;
  keyDecisions: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonFromResponse(text: string): unknown | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

async function callSonnet(
  system: string,
  userContent: string
): Promise<string> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ─── Extractors ──────────────────────────────────────────────────────────────

/**
 * Extract structured metadata from a TOR/RFP document.
 */
export async function extractTorDeliverables(
  text: string
): Promise<TorMetadata> {
  const defaultResult: TorMetadata = {
    requirementCount: 0,
    clarityBreakdown: {
      clear: 0,
      needsClarification: 0,
      ambiguous: 0,
      missingDetail: 0,
    },
    domains: [],
    integrationCount: 0,
    integrationNames: [],
    submissionDeadline: null,
    projectTimeline: null,
    estimatedBudget: null,
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales requirements analyst. Analyze this TOR/RFP document and extract structured metadata.

Count requirements (functional, non-functional, technical, integration, content, SEO, accessibility, performance, security, DevOps requirements). Assess clarity of each: clear means fully specified with no ambiguity; needsClarification means partially specified; ambiguous means vague or contradictory; missingDetail means implied but not described.

Identify key domains (e.g., "content architecture", "integrations", "frontend", "SEO", "accessibility", "performance", "security", "DevOps", "migration", "search").

List all third-party integrations mentioned (CRM, analytics, payment, SSO, search, CDN, etc.).

Extract submission deadline (ISO 8601 YYYY-MM-DD or null), project timeline (human-readable string or null), and estimated budget (number in USD or null).

Respond ONLY with valid JSON:
{
  "requirementCount": 0,
  "clarityBreakdown": { "clear": 0, "needsClarification": 0, "ambiguous": 0, "missingDetail": 0 },
  "domains": [],
  "integrationCount": 0,
  "integrationNames": [],
  "submissionDeadline": null,
  "projectTimeline": null,
  "estimatedBudget": null
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this TOR document:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<TorMetadata>) };
  } catch {
    return defaultResult;
  }
}

/**
 * Extract structured metadata from a project estimate document.
 */
export async function extractEstimateDeliverables(
  text: string
): Promise<EstimateMetadata> {
  const defaultResult: EstimateMetadata = {
    totalHours: { low: 0, high: 0 },
    hoursByTab: {
      backend: { low: 0, high: 0 },
      frontend: { low: 0, high: 0 },
      fixedCost: { low: 0, high: 0 },
      ai: { low: 0, high: 0 },
    },
    lineItemCount: 0,
    confidenceDistribution: { high56: 0, medium4: 0, low123: 0 },
    assumptionCount: 0,
    riskCount: 0,
    techStack: null,
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales estimation analyst. Analyze this estimate document and extract structured metadata.

Look for tables with Task/Hours/Conf columns, tab sections (Backend, Frontend, Fixed Cost, AI), assumption registers, and risk registers.

Extract:
- Total hours (low and high range). If only one figure, use it for both.
- Hours broken down by tab: Backend, Frontend, Fixed Cost, AI (low and high for each).
- Line item count (total number of estimate rows, excluding header/total rows).
- Confidence distribution: high56 = count of Conf 5-6 items, medium4 = count of Conf 4 items, low123 = count of Conf 1-3 items.
- Assumption count (rows in assumption register table or list).
- Risk count (rows in risk register table).
- Tech stack (e.g., "Drupal", "Drupal + Next.js", "WordPress") or null if not specified.

Respond ONLY with valid JSON:
{
  "totalHours": { "low": 0, "high": 0 },
  "hoursByTab": {
    "backend": { "low": 0, "high": 0 },
    "frontend": { "low": 0, "high": 0 },
    "fixedCost": { "low": 0, "high": 0 },
    "ai": { "low": 0, "high": 0 }
  },
  "lineItemCount": 0,
  "confidenceDistribution": { "high56": 0, "medium4": 0, "low123": 0 },
  "assumptionCount": 0,
  "riskCount": 0,
  "techStack": null
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this estimate document:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<EstimateMetadata>) };
  } catch {
    return defaultResult;
  }
}

/**
 * Extract structured metadata from a technical proposal document.
 */
export async function extractProposalDeliverables(
  text: string
): Promise<ProposalMetadata> {
  const defaultResult: ProposalMetadata = {
    sections: [],
    techStackDecisions: [],
    teamSize: null,
    timeline: null,
    investmentSummary: null,
    architectureStyle: null,
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales analyst reviewing a technical proposal document.

Extract:
- sections: List of major section headings (e.g., "Executive Summary", "Proposed Architecture", "Team Composition").
- techStackDecisions: Array of {technology, rationale} pairs for each key technology choice explained in the proposal.
- teamSize: Number of team members proposed (integer or null).
- timeline: Project duration or delivery target as a short string (e.g., "6 months", "Q3 2026") or null.
- investmentSummary: {totalHours, totalCost} — extract total hours and total cost/price if mentioned, otherwise null for each field. investmentSummary itself is null if neither is found.
- architectureStyle: One of "monolith", "decoupled", "headless", "microservices" or null if not determinable.

Respond ONLY with valid JSON:
{
  "sections": [],
  "techStackDecisions": [],
  "teamSize": null,
  "timeline": null,
  "investmentSummary": null,
  "architectureStyle": null
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this technical proposal:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<ProposalMetadata>) };
  } catch {
    return defaultResult;
  }
}

/**
 * Extract structured metadata from a financial proposal or commercial bid document.
 */
export async function extractFinancialDeliverables(
  text: string
): Promise<FinancialMetadata> {
  const defaultResult: FinancialMetadata = {
    totalCost: null,
    currency: "USD",
    costBreakdown: [],
    paymentTerms: null,
    validityPeriod: null,
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales analyst reviewing a financial proposal or commercial bid document.

Extract:
- totalCost: Grand total or bottom-line figure as a number (no currency symbols). null if not found.
- currency: ISO currency code (e.g., "USD", "AUD", "EUR", "GBP"). Default to "USD" if not determinable.
- costBreakdown: Array of {category, amount} pairs for each line item or cost category with a monetary value.
- paymentTerms: Payment schedule or terms as a short human-readable string (e.g., "30% upfront, 70% on delivery") or null.
- validityPeriod: How long the quote/proposal is valid (e.g., "30 days", "90 days") or null.

Respond ONLY with valid JSON:
{
  "totalCost": null,
  "currency": "USD",
  "costBreakdown": [],
  "paymentTerms": null,
  "validityPeriod": null
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this financial document:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<FinancialMetadata>) };
  } catch {
    return defaultResult;
  }
}

/**
 * Extract structured metadata from a Q&A / clarification response document.
 */
export async function extractQaResponseDeliverables(
  text: string
): Promise<QaMetadata> {
  const defaultResult: QaMetadata = {
    questionCount: 0,
    answeredCount: 0,
    stillAmbiguousCount: 0,
    keyDecisions: [],
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales analyst reviewing a Q&A or clarification response document.

Extract:
- questionCount: Total number of questions in the document (count numbered questions or Q: prefixes).
- answeredCount: Number of questions that received a substantive answer (not "TBD", "To be confirmed", or blank).
- stillAmbiguousCount: Number of answers that are still vague, deferred, or unclear after the response.
- keyDecisions: List of important decisions or confirmations that affect project scope or estimation (up to 10 items, as short strings).

Respond ONLY with valid JSON:
{
  "questionCount": 0,
  "answeredCount": 0,
  "stillAmbiguousCount": 0,
  "keyDecisions": []
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this Q&A document:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<QaMetadata>) };
  } catch {
    return defaultResult;
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Dispatch structured extraction to the appropriate extractor based on document type.
 * Returns null for document types without a dedicated extractor (RESEARCH, OTHER).
 */
export async function extractDeliverables(
  text: string,
  documentType: string
): Promise<Record<string, unknown> | null> {
  switch (documentType) {
    case "TOR":
      return extractTorDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "ESTIMATE":
      return extractEstimateDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "PROPOSAL":
      return extractProposalDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "FINANCIAL":
      return extractFinancialDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "QA_RESPONSE":
      return extractQaResponseDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    default:
      return null;
  }
}
