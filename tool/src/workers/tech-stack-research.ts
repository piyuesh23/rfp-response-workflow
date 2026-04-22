/**
 * Tech-stack research worker.
 *
 * Runs once per engagement when `Engagement.techStackIsCustom === true`.
 * Queries Tavily for ecosystem context on the user-supplied stack description,
 * synthesises an ecosystem summary + benchmark table via Claude Sonnet, and
 * persists the result as a `TechStackResearch` row for downstream consumption
 * by the Phase 1A estimate prompt.
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const SONNET_MODEL = "claude-sonnet-4-20250514";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const TAVILY_MAX_RESULTS = 6;

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

interface ResearchSource {
  url: string;
  title: string;
  fetchedAt: string;
}

interface ResearchOutput {
  ecosystemSummary: string;
  benchmarksMarkdown: string;
  sources: ResearchSource[];
}

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }
  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      max_results: TAVILY_MAX_RESULTS,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tavily search failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { results?: TavilyResult[] };
  return Array.isArray(data.results) ? data.results : [];
}

function buildQueries(stackDescription: string): string[] {
  const core = stackDescription.slice(0, 200);
  return [
    `${core} ecosystem 2025 major libraries frameworks`,
    `${core} typical project structure developer community`,
    `${core} deployment hosting patterns production`,
    `${core} development effort estimation hours benchmarks`,
  ];
}

function renderSearchContext(results: TavilyResult[]): string {
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${(r.content || "").slice(0, 800)}`)
    .join("\n\n---\n\n");
}

async function synthesise(
  stackDescription: string,
  searchContext: string
): Promise<{ ecosystemSummary: string; benchmarksMarkdown: string }> {
  const anthropic = new Anthropic();
  const systemPrompt = `You are a senior solutions architect producing pre-engagement technical research for a presales team. You produce grounded, citation-based summaries from web search results — no hallucinated claims. When a claim cannot be supported by the search context, omit it or mark it as "assumed" with justification.`;

  const userPrompt = `Research the following technology stack for a presales estimation engagement. Output two sections.

## Stack Description (verbatim from user)
${stackDescription}

## Web Search Context

${searchContext}

---

## Required Output Format

Produce exactly two markdown sections, in this order, with these exact heading names:

### ECOSYSTEM_SUMMARY

A 300-500 word summary covering:
- Major frameworks / libraries commonly paired with this stack (cite source number in brackets, e.g. [1])
- Typical hosting and deployment patterns
- Developer community health (package registry activity, documentation quality, learning curve)
- Typical team composition for a mid-size build (rough role mix and seniority)
- Notable gotchas, licensing concerns, or enterprise-readiness caveats
- Common integration patterns for auth, content management, search, and data persistence

### BENCHMARK_TABLE

A markdown table with these EXACT columns, 12-18 rows:

| BenchmarkKey | Task | Category | Complexity | LowHrs | HighHrs | Notes |

Where:
- BenchmarkKey: dot-separated short identifier (e.g. "backend.install.base", "integration.api.rest.t2", "frontend.component.header")
- Task: the task name
- Category: one of { backend, frontend, integration, devops, qa, migration, ai }
- Complexity: one of { T1, T2, T3 } — T1 simple (8-16h), T2 standard (16-32h), T3 complex (32-60h) — for integrations; for other categories use T1/T2/T3 as rough complexity buckets
- LowHrs / HighHrs: integers, realistic for a mid-senior developer in this stack's idioms
- Notes: 1 sentence explaining the scope or ecosystem-native approach

The table MUST cover these always-include backend activities (adapt the names to the stack's idioms): discovery & requirements analysis, environment setup, platform installation & base configuration, configuration management / secrets, roles & permissions, deployment pipeline, QA & stabilisation. Add 5-11 additional rows covering this stack's common feature areas (content modelling, frontend component work, integrations at T1/T2/T3, media/asset handling, migrations if applicable).

Do NOT add any other sections, any preamble, or any closing remarks. Begin your response with the literal text "### ECOSYSTEM_SUMMARY".`;

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const ecoMatch = text.match(/### ECOSYSTEM_SUMMARY\s*([\s\S]*?)(?:### BENCHMARK_TABLE|$)/);
  const tableMatch = text.match(/### BENCHMARK_TABLE\s*([\s\S]*)$/);
  const ecosystemSummary = ecoMatch?.[1]?.trim() ?? text.trim();
  const benchmarksMarkdown = tableMatch?.[1]?.trim() ?? "";

  if (!ecosystemSummary || !benchmarksMarkdown) {
    throw new Error("Tech-stack research synthesis produced incomplete output");
  }

  return { ecosystemSummary, benchmarksMarkdown };
}

export async function runTechStackResearch(engagementId: string): Promise<ResearchOutput> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, techStackCustom: true, techStackIsCustom: true },
  });
  if (!engagement) throw new Error(`Engagement ${engagementId} not found`);
  if (!engagement.techStackIsCustom) {
    throw new Error(`Engagement ${engagementId} is not flagged techStackIsCustom — research skipped`);
  }
  const stackDescription = engagement.techStackCustom?.trim();
  if (!stackDescription || stackDescription.length < 10) {
    throw new Error(`Engagement ${engagementId} has no usable techStackCustom`);
  }

  const queries = buildQueries(stackDescription);
  const resultsPerQuery = await Promise.all(queries.map((q) => tavilySearch(q).catch(() => [])));
  const seen = new Set<string>();
  const merged: TavilyResult[] = [];
  for (const batch of resultsPerQuery) {
    for (const r of batch) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      merged.push(r);
      if (merged.length >= 12) break;
    }
  }

  if (merged.length === 0) {
    throw new Error("Tech-stack research failed: no web results returned from Tavily");
  }

  const { ecosystemSummary, benchmarksMarkdown } = await synthesise(
    stackDescription,
    renderSearchContext(merged)
  );

  const sources: ResearchSource[] = merged.slice(0, 10).map((r) => ({
    url: r.url,
    title: r.title,
    fetchedAt: new Date().toISOString(),
  }));

  const sourcesJson = sources as unknown as Prisma.InputJsonValue;
  await prisma.techStackResearch.upsert({
    where: { engagementId },
    create: {
      engagementId,
      stackDescription,
      ecosystemSummary,
      benchmarksMarkdown,
      sourcesJson,
      provider: "tavily",
    },
    update: {
      stackDescription,
      ecosystemSummary,
      benchmarksMarkdown,
      sourcesJson,
      provider: "tavily",
    },
  });

  return { ecosystemSummary, benchmarksMarkdown, sources };
}

export async function getOrRunTechStackResearch(
  engagementId: string
): Promise<ResearchOutput | null> {
  const existing = await prisma.techStackResearch.findUnique({ where: { engagementId } });
  if (existing) {
    return {
      ecosystemSummary: existing.ecosystemSummary,
      benchmarksMarkdown: existing.benchmarksMarkdown,
      sources: (existing.sourcesJson as unknown as ResearchSource[]) ?? [],
    };
  }
  return runTechStackResearch(engagementId);
}
