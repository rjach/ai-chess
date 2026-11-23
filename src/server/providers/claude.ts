import "server-only";
import { CliError, lastLines, runCli } from "../runCli";
import { ProviderError, type GenerateRequest, type MoveGenerator } from "./types";

const CLAUDE_TIMEOUT_MS = 180_000;

interface ClaudeJsonResult {
  is_error?: boolean;
  result?: string;
}

/**
 * Uses `claude -p` so the logged-in Claude subscription pays for the move.
 * Tools are disabled and user settings are skipped, which keeps each call a pure text completion
 * and stops the user's hooks or MCP servers from running once per chess move.
 */
export const claudeGenerator: MoveGenerator = {
  async generate({ system, prompt, model, effort, signal }: GenerateRequest) {
    const args = [
      "-p",
      prompt,
      "--model",
      model,
      "--system-prompt",
      system,
      "--tools",
      "",
      "--output-format",
      "json",
      "--no-session-persistence",
      "--setting-sources",
      "",
      "--strict-mcp-config",
    ];
    if (effort !== "default") args.push("--effort", effort);

    try {
      const { stdout, stderr, exitCode } = await runCli({ command: "claude", args, timeoutMs: CLAUDE_TIMEOUT_MS, signal });
      const parsed = safeParse(stdout);
      if (parsed?.is_error || exitCode !== 0) {
        const detail = parsed?.result || lastLines(stderr) || lastLines(stdout) || `exit code ${exitCode}`;
        throw new ProviderError(`Claude Code error: ${detail}`, false);
      }
      return parsed?.result ?? stdout;
    } catch (error) {
      if (error instanceof CliError) throw new ProviderError(error.message, error.kind === "timeout");
      throw error;
    }
  },
};

function safeParse(stdout: string): ClaudeJsonResult | null {
  try {
    return JSON.parse(stdout) as ClaudeJsonResult;
  } catch {
    return null;
  }
}
