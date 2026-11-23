import "server-only";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { CLAUDE_MODELS, type ModelOption, type ProviderId } from "@/lib/players";
import { runCli } from "./runCli";

const STATUS_TIMEOUT_MS = 15_000;

export interface ProviderStatus {
  id: ProviderId;
  ready: boolean;
  detail: string;
  models: ModelOption[];
  defaultModel: string;
  fixHint?: string;
}

async function claudeStatus(): Promise<ProviderStatus> {
  const base = { id: "claude" as const, models: CLAUDE_MODELS, defaultModel: CLAUDE_MODELS[0].id };
  try {
    const { stdout } = await runCli({ command: "claude", args: ["auth", "status"], timeoutMs: STATUS_TIMEOUT_MS });
    const status = JSON.parse(stdout) as { loggedIn?: boolean; authMethod?: string };
    if (status.loggedIn) return { ...base, ready: true, detail: `Signed in (${status.authMethod ?? "account"})` };
    return { ...base, ready: false, detail: "Not signed in", fixHint: "Run `claude` in a terminal and log in" };
  } catch (error) {
    return { ...base, ready: false, detail: (error as Error).message, fixHint: "Install Claude Code: npm i -g @anthropic-ai/claude-code" };
  }
}

interface CodexModelCacheEntry {
  slug?: string;
  display_name?: string;
  visibility?: string;
}

function codexHome(): string {
  return process.env.CODEX_HOME || path.join(homedir(), ".codex");
}

/**
 * Reads the model list the codex CLI itself cached, so the picker matches what this account can run.
 * The config.toml default is only honored when the cache lists it: a stale default is rejected by
 * ChatGPT-plan auth with "model is not supported", which would fail every move.
 */
async function codexModels(): Promise<{ models: ModelOption[]; configured: string | null }> {
  const [cacheText, configText] = await Promise.all([
    readFile(path.join(codexHome(), "models_cache.json"), "utf8").catch(() => ""),
    readFile(path.join(codexHome(), "config.toml"), "utf8").catch(() => ""),
  ]);
  const configured = /^model\s*=\s*"([^"]+)"/m.exec(configText)?.[1] ?? null;
  let entries: CodexModelCacheEntry[] = [];
  try {
    entries = (JSON.parse(cacheText) as { models?: CodexModelCacheEntry[] }).models ?? [];
  } catch {
    entries = [];
  }
  const models: ModelOption[] = entries
    .filter((entry) => entry.slug && entry.visibility === "list")
    .map((entry) => ({ id: entry.slug!, label: entry.display_name ?? entry.slug! }));
  const configuredModel = models.find((model) => model.id === configured);
  if (configuredModel) configuredModel.hint = "Your default";
  return { models, configured: configuredModel?.id ?? null };
}

async function codexStatus(): Promise<ProviderStatus> {
  const { models, configured } = await codexModels();
  const base = { id: "codex" as const, models, defaultModel: configured ?? models[0]?.id ?? "" };
  try {
    const { stdout, stderr, exitCode } = await runCli({ command: "codex", args: ["login", "status"], timeoutMs: STATUS_TIMEOUT_MS });
    const text = `${stdout}\n${stderr}`;
    const line = text.split("\n").find((entry) => /logged in/i.test(entry))?.trim();
    if (exitCode === 0 && line && !/not logged in/i.test(line)) return { ...base, ready: models.length > 0, detail: line };
    return { ...base, ready: false, detail: "Not signed in", fixHint: "Run `codex login` in a terminal" };
  } catch (error) {
    return { ...base, ready: false, detail: (error as Error).message, fixHint: "Install Codex: npm i -g @openai/codex" };
  }
}

function openRouterStatus(): ProviderStatus {
  const hasServerKey = Boolean(process.env.OPENROUTER_API_KEY);
  return {
    id: "openrouter",
    ready: hasServerKey,
    detail: hasServerKey ? "Using OPENROUTER_API_KEY from the server" : "Needs an API key",
    models: [],
    defaultModel: "",
    fixHint: hasServerKey ? undefined : "Add your key in Settings",
  };
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  return Promise.all([claudeStatus(), codexStatus(), openRouterStatus()]);
}
