import Anthropic from "@anthropic-ai/sdk";
import { mkdir, writeFile, readFile, readdir, stat } from "fs/promises";
import path from "path";
import { listObjects, downloadFile, uploadFile } from "@/lib/storage";
import { getToolDefinitions, getToolHandlers } from "@/lib/ai/tools";
import { summarizeTool } from "@/lib/ai/hooks";
import { prisma } from "@/lib/db";
import {
  loadPromptConfig,
  loadAllBenchmarks,
  loadPhaseTemplate,
  interpolatePrompt,
} from "@/lib/ai/prompt-loader";

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
 * Priority order:
 *   1. PromptConfig BENCHMARK records (admin-editable via DB)
 *   2. Benchmark structured records (prisma.benchmark table)
 *   3. Markdown files on disk
 */
async function loadBenchmarks(): Promise<string> {
  // Try loading from PromptConfig BENCHMARK category first (admin-editable)
  try {
    const promptBenchmarks = await loadAllBenchmarks();
    if (promptBenchmarks) {
      return `\n\n---\n\n## Reference Benchmarks\n\nUse these effort ranges to calibrate your estimates. Flag significant deviations.\n\n${promptBenchmarks}`;
    }
  } catch {
    // Fall through to structured benchmark table
  }

  // Try loading from database first
  try {
    const dbBenchmarks = await prisma.benchmark.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { taskType: "asc" }],
    });

    if (dbBenchmarks.length > 0) {
      // Format as a structured lookup table for precise benchmark referencing
      const toSlug = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const tableRows = dbBenchmarks.map((b) => {
        const key = `${toSlug(b.category)}/${toSlug(b.taskType)}`;
        const tier = b.tier ?? "-";
        const notes = b.notes ?? "";
        return `| ${key} | ${b.category} | ${b.taskType} | ${b.techStack} | ${tier} | ${b.lowHours} | ${b.highHours} | ${notes} |`;
      });

      const header = `| BenchmarkKey | Category | TaskType | TechStack | Tier | LowHrs | HighHrs | Notes |\n|---|---|---|---|---|---|---|---|`;
      const table = `${header}\n${tableRows.join("\n")}`;

      const instructions = `## Reference Benchmarks — Lookup Table

Use this table to anchor every Backend and Frontend estimate line item to a known benchmark range.

**For each Backend/Frontend line item you write:**
1. Find the closest BenchmarkKey by matching Category + TaskType to your task
2. Set the \`BenchmarkRef\` column to that BenchmarkKey (e.g., \`content-architecture/simple-content-type\`)
3. Your \`Hours\` estimate MUST fall within the LowHrs–HighHrs range for the matched benchmark
4. If Hours falls outside the range, add \`BENCHMARK DEVIATION: [reason]\` at the start of the Assumptions column
5. If no benchmark matches, write \`N/A\` in BenchmarkRef and briefly explain why in Assumptions

**Deviations > 25% from the mid-point ((LowHrs + HighHrs) / 2) require a written justification. No silent outliers.**`;

      return `\n\n---\n\n${instructions}\n\n${table}`;
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
 * Priority order:
 *   1. PromptConfig TEMPLATE records (admin-editable via DB)
 *   2. Markdown files on disk
 */
async function loadTemplate(phaseNumber: string): Promise<string> {
  // Try loading from PromptConfig TEMPLATE category first (admin-editable)
  try {
    const dbTemplate = await loadPhaseTemplate(phaseNumber);
    if (dbTemplate) return dbTemplate;
  } catch {
    // Fall through to filesystem loading
  }

  // Phases can have multiple templates (e.g., Phase 1A has solution architecture + estimate)
  const templateMap: Record<string, string[]> = {
    "0": ["customer-research-template.md"],
    "1": ["tor-assessment-template.md"],
    "1A": ["solution-architecture-template.md", "optimistic-estimate-template.md"],
    "3": ["solution-architecture-template.md", "optimistic-estimate-template.md"],
    "3R": ["gap-analysis-template.md"],
    "4": ["gap-analysis-template.md"],
  };

  const templateFiles = templateMap[phaseNumber];
  if (!templateFiles || templateFiles.length === 0) return "";

  const templateDir = "/app/templates";
  const fallbackDir = path.join(process.cwd(), "templates");

  const sections: string[] = [];
  for (const templateFile of templateFiles) {
    for (const dir of [templateDir, fallbackDir]) {
      try {
        const content = await readFile(path.join(dir, templateFile), "utf-8");
        const label = templateFile.replace(".md", "").replace(/-/g, " ");
        sections.push(`## Output Template: ${label}\n\nFollow this structure:\n\n${content}`);
        break; // Found in this dir, skip fallback
      } catch {
        continue;
      }
    }
  }

  if (sections.length === 0) return "";
  return `\n\n---\n\n${sections.join("\n\n---\n\n")}`;
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

  // For Phase 1A/3: inject prior estimate totals as a calibration anchor.
  // Probe in priority order: informed (Phase 3) > optimistic (Phase 1A) > revised.
  if (["1A", "3"].includes(currentPhase)) {
    const ESTIMATE_CANDIDATES = [
      path.join(workDir, "estimates", "informed-estimate.md"),
      path.join(workDir, "estimates", "optimistic-estimate.md"),
      path.join(workDir, "estimates", "revised-estimate.md"),
    ];
    let priorEstimateContent: string | null = null;
    for (const candidate of ESTIMATE_CANDIDATES) {
      try { priorEstimateContent = await readFile(candidate, "utf-8"); break; } catch { /* try next */ }
    }
    try {
      if (!priorEstimateContent) throw new Error("no estimate");
      const totals = extractPriorEstimateTotals(priorEstimateContent);
      if (totals) {
        sections.push(`### Prior Estimate (for calibration — do NOT copy blindly)

A previous estimate for this engagement produced these totals:
- Backend total: ~${totals.backend.low}–${totals.backend.high}h
- Frontend total: ~${totals.frontend.low}–${totals.frontend.high}h
- Fixed Cost total: ~${totals.fixedCost.low}–${totals.fixedCost.high}h
${totals.ai.high > 0 ? `- AI total: ~${totals.ai.low}–${totals.ai.high}h\n` : ""}- **Overall total: ~${totals.total.low}–${totals.total.high}h**

Individual line-item deviations > 25% from the prior estimate require justification.
Use this as a calibration anchor, not a ceiling — if new information warrants different numbers, explain why.`);
      }
    } catch {
      // No prior estimate — this is the first run
    }
  }

  if (sections.length === 0) return "";
  return `\n\n---\n\n## Context from Prior Phases\n\nThe following artefacts were produced by earlier phases. Use them to inform your analysis.\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Extract tab-level totals from a prior estimate's Summary table.
 * Returns null if the summary table can't be parsed.
 */
function extractPriorEstimateTotals(markdown: string): {
  backend: { low: number; high: number };
  frontend: { low: number; high: number };
  fixedCost: { low: number; high: number };
  ai: { low: number; high: number };
  total: { low: number; high: number };
} | null {
  const lines = markdown.split("\n");
  let inSummary = false;
  let pastSeparator = false;
  let headerCells: string[] | null = null;

  const result = {
    backend: { low: 0, high: 0 },
    frontend: { low: 0, high: 0 },
    fixedCost: { low: 0, high: 0 },
    ai: { low: 0, high: 0 },
    total: { low: 0, high: 0 },
  };
  let found = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+Summary/i.test(trimmed)) {
      inSummary = true;
      headerCells = null;
      pastSeparator = false;
      continue;
    }

    if (inSummary && /^#{1,3}\s/.test(trimmed) && !/^##\s+Summary/i.test(trimmed)) {
      break;
    }

    if (!inSummary || !trimmed.startsWith("|")) continue;

    if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      if (headerCells) pastSeparator = true;
      continue;
    }

    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());

    if (!headerCells) {
      headerCells = cells;
      continue;
    }

    if (!pastSeparator) continue;

    const h = headerCells.map((c) => c.toLowerCase().replace(/\*+/g, "").trim());
    const lowCol = h.findIndex((c) => c.includes("low"));
    const highCol = h.findIndex((c) => c.includes("high"));
    if (lowCol < 0 || highCol < 0) continue;

    const tabName = (cells[0] ?? "").toLowerCase().replace(/\*+/g, "").trim();
    const low = parseFloat((cells[lowCol] ?? "").replace(/[*,]/g, ""));
    const high = parseFloat((cells[highCol] ?? "").replace(/[*,]/g, ""));

    if (isNaN(low) || isNaN(high)) continue;

    if (tabName.includes("backend")) { result.backend = { low, high }; found = true; }
    else if (tabName.includes("frontend")) { result.frontend = { low, high }; found = true; }
    else if (tabName.includes("fixed")) { result.fixedCost = { low, high }; found = true; }
    else if (tabName.includes("ai")) { result.ai = { low, high }; found = true; }
    else if (tabName.includes("total")) { result.total = { low, high }; found = true; }
  }

  if (!found) return null;

  // Compute total from tabs if not found in summary
  if (result.total.low === 0 && result.total.high === 0) {
    result.total.low = result.backend.low + result.frontend.low + result.fixedCost.low + result.ai.low;
    result.total.high = result.backend.high + result.frontend.high + result.fixedCost.high + result.ai.high;
  }

  return result;
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
 *
 * Optimizations:
 * - Skips download if local file already exists with matching size
 * - Skips PDF extraction if .md already exists on disk
 * - Checks for pre-extracted .md in MinIO (cached at upload time)
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

      // Skip download if local file already exists
      let needsDownload = true;
      try {
        const localStat = await stat(localPath);
        if (localStat.size > 0) {
          needsDownload = false;
        }
      } catch {
        // File doesn't exist locally — need to download
      }

      let buffer: Buffer | undefined;
      if (needsDownload) {
        buffer = await downloadFile(key);
        await writeFile(localPath, buffer);
      }
      synced.push(filename);

      // Auto-extract PDF text to .md for easier agent consumption
      if (isPdf(filename)) {
        const mdPath = localPath.replace(/\.pdf$/i, ".md");

        // Skip extraction if .md already exists on disk (cached from prior run)
        try {
          const mdStat = await stat(mdPath);
          if (mdStat.size > 100) {
            synced.push(filename.replace(/\.pdf$/i, ".md"));
            continue; // Already extracted — skip
          }
        } catch {
          // .md doesn't exist — need to extract
        }

        // Check if pre-extracted .md exists in MinIO (cached at upload time)
        const mdKey = key.replace(/\.pdf$/i, ".md");
        if (keys.includes(mdKey)) {
          try {
            const mdBuffer = await downloadFile(mdKey);
            if (mdBuffer.length > 100) {
              await writeFile(mdPath, mdBuffer);
              synced.push(filename.replace(/\.pdf$/i, ".md"));
              continue; // Got cached .md from MinIO — skip extraction
            }
          } catch {
            // Fall through to extraction
          }
        }

        // Full extraction as last resort
        try {
          if (!buffer) buffer = await readFile(localPath);
          const result = await extractTextFromPdf(buffer);
          const markdown = pdfTextToMarkdown(result, filename);
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
 * Sync files from a non-TOR engagement directory (e.g. responses_qna, estimates)
 * from MinIO to the local work directory. Called for phases that need access to
 * uploaded documents beyond the TOR itself.
 * Non-fatal: storage unavailability is logged and swallowed.
 */
async function syncAdditionalDirectory(
  engagementId: string,
  workDir: string,
  dirName: string
): Promise<number> {
  const prefix = `engagements/${engagementId}/${dirName}/`;
  let synced = 0;
  try {
    const keys = await listObjects(prefix);
    for (const key of keys) {
      const filename = path.basename(key);
      if (!filename) continue;
      const localPath = path.join(workDir, dirName, filename);
      try {
        const localStat = await stat(localPath);
        if (localStat.size > 0) continue; // Already on disk
      } catch {
        // File doesn't exist locally — download it
      }
      const buffer = await downloadFile(key);
      await mkdir(path.dirname(localPath), { recursive: true });
      await writeFile(localPath, buffer);
      synced++;
    }
  } catch (err) {
    console.warn(
      `[agent] Could not sync ${dirName}/ from storage: ${err instanceof Error ? err.message : String(err)}`
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

  // 2b. Sync additional phase-specific directories (responses_qna, estimates)
  const phaseStr0 = String(config.phase);
  if (["2", "3", "3R", "4"].includes(phaseStr0)) {
    const responseCount = await syncAdditionalDirectory(config.engagementId, workDir, "responses_qna");
    if (responseCount > 0) {
      yield { type: "progress", message: `Synced ${responseCount} response file(s) from storage` };
    }
  }
  if (["3", "3R", "4"].includes(phaseStr0)) {
    await syncAdditionalDirectory(config.engagementId, workDir, "estimates");
  }

  // 3. Enrich context: benchmarks, templates, prior phase artefacts
  yield { type: "progress", message: "Loading benchmarks and prior context..." };

  const phaseStr = String(config.phase);
  const [benchmarks, template, priorContext] = await Promise.all([
    loadBenchmarks(),
    loadTemplate(phaseStr),
    collectPriorContext(config.engagementId, phaseStr, workDir),
  ]);

  // 3b. Try to load prompt components from DB (admin-editable overrides).
  // If DB returns content for system-base and/or carl-rules, reconstruct the
  // system prompt from those DB versions. Falls back to config.systemPrompt
  // (the hardcoded defaults) when the DB has no record.
  let baseSystemPrompt = config.systemPrompt;
  try {
    const [dbSystemBase, dbCarlRules, dbPhasePrompt] = await Promise.all([
      loadPromptConfig("system-base"),
      loadPromptConfig("carl-rules"),
      loadPromptConfig(`phase-${phaseStr.toLowerCase()}`),
    ]);

    const resolvedSystemBase = dbSystemBase
      ? interpolatePrompt(dbSystemBase, { techStack: config.techStack })
      : null;
    const resolvedCarlRules = dbCarlRules ?? null;
    const resolvedPhasePrompt = dbPhasePrompt
      ? interpolatePrompt(dbPhasePrompt, {
          techStack: config.techStack,
          engagementType: "", // engagementType not on PhaseConfig; interpolation is a no-op if placeholder absent
        })
      : null;

    // Only override if at least system-base is available from DB
    if (resolvedSystemBase) {
      const parts: string[] = [resolvedSystemBase];
      if (resolvedCarlRules) parts.push(resolvedCarlRules);
      baseSystemPrompt = parts.join("\n\n---\n\n");
    }

    // If a DB phase prompt exists, override config.userPrompt
    // (userPrompt is the phase-specific instruction, separate from systemPrompt)
    if (resolvedPhasePrompt) {
      config = { ...config, userPrompt: resolvedPhasePrompt };
    }
  } catch {
    // DB unavailable — fall back to hardcoded config.systemPrompt
  }

  // Enrich system prompt with benchmarks and template
  const enrichedSystemPrompt = baseSystemPrompt + benchmarks + template;

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

    yield {
      type: "progress",
      tool: "Claude",
      message: `Calling API (turn ${turns}/${config.maxTurns})…`,
    };

    let response: Anthropic.Messages.Message;
    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 16384,
        system: enrichedSystemPrompt,
        tools,
        messages,
      });

      // Consume the stream event-by-event so we can emit heartbeat progress
      // events during long Opus generations. Without this, the SSE connection
      // goes silent for the full API response time (can be 10-20 min on large
      // contexts), which appears identical to a hang.
      let outputTokenCount = 0;
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          outputTokenCount++;
          if (outputTokenCount % 60 === 0) {
            yield {
              type: "progress",
              tool: "Claude",
              message: `Generating response… (~${outputTokenCount} tokens)`,
            };
          }
        }
      }

      // finalMessage() resolves immediately after the stream is consumed
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
