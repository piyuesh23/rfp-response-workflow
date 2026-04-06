import Anthropic from "@anthropic-ai/sdk";
import { mkdir, writeFile, readFile, readdir, stat } from "fs/promises";
import path from "path";
import { listObjects, downloadFile, uploadFile } from "@/lib/storage";
import { getToolDefinitions, getToolHandlers } from "@/lib/ai/tools";
import { summarizeTool } from "@/lib/ai/hooks";
import { prisma } from "@/lib/db";

export interface PhaseConfig {
  engagementId: string;
  phase: number;
  techStack: string;
  tools: string[];
  maxTurns: number;
  systemPrompt: string;
  userPrompt: string;
  /** Override model for this phase (e.g., opus for estimation) */
  model?: string;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  apiCallCount: number;
  turnCount: number;
  modelId: string;
}

export interface ProgressEvent {
  type: "progress" | "complete" | "error";
  tool?: string;
  message?: string;
  content?: string;
  usageStats?: UsageStats;
}

const DEFAULT_MODEL =
  process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
const OPUS_MODEL = "claude-opus-4-20250514";

/** Phases that benefit from Opus-level reasoning */
const OPUS_PHASES = new Set(["1A", "3", "3R", "4"]);

/**
 * Determine the model to use for a phase.
 * Estimation, review, and gap analysis phases use Opus for deeper reasoning.
 */
function getModelForPhase(config: PhaseConfig): string {
  if (config.model) return config.model;
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;
  if (OPUS_PHASES.has(String(config.phase))) return OPUS_MODEL;
  return DEFAULT_MODEL;
}

/**
 * Load benchmark files and inject them into the system prompt.
 * These provide reference effort ranges for estimation calibration.
 * First tries the database; falls back to markdown files on disk if DB is empty.
 */
async function loadBenchmarks(): Promise<string> {
  // Try loading from database first
  try {
    const dbBenchmarks = await prisma.benchmark.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { taskType: "asc" }],
    });

    if (dbBenchmarks.length > 0) {
      // Group by category and format as markdown sections
      const grouped: Record<string, typeof dbBenchmarks> = {};
      for (const b of dbBenchmarks) {
        if (!grouped[b.category]) grouped[b.category] = [];
        grouped[b.category].push(b);
      }

      const sections: string[] = [];
      for (const [category, items] of Object.entries(grouped)) {
        const rows = items.map((b) => {
          const tier = b.tier ? ` [${b.tier}]` : "";
          const notes = b.notes ? ` — ${b.notes}` : "";
          return `- **${b.taskType}**${tier}: ${b.lowHours}–${b.highHours} hrs (${b.techStack})${notes}`;
        });
        sections.push(`### ${category}\n\n${rows.join("\n")}`);
      }

      return `\n\n---\n\n## Reference Benchmarks\n\nUse these effort ranges to calibrate your estimates. Flag significant deviations.\n\n${sections.join("\n\n")}`;
    }
  } catch {
    // DB unavailable — fall through to file-based loading
  }

  // Fallback: read markdown files from disk
  const benchmarkDir = "/app/benchmarks";
  const fallbackDir = path.join(process.cwd(), "benchmarks");

  let dir = benchmarkDir;
  try {
    await stat(dir);
  } catch {
    dir = fallbackDir;
    try {
      await stat(dir);
    } catch {
      return "";
    }
  }

  const sections: string[] = [];
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!String(file).endsWith(".md") || String(file) === "AGENTS.md") continue;
      const content = await readFile(path.join(dir, String(file)), "utf-8");
      sections.push(`### ${String(file).replace(".md", "").replace(/-/g, " ")}\n\n${content}`);
    }
  } catch {
    return "";
  }

  if (sections.length === 0) return "";
  return `\n\n---\n\n## Reference Benchmarks\n\nUse these effort ranges to calibrate your estimates. Flag significant deviations.\n\n${sections.join("\n\n")}`;
}

/**
 * Load the output template for a specific phase.
 */
async function loadTemplate(phaseNumber: string): Promise<string> {
  const templateMap: Record<string, string> = {
    "0": "customer-research-template.md",
    "1": "tor-assessment-template.md",
    "1A": "optimistic-estimate-template.md",
    "3": "estimate-review-template.md",
    "3R": "gap-analysis-template.md",
    "4": "gap-analysis-template.md",
  };

  const templateFile = templateMap[phaseNumber];
  if (!templateFile) return "";

  const templateDir = "/app/templates";
  const fallbackDir = path.join(process.cwd(), "templates");

  for (const dir of [templateDir, fallbackDir]) {
    try {
      const content = await readFile(path.join(dir, templateFile), "utf-8");
      return `\n\n---\n\n## Output Template\n\nFollow this structure exactly:\n\n${content}`;
    } catch {
      continue;
    }
  }
  return "";
}

/**
 * Collect prior phase artefacts and format them as context for the current phase.
 * This ensures phases build on each other's outputs.
 */
async function collectPriorContext(
  engagementId: string,
  currentPhase: string,
  workDir: string
): Promise<string> {
  // Map of which prior phases to include for each phase
  const contextMap: Record<string, string[]> = {
    "1": ["research"],                          // TOR Assessment reads research
    "1A": ["research", "claude-artefacts"],     // Estimation reads research + TOR assessment
    "2": ["initial_questions"],                 // Response analysis reads questions
    "3": ["claude-artefacts", "responses_qna"], // Estimate review reads artefacts + responses
    "3R": ["claude-artefacts", "responses_qna", "estimates"], // Review+Gap reads everything
    "4": ["claude-artefacts", "responses_qna", "estimates"],
    "5": ["claude-artefacts", "research", "estimates"],
  };

  const dirs = contextMap[currentPhase];
  if (!dirs || dirs.length === 0) return "";

  const sections: string[] = [];

  for (const dir of dirs) {
    const dirPath = path.join(workDir, dir);
    try {
      const files = await readdir(dirPath);
      for (const file of files) {
        const fileName = String(file);
        if (!fileName.endsWith(".md")) continue;
        const content = await readFile(path.join(dirPath, fileName), "utf-8");
        if (content.length > 50000) {
          // Truncate very large files
          sections.push(`### Prior Artefact: ${dir}/${fileName} (truncated)\n\n${content.slice(0, 50000)}\n\n[... truncated at 50,000 characters]`);
        } else {
          sections.push(`### Prior Artefact: ${dir}/${fileName}\n\n${content}`);
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }

  if (sections.length === 0) return "";
  return `\n\n---\n\n## Context from Prior Phases\n\nThe following artefacts were produced by earlier phases. Use them to inform your analysis.\n\n${sections.join("\n\n---\n\n")}`;
}

export async function prepareWorkDir(engagementId: string): Promise<string> {
  const baseDir = path.join("/data/engagements", engagementId);

  const subdirs = [
    baseDir,
    path.join(baseDir, "tor"),
    path.join(baseDir, "research"),
    path.join(baseDir, "research", "csv"),
    path.join(baseDir, "initial_questions"),
    path.join(baseDir, "responses_qna"),
    path.join(baseDir, "estimates"),
    path.join(baseDir, "claude-artefacts"),
  ];

  for (const dir of subdirs) {
    await mkdir(dir, { recursive: true });
  }

  return baseDir;
}

/**
 * Sync TOR files from MinIO/S3 to the local engagement directory.
 * This gives the AI agent filesystem access to uploaded documents.
 */
async function syncTorFiles(
  engagementId: string,
  workDir: string
): Promise<string[]> {
  const prefix = `engagements/${engagementId}/tor/`;
  const synced: string[] = [];

  try {
    const { isPdf, extractTextFromPdf, pdfTextToMarkdown } = await import("@/lib/pdf-extractor");
    const keys = await listObjects(prefix);

    for (const key of keys) {
      const filename = path.basename(key);
      if (!filename) continue;

      const localPath = path.join(workDir, "tor", filename);
      const buffer = await downloadFile(key);
      await writeFile(localPath, buffer);
      synced.push(filename);

      // Auto-extract PDF text to .md for easier agent consumption
      if (isPdf(filename)) {
        try {
          const result = await extractTextFromPdf(buffer);
          const markdown = pdfTextToMarkdown(result, filename);
          const mdPath = localPath.replace(/\.pdf$/i, ".md");
          await writeFile(mdPath, markdown, "utf-8");
          synced.push(filename.replace(/\.pdf$/i, ".md"));
        } catch {
          // PDF extraction failure is non-fatal
        }
      }
    }
  } catch (err) {
    // MinIO may not be running in local dev — this is non-fatal
    console.warn(
      `[agent] Could not sync TOR files from storage: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return synced;
}

/**
 * Sync all files from the local engagement directory back to MinIO/S3.
 * Called after a phase completes to persist generated artefacts.
 * Skips the tor/ directory (those are source files, not generated).
 */
export async function syncFilesToStorage(
  engagementId: string,
  workDir: string
): Promise<number> {
  let uploadCount = 0;

  try {
    const allFiles = await readdir(workDir, { recursive: true });

    for (const relPath of allFiles) {
      const relStr = String(relPath);

      // Skip tor/ directory (source files, already in MinIO)
      if (relStr.startsWith("tor/") || relStr.startsWith("tor\\")) continue;

      const absPath = path.join(workDir, relStr);

      // Skip directories
      try {
        const stats = await stat(absPath);
        if (!stats.isFile()) continue;
      } catch {
        continue;
      }

      const s3Key = `engagements/${engagementId}/${relStr.replace(/\\/g, "/")}`;
      const content = await readFile(absPath);

      // Determine content type
      const ext = path.extname(relStr).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        ".md": "text/markdown",
        ".csv": "text/csv",
        ".json": "application/json",
        ".txt": "text/plain",
        ".html": "text/html",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".pdf": "application/pdf",
      };
      const contentType = contentTypeMap[ext] ?? "application/octet-stream";

      await uploadFile(s3Key, content, contentType);
      uploadCount++;
    }
  } catch (err) {
    console.warn(
      `[agent] Could not sync files to storage: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return uploadCount;
}

/**
 * Run a presales phase using the Anthropic Messages API with tool_use.
 *
 * This implements an agentic loop: Claude receives the phase prompt,
 * makes tool calls (read files, write output, search, etc.), and
 * continues until it produces a final text response or maxTurns is hit.
 */
export async function* runPhase(
  config: PhaseConfig
): AsyncGenerator<ProgressEvent> {
  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    yield {
      type: "error",
      message:
        "ANTHROPIC_API_KEY is not set. Please configure it in your environment variables.",
      usageStats: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        apiCallCount: 0,
        turnCount: 0,
        modelId: "",
      },
    };
    return;
  }

  const anthropic = new Anthropic();

  yield {
    type: "progress",
    message: `Starting phase ${config.phase} for engagement ${config.engagementId}`,
  };

  // 1. Prepare local working directory
  const workDir = await prepareWorkDir(config.engagementId);

  // 2. Sync TOR files from MinIO to local disk
  yield { type: "progress", message: "Syncing documents from storage..." };
  const syncedFiles = await syncTorFiles(config.engagementId, workDir);
  if (syncedFiles.length > 0) {
    yield {
      type: "progress",
      message: `Synced ${syncedFiles.length} file(s): ${syncedFiles.join(", ")}`,
    };
  } else {
    yield {
      type: "progress",
      message:
        "No TOR files found in storage. The agent will work with whatever files exist locally.",
    };
  }

  // 3. Enrich context: benchmarks, templates, prior phase artefacts
  yield { type: "progress", message: "Loading benchmarks and prior context..." };

  const phaseStr = String(config.phase);
  const [benchmarks, template, priorContext] = await Promise.all([
    loadBenchmarks(),
    loadTemplate(phaseStr),
    collectPriorContext(config.engagementId, phaseStr, workDir),
  ]);

  // Enrich system prompt with benchmarks and template
  const enrichedSystemPrompt = config.systemPrompt + benchmarks + template;

  // Enrich user prompt with prior phase artefacts
  const enrichedUserPrompt = config.userPrompt + priorContext;

  // Select model (Opus for estimation phases, Sonnet for others)
  const model = getModelForPhase(config);
  yield {
    type: "progress",
    message: `Using model: ${model}${benchmarks ? " | Benchmarks loaded" : ""}${template ? " | Template loaded" : ""}${priorContext ? " | Prior context injected" : ""}`,
  };

  // 4. Build tool definitions and handlers
  const tools = getToolDefinitions(config.tools);
  const handlers = getToolHandlers(config.engagementId, workDir);

  // 4. Initialize conversation
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: enrichedUserPrompt },
  ];

  let turns = 0;

  // Usage accumulator
  const usageStats: UsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    apiCallCount: 0,
    turnCount: 0,
    modelId: model,
  };

  // 5. Agentic loop
  while (turns < config.maxTurns) {
    turns++;
    yield {
      type: "progress",
      message: `Turn ${turns}/${config.maxTurns}`,
    };

    let response: Anthropic.Messages.Message;
    try {
      // Use streaming to avoid 10-minute timeout on long Opus requests
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 16384,
        system: enrichedSystemPrompt,
        tools,
        messages,
      });
      response = await stream.finalMessage();
    } catch (err) {
      yield {
        type: "error",
        message: `API error: ${err instanceof Error ? err.message : String(err)}`,
        usageStats,
      };
      return;
    }

    // Accumulate token usage
    usageStats.inputTokens += response.usage.input_tokens;
    usageStats.outputTokens += response.usage.output_tokens;
    usageStats.totalTokens += response.usage.input_tokens + response.usage.output_tokens;
    usageStats.apiCallCount++;

    // Check if Claude is done (no more tool calls)
    if (response.stop_reason === "end_turn") {
      usageStats.turnCount = turns;
      const textContent = response.content
        .filter(
          (b): b is Anthropic.Messages.TextBlock => b.type === "text"
        )
        .map((b) => b.text)
        .join("\n");

      yield { type: "complete", content: textContent, usageStats };
      return;
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls and not end_turn — extract any text and finish
      usageStats.turnCount = turns;
      const textContent = response.content
        .filter(
          (b): b is Anthropic.Messages.TextBlock => b.type === "text"
        )
        .map((b) => b.text)
        .join("\n");

      yield { type: "complete", content: textContent, usageStats };
      return;
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      yield {
        type: "progress",
        tool: block.name,
        message: summarizeTool(
          block.name,
          block.input as Record<string, unknown>
        ),
      };

      const handler = handlers[block.name];
      let result: string;

      if (!handler) {
        result = `Tool '${block.name}' is not available in this phase.`;
      } else {
        try {
          result = await handler(
            block.input as Record<string, unknown>
          );
        } catch (err) {
          result = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    // Append assistant response + tool results to conversation
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  // Max turns reached — request final output without tools
  usageStats.turnCount = turns;
  yield {
    type: "progress",
    message: "Max turns reached, requesting final output...",
  };

  messages.push({
    role: "user",
    content:
      "You have reached the maximum number of tool call turns. Please provide your final output now as a complete Markdown document. Do not make any further tool calls.",
  });

  try {
    const finalStream = anthropic.messages.stream({
      model,
      max_tokens: 16384,
      system: enrichedSystemPrompt,
      messages,
    });
    const finalResponse = await finalStream.finalMessage();

    // Accumulate token usage from final response
    usageStats.inputTokens += finalResponse.usage.input_tokens;
    usageStats.outputTokens += finalResponse.usage.output_tokens;
    usageStats.totalTokens += finalResponse.usage.input_tokens + finalResponse.usage.output_tokens;
    usageStats.apiCallCount++;

    const finalText = finalResponse.content
      .filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      )
      .map((b) => b.text)
      .join("\n");

    yield { type: "complete", content: finalText, usageStats };
  } catch (err) {
    yield {
      type: "error",
      message: `Final response error: ${err instanceof Error ? err.message : String(err)}`,
      usageStats,
    };
  }
}
