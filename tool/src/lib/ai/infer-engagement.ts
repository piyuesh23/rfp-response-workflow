/**
 * Shared engagement metadata inference from document text.
 * Extracted from /api/engagements/infer/route.ts for reuse by import worker.
 */
import Anthropic from "@anthropic-ai/sdk";

const SONNET_MODEL = "claude-sonnet-4-20250514";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export interface InferredEngagement {
  clientName: string | null;
  projectName: string | null;
  techStack: string | null;
  engagementType: string | null;
  industry: string | null;
  submissionDeadline: string | null;
  issueDate: string | null;
  estimatedDealValue: number | null;
  financialProposalValue: number | null;
  estimatedBudget: number | null;
  deliveryTimeline: string | null;
  finalCostSubmitted: number | null;
  confidence: {
    clientName: number;
    projectName: number;
    techStack: number;
    engagementType: number;
    industry: number;
  };
}

export interface SecondaryDocumentInference {
  estimatedBudget: number | null;
  deliveryTimeline: string | null;
  finalCostSubmitted: number | null;
}

const VALID_TECH_STACKS = [
  "DRUPAL", "DRUPAL_NEXTJS", "WORDPRESS", "WORDPRESS_NEXTJS", "NEXTJS", "REACT",
];

const VALID_ENGAGEMENT_TYPES = [
  "NEW_BUILD", "MIGRATION", "REDESIGN", "ENHANCEMENT", "DISCOVERY",
];

const VALID_INDUSTRIES = [
  "HEALTHCARE", "FINTECH", "EDUCATION", "GOVERNMENT", "MEDIA", "ECOMMERCE",
  "NONPROFIT", "MANUFACTURING", "PROFESSIONAL_SERVICES", "TECHNOLOGY",
  "ENERGY", "LEGAL", "OTHER",
];

/**
 * Use AI to infer engagement metadata from extracted document text.
 * Truncates to first 8000 chars for efficiency.
 */
export async function inferEngagementFromText(
  text: string
): Promise<InferredEngagement> {
  // Read full document — Haiku has 200k context, most RFPs fit well under the 150k char cap.
  const truncated = text.slice(0, 150000);

  const anthropic = new Anthropic();

  const systemPrompt = `You are a presales document analyzer. Given text extracted from a Terms of Reference (TOR) / RFP / SOW document, extract the following fields:

1. **clientName** — The organization issuing the TOR. Look for "issued by", letterhead, client name, organization name.
2. **projectName** — The project title or name. Look for "Project Title", "Project Name", document title.
3. **techStack** — The primary technology platform. Must be one of: ${VALID_TECH_STACKS.join(", ")}. Infer from technology requirements, platform mentions, CMS references. If Drupal is mentioned with a decoupled/headless frontend using Next.js or React, use DRUPAL_NEXTJS. If WordPress with Next.js frontend, use WORDPRESS_NEXTJS.
4. **engagementType** — The type of work. Must be one of: ${VALID_ENGAGEMENT_TYPES.join(", ")}. NEW_BUILD = greenfield project. MIGRATION = moving from one platform to another. REDESIGN = rebuilding/redesigning existing site. ENHANCEMENT = adding features to existing system. DISCOVERY = research/assessment only.
5. **industry** — The client's industry/domain. Must be one of: ${VALID_INDUSTRIES.join(", ")}. Infer from the client's organization type, the project domain, or explicit industry references in the document.
6. **submissionDeadline** — The proposal/RFP submission deadline date. Return as ISO 8601 date string (YYYY-MM-DD) or null.
7. **issueDate** — The date the RFP/TOR was issued. Return as ISO 8601 date string (YYYY-MM-DD) or null.
8. **estimatedDealValue** — Estimated total project value in USD. Infer from scope/budget hints. Return as number or null.
9. **financialProposalValue** — The actual financial proposal amount if this document contains pricing. Return as number or null.
10. **estimatedBudget** — The tentative or indicative budget stated in the TOR. Look for "budget", "estimated cost", "not to exceed", "ceiling price", "budget envelope". Return as number (USD) or null.
11. **deliveryTimeline** — The project duration or go-live target. Look for "completion date", "project duration", "delivery within", "go-live date", "timeline". Return as a short human-readable string (e.g. "6 months", "Q3 2026", "12 months from contract signing") or null.
12. **finalCostSubmitted** — The final total price submitted in a financial proposal. Typically a grand total or bottom-line figure. Return as number (USD) or null.

For clientName, projectName, techStack, engagementType, and industry, also provide a confidence score from 0.0 to 1.0.

Respond ONLY with valid JSON in this exact format:
{
  "clientName": "string or null",
  "projectName": "string or null",
  "techStack": "ENUM_VALUE or null",
  "engagementType": "ENUM_VALUE or null",
  "industry": "ENUM_VALUE or null",
  "submissionDeadline": "YYYY-MM-DD or null",
  "issueDate": "YYYY-MM-DD or null",
  "estimatedDealValue": null,
  "financialProposalValue": null,
  "estimatedBudget": null,
  "deliveryTimeline": null,
  "finalCostSubmitted": null,
  "confidence": {
    "clientName": 0.0,
    "projectName": 0.0,
    "techStack": 0.0,
    "engagementType": 0.0,
    "industry": 0.0
  }
}`;

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 600,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Extract engagement details from this document text:\n\n${truncated}`,
      },
    ],
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as InferredEngagement;

  // Validate enum values — null out invalid ones
  if (parsed.techStack && !VALID_TECH_STACKS.includes(parsed.techStack)) {
    parsed.techStack = null;
    parsed.confidence.techStack = 0;
  }
  if (parsed.engagementType && !VALID_ENGAGEMENT_TYPES.includes(parsed.engagementType)) {
    parsed.engagementType = null;
    parsed.confidence.engagementType = 0;
  }
  if (parsed.industry && !VALID_INDUSTRIES.includes(parsed.industry)) {
    parsed.industry = null;
    parsed.confidence.industry = 0;
  }

  return parsed;
}

/**
 * Lightweight inference for secondary documents (estimates, proposals, financial).
 * Uses Haiku for cost efficiency — only extracts cost/timeline signals.
 */
export async function inferFromSecondaryDocument(
  text: string,
  fileType: "ESTIMATE" | "PROPOSAL" | "FINANCIAL"
): Promise<SecondaryDocumentInference> {
  // Read full document (up to 150k chars ≈ 37k tokens) so grand-total figures
  // at the bottom of long proposals are visible to the extractor. Haiku's
  // 200k context comfortably holds any real-world RFP response.
  const truncated = text.slice(0, 150000);
  const anthropic = new Anthropic();

  const typeHint =
    fileType === "FINANCIAL"
      ? "a financial proposal or commercial bid document"
      : fileType === "ESTIMATE"
        ? "a project estimate or effort breakdown document"
        : "a technical proposal document";

  const systemPrompt = `You are analyzing ${typeHint}. Extract the following fields:

1. **estimatedBudget** — Any indicative or estimated budget/cost mentioned. Look for "estimated cost", "budget", "not to exceed", "ceiling". Return as number (USD) or null.
2. **deliveryTimeline** — Project duration or go-live target. Look for "project duration", "delivery within", "completion by", "timeline", "go-live". Return as short string (e.g. "6 months") or null.
3. **finalCostSubmitted** — The grand total or final submitted price. Look for "total price", "grand total", "total cost", "final amount", bottom-line figures. Return as number (USD) or null.

Respond ONLY with valid JSON:
{
  "estimatedBudget": null,
  "deliveryTimeline": null,
  "finalCostSubmitted": null
}`;

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Extract cost and timeline data from this document:\n\n${truncated}`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { estimatedBudget: null, deliveryTimeline: null, finalCostSubmitted: null };
    }
    return JSON.parse(jsonMatch[0]) as SecondaryDocumentInference;
  } catch {
    return { estimatedBudget: null, deliveryTimeline: null, finalCostSubmitted: null };
  }
}

/**
 * Classify a file's role based on its name and optional content snippet.
 */
export function classifyFileType(
  fileName: string
): "TOR" | "ESTIMATE" | "PROPOSAL" | "FINANCIAL" | "QA_RESPONSE" | "ADDENDUM" | "QUESTIONS" | "ANNEXURE" | "PREREQUISITES" | "RESPONSE_FORMAT" | "OTHER" {
  const lower = fileName.toLowerCase();
  // Q&A response patterns — check before TOR to avoid "questions" false-matching
  if (/q\s*&\s*a|q\s*and\s*a|questions?\s*(and|&)\s*answers?|clarification\s*response/i.test(lower)) return "QA_RESPONSE";
  if (/questions?\s*(version|v\d)/i.test(lower)) return "QA_RESPONSE";
  if (/addendum|corrigendum|amendment|pre.?bid.*minutes/i.test(lower)) return "ADDENDUM";
  if (/clarification\s*request|queries\s*regarding|pre.?bid\s*quer/i.test(lower)) return "QUESTIONS";
  // Financial/commercial — check before annex to avoid "annex.*financial" going to ANNEXURE
  if (/financial|commercial|bid.price/i.test(lower)) return "FINANCIAL";
  if (/estimat|effort|cost.breakdown|hours/i.test(lower)) return "ESTIMATE";
  if (/proposal|technical.offer|tech.offer/i.test(lower)) return "PROPOSAL";
  if (/tor\b|terms.of.reference|rfp|rfq|sow|scope.of.work|requirement/i.test(lower)) return "TOR";
  if (/annex|appendix|attachment|schedule/i.test(lower)) return "ANNEXURE";
  if (/pre.?requisit|eligib|qualification.criteria/i.test(lower)) return "PREREQUISITES";
  if (/response.format|submission.template|evaluation.matrix|scoring.criteria/i.test(lower)) return "RESPONSE_FORMAT";
  return "OTHER";
}
