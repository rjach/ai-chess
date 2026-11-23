import "server-only";
import { spawn } from "node:child_process";

export interface CliRunOptions {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const MAX_CAPTURE_BYTES = 2_000_000;

export class CliError extends Error {
  constructor(message: string, readonly kind: "missing" | "timeout" | "aborted" | "failed") {
    super(message);
  }
}

/**
 * Runs a CLI without a shell so model ids and prompts can never be interpreted as shell syntax.
 * stdin is closed immediately because both CLIs wait on an open stdin otherwise.
 */
export function runCli({ command, args, cwd, timeoutMs, signal }: CliRunOptions): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CliError(`${command} was cancelled`, "aborted"));

    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const kill = () => {
      if (child.exitCode === null) child.kill("SIGTERM");
    };
    const onAbort = () => {
      kill();
      finish(() => reject(new CliError(`${command} was cancelled`, "aborted")));
    };
    const timer = setTimeout(() => {
      kill();
      finish(() => reject(new CliError(`${command} did not answer within ${Math.round(timeoutMs / 1000)}s`, "timeout")));
    }, timeoutMs);

    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURE_BYTES) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk.toString();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      const missing = error.code === "ENOENT";
      finish(() =>
        reject(
          new CliError(
            missing ? `${command} CLI is not installed or not on PATH` : `${command} failed to start: ${error.message}`,
            missing ? "missing" : "failed",
          ),
        ),
      );
    });
    child.on("close", (exitCode) => finish(() => resolve({ stdout, stderr, exitCode })));
  });
}

export function lastLines(text: string, count = 4): string {
  return text.trim().split("\n").slice(-count).join("\n");
}
