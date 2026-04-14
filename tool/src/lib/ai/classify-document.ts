/**
 * AI-powered document classification using content analysis.
 * Replaces static filename-based classification with content-aware Haiku classification.
 */
import Anthropic from "@anthropic-ai/sdk";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export interface DocumentClassification {
  documentType:
    | "TOR"
    | "ESTIMATE"
    | "PROPOSAL"
    | "FINANCIAL"
    | "QA_RESPONSE"
    | "RESEARCH"
    | "ADDENDUM"
    | "QUESTIONS"
    | "ANNEXURE"
    | "PREREQUISITES"
    | "RESPONSE_FORMAT"
    | "OTHER";
  engagementPhase: string;
  confidence: number;
  reasoning: string;
}

const PHASE_MAP: Record<DocumentClassification["documentType"], string> = {
  TOR: "1",
  ESTIMATE: "1A",
  PROPOSAL: "5",
  FINANCIAL: "1A",
  QA_RESPONSE: "2",
  RESEARCH: "0",
  ADDENDUM: "2",
  QUESTIONS: "1",
  ANNEXURE: "0",
  PREREQUISITES: "1",
  RESPONSE_FORMAT: "1",
  OTHER: "0",
};

const SYSTEM_PROMPT = `You are a presales document classifier. Given text extracted from a document, classify it into exactly one of these types:

- **TOR**: Terms of Reference, RFP, RFQ, SOW, or Scope of Work. Contains requirements, scope of work, submission deadlines, evaluation criteria, technical specifications. Often has sections like "Scope", "Requirements", "Timeline", "Evaluation", "Submission Instructions".
- **ESTIMATE**: Project effort or cost estimate. Contains effort/hour breakdowns by task, line items with hours, tabs (Backend/Frontend/Fixed Cost), confidence values, assumptions. Often has tables with Task/Hours/Description columns.
- **PROPOSAL**: Technical or solution proposal. Contains proposed solution, architecture, team composition, methodology, timeline, investment summary. Often narrative-heavy with sections like "Proposed Approach", "Architecture", "Team", "Why Us".
- **FINANCIAL**: Financial proposal or commercial bid. Contains pricing, cost breakdown, payment terms, commercial terms. Often has total cost, payment schedule, validity period.
- **QA_RESPONSE**: Clarification questions and answers. Contains questions and answers, clarification responses. Often numbered Q&A format.
- **RESEARCH**: Background research, market analysis, or technology assessment. Contains market research, competitor analysis, technology assessment. Background/contextual information.
- **ADDENDUM**: Contains addendums, corrigenda, amendments to the original TOR/RFP, pre-bid meeting minutes, or official answers/clarifications FROM the issuing organization to bidder queries. Key signals: "Addendum No.", "Corrigendum", "Amendment", "Clarification", "Pre-Bid Conference Minutes", "Answers to Queries", "Response to Questions from bidders".
- **QUESTIONS**: Contains questions or queries FROM our organization (the bidder) TO the customer/issuing organization, requesting clarification on TOR requirements. Key signals: numbered question lists referencing TOR sections, "Clarification Request", "Queries regarding", "Questions for", "Pre-bid Queries".
- **ANNEXURE**: Supplementary TOR attachments — technical specifications, drawings, data schemas, sample content, reference architectures, appendices. Signals: "Annexure", "Appendix", "Attachment", "Schedule", "Annex".
- **PREREQUISITES**: Eligibility criteria, pre-qualification requirements, mandatory certifications, compliance requirements. Signals: "Pre-requisites", "Eligibility", "Qualification Criteria", "Mandatory Requirements", "Pre-qualification".
- **RESPONSE_FORMAT**: Proposal structure instructions, submission templates, evaluation scoring matrices. Signals: "Response Format", "Submission Template", "Evaluation Matrix", "Scoring Criteria", "Proposal Format".
- **OTHER**: Does not fit any of the above categories.

Respond ONLY with valid JSON in this exact format:
{
  "documentType": "TOR",
  "confidence": 0.95,
  "reasoning": "Contains requirement tables, submission deadline, and scope sections typical of a TOR document."
}`;

/**
 * Detect whether a document is likely a blank template rather than a filled document.
 * Checks text length, placeholder density, and repetitive patterns.
 */
export function isLikelyTemplate(text: string): { isTemplate: boolean; reason: string } {
  // Very short documents are likely templates
  if (text.length < 300) {
    return { isTemplate: true, reason: "Document text too short (<300 chars) — likely a blank template" };
  }

  // Check for high placeholder density
  const placeholderPatterns = [
    /\[.*?\]/g,           // [placeholder]
    /\{.*?\}/g,           // {placeholder}
    /<.*?>/g,             // <placeholder>
    /_{3,}/g,             // _____ (fill-in blanks)
    /\.{3,}/g,            // ...... (fill-in)
    /TBD/gi,              // TBD markers
    /TODO/gi,             // TODO markers
    /INSERT\s/gi,         // INSERT HERE type markers
    /ENTER\s/gi,          // ENTER type markers
    /\[CLIENT_NAME\]/gi,  // Common template placeholders
    /\[PROJECT_NAME\]/gi,
    /\[DATE\]/gi,
  ];

  let placeholderCount = 0;
  for (const pattern of placeholderPatterns) {
    const matches = text.match(pattern);
    if (matches) placeholderCount += matches.length;
  }

  const wordCount = text.split(/\s+/).length;
  const placeholderDensity = wordCount > 0 ? placeholderCount / wordCount : 0;

  if (placeholderDensity > 0.05 && placeholderCount >= 5) {
    return {
      isTemplate: true,
      reason: `High placeholder density (${placeholderCount} placeholders in ${wordCount} words)`,
    };
  }

  return { isTemplate: false, reason: "" };
}

/**
 * Build few-shot examples from recent classification corrections.
 */
async function buildFewShotExamples(): Promise<string> {
  try {
    // Dynamic import to avoid circular dependencies at module load
    const { prisma } = await import("@/lib/db");
    const corrections = await prisma.classificationCorrection.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (corrections.length === 0) return "";

    const examples = corrections
      .filter((c) => c.textSnippet)
      .slice(0, 5)
      .map(
        (c) =>
          `Example: A document with content starting "${c.textSnippet?.slice(0, 100)}..." was initially classified as ${c.originalType} but was corrected to ${c.correctedType}.`
      )
      .join("\n");

    if (!examples) return "";

    return `\n\nLearn from these past corrections by human reviewers:\n${examples}\n\nUse these corrections to improve your classification accuracy.`;
  } catch {
    return "";
  }
}

/**
 * Detect whether a document contains both a technical proposal and a financial proposal section.
 * Returns section offsets so callers can extract each sub-section independently.
 */
export async function detectCombinedProposal(text: string): Promise<{
  isCombined: boolean;
  technicalSection?: { startOffset: number; endOffset: number };
  financialSection?: { startOffset: number; endOffset: number };
}> {
  const truncated = text.slice(0, 150000);
  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      system: `You are a document structure analyzer. Determine if this document contains BOTH a technical proposal AND a financial/commercial proposal section within the same document.

Look for:
- Technical sections: "Technical Proposal", "Proposed Solution", "Architecture", "Methodology"
- Financial sections: "Financial Proposal", "Commercial Bid", "Pricing", "Cost Breakdown", "Investment"

If both exist, estimate the character offsets where each section begins and ends.

Respond ONLY with valid JSON:
{
  "isCombined": false,
  "technicalSection": null,
  "financialSection": null
}

Or if combined:
{
  "isCombined": true,
  "technicalSection": { "startOffset": 0, "endOffset": 5000 },
  "financialSection": { "startOffset": 5001, "endOffset": 10000 }
}`,
      messages: [{ role: "user", content: `Analyze this document structure:\n\n${truncated}` }],
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { isCombined: false };
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { isCombined: false };
  }
}

/**
 * Classify a document by reading its content with AI (Haiku for speed/cost).
 * Reads first 12000 chars of text for better accuracy. Incorporates few-shot examples from past corrections.
 */
export async function classifyDocument(
  text: string
): Promise<DocumentClassification> {
  const truncated = text.slice(0, 150000);
  const anthropic = new Anthropic();

  // Build few-shot examples from past corrections (Workstream D)
  const fewShotExamples = await buildFewShotExamples();

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT + fewShotExamples,
      messages: [
        {
          role: "user",
          content: `Classify this document based on its content:\n\n${truncated}`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        documentType: "OTHER",
        engagementPhase: "0",
        confidence: 0,
        reasoning: "Classification failed",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      documentType: DocumentClassification["documentType"];
      confidence: number;
      reasoning: string;
    };

    const documentType = parsed.documentType ?? "OTHER";
    const engagementPhase = PHASE_MAP[documentType] ?? "0";

    return {
      documentType,
      engagementPhase,
      confidence: parsed.confidence ?? 0,
      reasoning: parsed.reasoning ?? "",
    };
  } catch (err) {
    console.error(
      `[classify-document] AI classification error: ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      documentType: "OTHER",
      engagementPhase: "0",
      confidence: 0,
      reasoning: `Classification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
