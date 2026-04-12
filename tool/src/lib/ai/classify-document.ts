/**
 * AI-powered document classification using content analysis.
 * Replaces static filename-based classification with content-aware Haiku classification.
 */
import Anthropic from "@anthropic-ai/sdk";

const HAIKU_MODEL = "claude-haiku-4-20250514";

export interface DocumentClassification {
  documentType:
    | "TOR"
    | "ESTIMATE"
    | "PROPOSAL"
    | "FINANCIAL"
    | "QA_RESPONSE"
    | "RESEARCH"
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
  OTHER: "0",
};

const SYSTEM_PROMPT = `You are a presales document classifier. Given text extracted from a document, classify it into exactly one of these types:

- **TOR**: Terms of Reference, RFP, RFQ, SOW, or Scope of Work. Contains requirements, scope of work, submission deadlines, evaluation criteria, technical specifications. Often has sections like "Scope", "Requirements", "Timeline", "Evaluation", "Submission Instructions".
- **ESTIMATE**: Project effort or cost estimate. Contains effort/hour breakdowns by task, line items with hours, tabs (Backend/Frontend/Fixed Cost), confidence values, assumptions. Often has tables with Task/Hours/Description columns.
- **PROPOSAL**: Technical or solution proposal. Contains proposed solution, architecture, team composition, methodology, timeline, investment summary. Often narrative-heavy with sections like "Proposed Approach", "Architecture", "Team", "Why Us".
- **FINANCIAL**: Financial proposal or commercial bid. Contains pricing, cost breakdown, payment terms, commercial terms. Often has total cost, payment schedule, validity period.
- **QA_RESPONSE**: Clarification questions and answers. Contains questions and answers, clarification responses. Often numbered Q&A format.
- **RESEARCH**: Background research, market analysis, or technology assessment. Contains market research, competitor analysis, technology assessment. Background/contextual information.
- **OTHER**: Does not fit any of the above categories.

Respond ONLY with valid JSON in this exact format:
{
  "documentType": "TOR",
  "confidence": 0.95,
  "reasoning": "Contains requirement tables, submission deadline, and scope sections typical of a TOR document."
}`;

/**
 * Classify a document by reading its content with AI (Haiku for speed/cost).
 * Reads first 4000 chars of text.
 */
export async function classifyDocument(
  text: string
): Promise<DocumentClassification> {
  const truncated = text.slice(0, 4000);
  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
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
  } catch {
    return {
      documentType: "OTHER",
      engagementPhase: "0",
      confidence: 0,
      reasoning: "Classification failed",
    };
  }
}
