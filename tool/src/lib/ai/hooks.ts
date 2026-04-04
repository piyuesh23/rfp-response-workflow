export function summarizeTool(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read": {
      const filePath = input["file_path"] as string | undefined;
      return `Reading file: ${filePath ?? "unknown"}`;
    }
    case "Write": {
      const filePath = input["file_path"] as string | undefined;
      return `Writing file: ${filePath ?? "unknown"}`;
    }
    case "Glob": {
      const pattern = input["pattern"] as string | undefined;
      return `Searching files matching: ${pattern ?? "*"}`;
    }
    case "Grep": {
      const pattern = input["pattern"] as string | undefined;
      return `Searching content for: ${pattern ?? "..."}`;
    }
    case "Bash": {
      const command = input["command"] as string | undefined;
      const short = command ? command.slice(0, 60) : "...";
      return `Running command: ${short}`;
    }
    default:
      return `Using tool: ${toolName}`;
  }
}
