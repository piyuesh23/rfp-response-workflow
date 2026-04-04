export function summarizeTool(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "read_file":
    case "Read": {
      const filePath = input["file_path"] as string | undefined;
      return `Reading file: ${filePath ?? "unknown"}`;
    }
    case "write_file":
    case "Write": {
      const filePath = input["file_path"] as string | undefined;
      return `Writing file: ${filePath ?? "unknown"}`;
    }
    case "list_files":
    case "Glob": {
      const pattern = input["pattern"] as string | undefined;
      return `Searching files matching: ${pattern ?? "*"}`;
    }
    case "search_content":
    case "Grep": {
      const pattern = input["pattern"] as string | undefined;
      return `Searching content for: ${pattern ?? "..."}`;
    }
    case "web_fetch": {
      const url = input["url"] as string | undefined;
      return `Fetching URL: ${url ?? "unknown"}`;
    }
    case "web_search": {
      const query = input["query"] as string | undefined;
      return `Web search: ${query ?? "..."}`;
    }
    case "run_command":
    case "Bash": {
      const command = input["command"] as string | undefined;
      const short = command ? command.slice(0, 60) : "...";
      return `Running command: ${short}`;
    }
    default:
      return `Using tool: ${toolName}`;
  }
}
