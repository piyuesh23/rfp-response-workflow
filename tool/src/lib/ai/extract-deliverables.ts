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

export interface EstimateAssumption {
  text: string;
  torReference: string | null;
  impactIfWrong: string;
}

export interface EstimateRisk {
  task: string;
  tab: string;
  conf: number;
  risk: string;
  openQuestion: string;
  recommendedAction: string;
  hoursAtRisk: number;
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
  assumptions: EstimateAssumption[];
  risks: EstimateRisk[];
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

export interface AnnexureMetadata {
  annexureNumber: string | null;
  title: string | null;
  type: "TECHNICAL_SPEC" | "DATA_SCHEMA" | "DRAWINGS" | "SAMPLE_CONTENT" | "REFERENCE" | "OTHER";
  referencedTorSections: string[];
  keySpecifications: string[];
}

export interface PrerequisitesMetadata {
  eligibilityCriteria: string[];
  mandatoryCertifications: string[];
  technicalPrereqs: string[];
  complianceRequirements: string[];
  disqualificationRisks: string[];
}

export interface ResponseFormatMetadata {
  requiredSections: string[];
  scoringCriteria: Array<{ criterion: string; weight: number | null }>;
  pageLimit: number | null;
  submissionFormat: string | null;
  evaluationMethodology: string | null;
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
  userContent: string,
  maxTokens = 800
): Promise<string> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: maxTokens,
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
    assumptions: [],
    risks: [],
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
- assumptions: Array of assumption objects with { text, torReference (section ref or null), impactIfWrong }. Extract from Assumption Register/table or bullet lists.
- risks: Array of risk objects with { task, tab, conf, risk, openQuestion, recommendedAction, hoursAtRisk }. Extract from Risk Register table.

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
  "techStack": null,
  "assumptions": [],
  "risks": []
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this estimate document:\n\n${truncated}`,
      1500
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

/**
 * Extract structured metadata from an annexure or appendix document.
 */
export async function extractAnnexureDeliverables(
  text: string
): Promise<AnnexureMetadata> {
  const defaultResult: AnnexureMetadata = {
    annexureNumber: null,
    title: null,
    type: "OTHER",
    referencedTorSections: [],
    keySpecifications: [],
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales analyst reviewing an annexure or appendix document attached to a TOR/RFP.

Extract:
- annexureNumber: The annexure/appendix/attachment identifier (e.g., "Annexure A", "Appendix 1", "Attachment 2") or null if not labelled.
- title: The title or subject of the annexure (e.g., "Technical Specifications", "Data Schema") or null.
- type: One of "TECHNICAL_SPEC" (technical specifications, architecture diagrams), "DATA_SCHEMA" (data models, database schemas, ERDs), "DRAWINGS" (wireframes, mockups, drawings), "SAMPLE_CONTENT" (sample data, content examples), "REFERENCE" (reference documents, standards, guidelines), "OTHER".
- referencedTorSections: List of TOR/RFP section numbers or names this annexure relates to (up to 10).
- keySpecifications: List of key technical specifications or requirements found in this annexure (up to 10 short strings).

Respond ONLY with valid JSON:
{
  "annexureNumber": null,
  "title": null,
  "type": "OTHER",
  "referencedTorSections": [],
  "keySpecifications": []
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this annexure document:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<AnnexureMetadata>) };
  } catch {
    return defaultResult;
  }
}

/**
 * Extract structured metadata from a prerequisites or eligibility criteria document.
 */
export async function extractPrerequisitesDeliverables(
  text: string
): Promise<PrerequisitesMetadata> {
  const defaultResult: PrerequisitesMetadata = {
    eligibilityCriteria: [],
    mandatoryCertifications: [],
    technicalPrereqs: [],
    complianceRequirements: [],
    disqualificationRisks: [],
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales analyst reviewing a prerequisites or eligibility criteria document for a tender/RFP.

Extract:
- eligibilityCriteria: List of general eligibility requirements (e.g., "Minimum 5 years experience", "Annual turnover > $5M") — up to 10 items.
- mandatoryCertifications: List of required certifications, accreditations, or registrations (e.g., "ISO 27001", "CMMI Level 3") — up to 10 items.
- technicalPrereqs: Technical capability requirements (e.g., "Must have delivered 3 Drupal projects", "AWS Partner status") — up to 10 items.
- complianceRequirements: Regulatory, legal, or policy compliance requirements (e.g., "GDPR compliant", "Local government entity") — up to 10 items.
- disqualificationRisks: Any conditions that would automatically disqualify a bidder (e.g., "Conflict of interest", "Outstanding litigation") — up to 5 items.

Respond ONLY with valid JSON:
{
  "eligibilityCriteria": [],
  "mandatoryCertifications": [],
  "technicalPrereqs": [],
  "complianceRequirements": [],
  "disqualificationRisks": []
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this prerequisites document:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<PrerequisitesMetadata>) };
  } catch {
    return defaultResult;
  }
}

/**
 * Extract structured metadata from a response format or submission template document.
 */
export async function extractResponseFormatDeliverables(
  text: string
): Promise<ResponseFormatMetadata> {
  const defaultResult: ResponseFormatMetadata = {
    requiredSections: [],
    scoringCriteria: [],
    pageLimit: null,
    submissionFormat: null,
    evaluationMethodology: null,
  };

  const truncated = text.slice(0, 12000);
  const system = `You are a presales analyst reviewing a response format, submission template, or evaluation scoring document for a tender/RFP.

Extract:
- requiredSections: List of mandatory sections the proposal must contain (e.g., "Executive Summary", "Technical Approach", "Team CVs") — up to 15 items.
- scoringCriteria: Array of {criterion, weight} pairs from the evaluation/scoring matrix. weight is a number (percentage or points) or null if not specified.
- pageLimit: Maximum page count for the submission as a number, or null if not specified.
- submissionFormat: Required format or medium (e.g., "PDF via online portal", "3 hard copies + USB") or null.
- evaluationMethodology: How proposals will be evaluated (e.g., "Lowest price technically acceptable", "Weighted scoring 70/30 technical/commercial") or null.

Respond ONLY with valid JSON:
{
  "requiredSections": [],
  "scoringCriteria": [],
  "pageLimit": null,
  "submissionFormat": null,
  "evaluationMethodology": null
}`;

  try {
    const responseText = await callSonnet(
      system,
      `Extract metadata from this response format document:\n\n${truncated}`
    );
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) return defaultResult;
    return { ...defaultResult, ...(parsed as Partial<ResponseFormatMetadata>) };
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
    case "ADDENDUM":
      return extractTorDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "ESTIMATE":
      return extractEstimateDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "PROPOSAL":
      return extractProposalDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "FINANCIAL":
      return extractFinancialDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "QA_RESPONSE":
    case "QUESTIONS":
      return extractQaResponseDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "ANNEXURE":
      return extractAnnexureDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "PREREQUISITES":
      return extractPrerequisitesDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    case "RESPONSE_FORMAT":
      return extractResponseFormatDeliverables(text) as unknown as Promise<Record<string, unknown>>;
    default:
      return null;
  }
}
