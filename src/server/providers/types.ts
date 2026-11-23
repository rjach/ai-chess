import type { Effort } from "@/lib/players";

export interface GenerateRequest {
  system: string;
  prompt: string;
  model: string;
  effort: Effort;
  signal: AbortSignal;
  openRouterKey?: string;
  /** The raw position, for providers that take structured input instead of a prompt. */
  position: { fen: string; sanHistory: string[] };
}

export interface MoveGenerator {
  generate(request: GenerateRequest): Promise<string>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}
