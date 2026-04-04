import Anthropic from "@anthropic-ai/sdk";
import { mkdir, writeFile, readFile, readdir, stat } from "fs/promises";
import path from "path";
import { listObjects, downloadFile, uploadFile } from "@/lib/storage";
import { getToolDefinitions, getToolHandlers } from "@/lib/ai/tools";
import { summarizeTool } from "@/lib/ai/hooks";

export interface PhaseConfig {
  engagementId: string;
  phase: number;
  techStack: string;
  tools: string[];
  maxTurns: number;
  systemPrompt: string;
  userPrompt: string;
}

export interface ProgressEvent {
  type: "progress" | "complete" | "error";
  tool?: string;
  message?: string;
  content?: string;
}

const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

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
    const keys = await listObjects(prefix);

    for (const key of keys) {
      const filename = path.basename(key);
      if (!filename) continue;

      const localPath = path.join(workDir, "tor", filename);
      const buffer = await downloadFile(key);
      await writeFile(localPath, buffer);
      synced.push(filename);
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

  // 3. Build tool definitions and handlers
  const tools = getToolDefinitions(config.tools);
  const handlers = getToolHandlers(config.engagementId, workDir);

  // 4. Initialize conversation
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: config.userPrompt },
  ];

  let turns = 0;

  // 5. Agentic loop
  while (turns < config.maxTurns) {
    turns++;
    yield {
      type: "progress",
      message: `Turn ${turns}/${config.maxTurns}`,
    };

    let response: Anthropic.Messages.Message;
    try {
      response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16384,
        system: config.systemPrompt,
        tools,
        messages,
      });
    } catch (err) {
      yield {
        type: "error",
        message: `API error: ${err instanceof Error ? err.message : String(err)}`,
      };
      return;
    }

    // Check if Claude is done (no more tool calls)
    if (response.stop_reason === "end_turn") {
      const textContent = response.content
        .filter(
          (b): b is Anthropic.Messages.TextBlock => b.type === "text"
        )
        .map((b) => b.text)
        .join("\n");

      yield { type: "complete", content: textContent };
      return;
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls and not end_turn — extract any text and finish
      const textContent = response.content
        .filter(
          (b): b is Anthropic.Messages.TextBlock => b.type === "text"
        )
        .map((b) => b.text)
        .join("\n");

      yield { type: "complete", content: textContent };
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
    const finalResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      system: config.systemPrompt,
      messages,
    });

    const finalText = finalResponse.content
      .filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      )
      .map((b) => b.text)
      .join("\n");

    yield { type: "complete", content: finalText };
  } catch (err) {
    yield {
      type: "error",
      message: `Final response error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
