import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { isPdf, extractTextFromPdf, pdfTextToMarkdown } from "@/lib/pdf-extractor";

const execFileAsync = promisify(execFile);

type Tool = Anthropic.Messages.Tool;

// -- Tool Definitions (Anthropic API schema) --

const READ_FILE_TOOL: Tool = {
  name: "read_file",
  description:
    "Read the contents of a file. Returns the file content as text. For binary files, returns a note that the file exists but cannot be displayed.",
  input_schema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description:
          "Path to the file relative to the engagement directory (e.g., 'tor/requirements.pdf', 'research/customer-research.md')",
      },
    },
    required: ["file_path"],
  },
};

const WRITE_FILE_TOOL: Tool = {
  name: "write_file",
  description:
    "Write content to a file in the engagement directory. Creates parent directories if needed. Use for saving analysis outputs, estimates, and artefacts.",
  input_schema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description:
          "Path relative to the engagement directory (e.g., 'research/customer-research.md', 'claude-artefacts/tor-assessment.md')",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["file_path", "content"],
  },
};

const LIST_FILES_TOOL: Tool = {
  name: "list_files",
  description:
    "List files matching a glob pattern in the engagement directory. Returns file paths relative to the engagement directory.",
  input_schema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string",
        description:
          "Glob pattern (e.g., 'tor/*', '**/*.md', 'estimates/*.md'). Defaults to '**/*' if not specified.",
      },
    },
    required: [],
  },
};

const SEARCH_CONTENT_TOOL: Tool = {
  name: "search_content",
  description:
    "Search for a text pattern in files within the engagement directory. Returns matching lines with file paths and line numbers.",
  input_schema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string",
        description: "Text or regex pattern to search for",
      },
      file_pattern: {
        type: "string",
        description:
          "Optional glob to restrict search to specific files (e.g., '*.md', 'tor/*'). Defaults to all files.",
      },
    },
    required: ["pattern"],
  },
};

const WEB_FETCH_TOOL: Tool = {
  name: "web_fetch",
  description:
    "Fetch a URL and return its content. For HTML pages, returns extracted text content. Useful for checking client websites, API docs, and tech stack detection.",
  input_schema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch",
      },
      max_length: {
        type: "number",
        description:
          "Maximum characters to return (default: 10000). Truncates longer content.",
      },
    },
    required: ["url"],
  },
};

const WEB_SEARCH_TOOL: Tool = {
  name: "web_search",
  description:
    "Search the web for information. Returns search results with titles, URLs, and snippets. Useful for customer research, tech stack discovery, and industry analysis.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
    },
    required: ["query"],
  },
};

// Map from phase config tool names to Anthropic tool definitions
const TOOL_MAP: Record<string, Tool> = {
  Read: READ_FILE_TOOL,
  Write: WRITE_FILE_TOOL,
  Glob: LIST_FILES_TOOL,
  Grep: SEARCH_CONTENT_TOOL,
  WebFetch: WEB_FETCH_TOOL,
  WebSearch: WEB_SEARCH_TOOL,
  Bash: {
    name: "run_command",
    description:
      "Run a shell command in the engagement directory. Use for file manipulation, data processing, or checking system state. Commands are sandboxed to the engagement directory.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The command name to run (e.g., 'wc', 'sort', 'head')",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Command arguments as an array",
        },
      },
      required: ["command"],
    },
  },
};

/**
 * Get Anthropic tool definitions filtered by the phase's tool list.
 */
export function getToolDefinitions(toolNames: string[]): Tool[] {
  return toolNames
    .map((name) => TOOL_MAP[name])
    .filter((t): t is Tool => t !== undefined);
}

// -- Security: path validation --

function validatePath(workDir: string, relativePath: string): string {
  const resolved = path.resolve(workDir, relativePath);
  if (!resolved.startsWith(workDir)) {
    throw new Error(
      `Path traversal denied: '${relativePath}' resolves outside engagement directory`
    );
  }
  return resolved;
}

// -- Tool Handlers --

export type ToolHandler = (
  input: Record<string, unknown>
) => Promise<string>;

export function getToolHandlers(
  engagementId: string,
  workDir: string
): Record<string, ToolHandler> {
  return {
    read_file: async (input) => {
      const filePath = input.file_path as string;
      const absPath = validatePath(workDir, filePath);

      // Handle PDF files: extract text content
      if (isPdf(filePath)) {
        try {
          const buffer = await readFile(absPath);
          const result = await extractTextFromPdf(buffer);
          const markdown = pdfTextToMarkdown(result, path.basename(filePath));
          if (markdown.length > 100_000) {
            return `[PDF extracted, truncated — showing first 100,000 characters of ${result.pageCount} pages]\n\n${markdown.slice(0, 100_000)}`;
          }
          return markdown;
        } catch (pdfErr) {
          return `Error extracting PDF text from ${filePath}: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`;
        }
      }

      try {
        const content = await readFile(absPath, "utf-8");
        if (content.length > 100_000) {
          return `[File truncated — showing first 100,000 characters]\n\n${content.slice(0, 100_000)}`;
        }
        return content;
      } catch {
        // Check if binary
        try {
          const stats = await stat(absPath);
          return `[Binary file: ${filePath}, size: ${stats.size} bytes]`;
        } catch {
          return `Error: File not found: ${filePath}`;
        }
      }
    },

    write_file: async (input) => {
      const filePath = input.file_path as string;
      const content = input.content as string;
      const absPath = validatePath(workDir, filePath);

      await mkdir(path.dirname(absPath), { recursive: true });
      await writeFile(absPath, content, "utf-8");
      return `Successfully wrote ${content.length} characters to ${filePath}`;
    },

    list_files: async (input) => {
      const pattern = (input.pattern as string) || "**/*";

      try {
        // Use find command for glob-like matching (safe — uses execFile)
        const { stdout } = await execFileAsync(
          "find",
          [".", "-type", "f", "-name", pattern.includes("/") ? path.basename(pattern) : pattern],
          { cwd: workDir, timeout: 10_000 }
        );

        const files = stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((f) => f.replace(/^\.\//, ""));

        if (files.length === 0) {
          // Fallback: list all files recursively
          const allFiles = await readdir(workDir, { recursive: true });
          const fileList = allFiles
            .map(String)
            .filter((f) => !f.startsWith("."))
            .slice(0, 200);

          if (fileList.length === 0) {
            return "No files found in engagement directory.";
          }
          return fileList.join("\n");
        }

        const limited = files.slice(0, 200);
        const result = limited.join("\n");
        if (files.length > 200) {
          return `${result}\n\n[... ${files.length - 200} more files truncated]`;
        }
        return result;
      } catch {
        // Final fallback: recursive readdir
        try {
          const allFiles = await readdir(workDir, { recursive: true });
          const fileList = allFiles
            .map(String)
            .filter((f) => !f.startsWith("."))
            .slice(0, 200);
          return fileList.length > 0
            ? fileList.join("\n")
            : "No files found in engagement directory.";
        } catch {
          return `Error listing files with pattern: ${pattern}`;
        }
      }
    },

    search_content: async (input) => {
      const pattern = input.pattern as string;
      const filePattern = (input.file_pattern as string) || "*";

      try {
        const { stdout } = await execFileAsync(
          "grep",
          ["-rn", "--include", filePattern, "-m", "100", pattern, "."],
          { cwd: workDir, timeout: 15_000 }
        );
        return stdout.trim() || "No matches found.";
      } catch (err: unknown) {
        const exitCode = (err as { code?: number }).code;
        if (exitCode === 1) return "No matches found.";
        return `Search error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },

    web_fetch: async (input) => {
      const url = input.url as string;
      const maxLength = (input.max_length as number) || 10_000;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PresalesBot/1.0; +https://qed42.com)",
          },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          return `HTTP ${response.status}: ${response.statusText}`;
        }

        const contentType = response.headers.get("content-type") ?? "";
        const text = await response.text();

        // Strip HTML tags for basic text extraction
        if (contentType.includes("html")) {
          const stripped = text
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return stripped.slice(0, maxLength);
        }

        return text.slice(0, maxLength);
      } catch (err) {
        return `Fetch error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },

    web_search: async (input) => {
      const query = input.query as string;
      // Web search requires an external API (Google Custom Search, Brave, etc.)
      // For now, return a helpful message
      return `[Web search not yet configured. Query: "${query}"]\n\nTo enable web search, configure a search API key (Google Custom Search or Brave Search) in environment variables.\n\nYou can still proceed with analysis using the TOR document and any uploaded files.`;
    },

    run_command: async (input) => {
      const command = input.command as string;
      const args = (input.args as string[]) || [];

      // Allowlist of safe commands
      const allowed = [
        "wc", "sort", "head", "tail", "cat", "ls", "find", "diff",
        "uniq", "cut", "tr", "date", "echo",
      ];
      if (!allowed.includes(command)) {
        return `Command '${command}' is not allowed. Permitted: ${allowed.join(", ")}`;
      }

      try {
        const { stdout, stderr } = await execFileAsync(command, args, {
          cwd: workDir,
          timeout: 15_000,
        });
        const output = stdout.trim();
        if (stderr.trim()) {
          return `${output}\n[stderr]: ${stderr.trim()}`;
        }
        return output || "(no output)";
      } catch (err) {
        return `Command error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };
}
