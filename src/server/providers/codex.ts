import "server-only";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CliError, lastLines, runCli } from "../runCli";
import { ProviderError, type GenerateRequest, type MoveGenerator } from "./types";

const CODEX_TIMEOUT_MS = 240_000;

/**
 * Uses `codex exec` so the logged-in ChatGPT plan pays for the move.
 * Each call runs read-only inside an empty temp directory, so the agent has nothing to touch.
 * The user config is ignored so their MCP servers and hooks do not start on every move; auth still loads.
 * The final message is read from `-o` instead of scraping the event log.
 */
export const codexGenerator: MoveGenerator = {
  async generate({ system, prompt, model, effort, signal }: GenerateRequest) {
    const workDir = await mkdtemp(path.join(tmpdir(), "ai-chess-codex-"));
    const outputFile = path.join(workDir, "last-message.txt");
    const args = [
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "--ignore-user-config",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "-C",
      workDir,
      "-o",
      outputFile,
      "-m",
      model,
    ];
    if (effort !== "default") args.push("-c", `model_reasoning_effort="${effort}"`);
    args.push(`${system}\n\n${prompt}`);

    try {
      const { stderr, exitCode } = await runCli({ command: "codex", args, timeoutMs: CODEX_TIMEOUT_MS, signal });
      const reply = await readFile(outputFile, "utf8").catch(() => "");
      if (reply.trim()) return reply;
      const detail = lastErrorLine(stderr) ?? (lastLines(stderr) || `exit code ${exitCode}`);
      throw new ProviderError(`Codex returned no answer: ${detail}`, exitCode === 0);
    } catch (error) {
      if (error instanceof CliError) throw new ProviderError(error.message, error.kind === "timeout");
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  },
};

function lastErrorLine(stderr: string): string | null {
  const line = stderr.split("\n").findLast((entry) => entry.startsWith("ERROR:"));
  return line ? line.replace(/^ERROR:\s*/, "") : null;
}
