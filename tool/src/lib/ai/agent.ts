import { mkdir } from "fs/promises";
import path from "path";

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

export async function prepareWorkDir(engagementId: string): Promise<string> {
  const baseDir = path.join("/data/engagements", engagementId);

  const subdirs = [
    baseDir,
    path.join(baseDir, "tor"),
    path.join(baseDir, "research"),
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

export async function* runPhase(
  config: PhaseConfig
): AsyncGenerator<ProgressEvent> {
  // Stub implementation — real Claude Agent SDK integration added later
  yield {
    type: "progress",
    message: `Starting phase ${config.phase} for engagement ${config.engagementId}`,
  };

  yield {
    type: "progress",
    tool: "Read",
    message: "Reading TOR document...",
  };

  yield {
    type: "progress",
    tool: "Write",
    message: "Writing analysis output...",
  };

  yield {
    type: "complete",
    content: `Phase ${config.phase} completed successfully (stub).`,
  };
}
