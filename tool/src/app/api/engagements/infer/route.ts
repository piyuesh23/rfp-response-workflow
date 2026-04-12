import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const SONNET_MODEL = "claude-sonnet-4-20250514";

interface InferredFields {
  clientName: string | null;
  projectName: string | null;
  techStack: string | null;
  engagementType: string | null;
  industry: string | null;
  confidence: {
    clientName: number;
    projectName: number;
    techStack: number;
    engagementType: number;
    industry: number;
  };
}

const VALID_TECH_STACKS = [
  "DRUPAL",
  "DRUPAL_NEXTJS",
  "WORDPRESS",
  "WORDPRESS_NEXTJS",
  "NEXTJS",
  "REACT",
];

const VALID_ENGAGEMENT_TYPES = [
  "NEW_BUILD",
  "MIGRATION",
  "REDESIGN",
  "ENHANCEMENT",
  "DISCOVERY",
];

const VALID_INDUSTRIES = [
  "HEALTHCARE",
  "FINTECH",
  "EDUCATION",
  "GOVERNMENT",
  "MEDIA",
  "ECOMMERCE",
  "NONPROFIT",
  "MANUFACTURING",
  "PROFESSIONAL_SERVICES",
  "TECHNOLOGY",
  "ENERGY",
  "LEGAL",
  "OTHER",
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { torText } = body as { torText: string };

  if (!torText || typeof torText !== "string" || torText.trim().length < 50) {
    return NextResponse.json(
      { error: "torText must be at least 50 characters" },
      { status: 400 }
    );
  }

  // Truncate to first ~6000 chars — enough for headers, intro, scope where metadata lives
  const truncated = torText.slice(0, 6000);

  const anthropic = new Anthropic();

  const systemPrompt = `You are a presales document analyzer. Given text extracted from a Terms of Reference (TOR) / RFP / SOW document, extract the following fields:

1. **clientName** — The organization issuing the TOR. Look for "issued by", letterhead, client name, organization name.
2. **projectName** — The project title or name. Look for "Project Title", "Project Name", document title.
3. **techStack** — The primary technology platform. Must be one of: ${VALID_TECH_STACKS.join(", ")}. Infer from technology requirements, platform mentions, CMS references. If Drupal is mentioned with a decoupled/headless frontend using Next.js or React, use DRUPAL_NEXTJS. If WordPress with Next.js frontend, use WORDPRESS_NEXTJS.
4. **engagementType** — The type of work. Must be one of: ${VALID_ENGAGEMENT_TYPES.join(", ")}. NEW_BUILD = greenfield project. MIGRATION = moving from one platform to another. REDESIGN = rebuilding/redesigning existing site. ENHANCEMENT = adding features to existing system. DISCOVERY = research/assessment only.
5. **industry** — The client's industry/domain. Must be one of: ${VALID_INDUSTRIES.join(", ")}. Infer from the client's organization type, the project domain, or explicit industry references in the document.

For each field, also provide a confidence score from 0.0 to 1.0.

Respond ONLY with valid JSON in this exact format:
{
  "clientName": "string or null",
  "projectName": "string or null",
  "techStack": "ENUM_VALUE or null",
  "engagementType": "ENUM_VALUE or null",
  "industry": "ENUM_VALUE or null",
  "confidence": {
    "clientName": 0.0,
    "projectName": 0.0,
    "techStack": 0.0,
    "engagementType": 0.0,
    "industry": 0.0
  }
}`;

  try {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Extract engagement details from this TOR document text:\n\n${truncated}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as InferredFields;

    // Validate enum values — null out invalid ones
    if (parsed.techStack && !VALID_TECH_STACKS.includes(parsed.techStack)) {
      parsed.techStack = null;
      parsed.confidence.techStack = 0;
    }
    if (
      parsed.engagementType &&
      !VALID_ENGAGEMENT_TYPES.includes(parsed.engagementType)
    ) {
      parsed.engagementType = null;
      parsed.confidence.engagementType = 0;
    }
    if (parsed.industry && !VALID_INDUSTRIES.includes(parsed.industry)) {
      parsed.industry = null;
      parsed.confidence.industry = 0;
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[infer] Failed to infer engagement fields:", err);
    return NextResponse.json(
      { error: "AI inference failed" },
      { status: 500 }
    );
  }
}
