"use client";
import { useCallback, useEffect, useState } from "react";
import type { ModelOption, ProviderId } from "@/lib/players";

export interface ProviderStatus {
  id: ProviderId;
  ready: boolean;
  detail: string;
  models: ModelOption[];
  defaultModel: string;
  fixHint?: string;
}

export type ProvidersState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; byId: Record<ProviderId, ProviderStatus> };

export function useProviders(): { providers: ProvidersState; refresh: () => void } {
  const [providers, setProviders] = useState<ProvidersState>({ kind: "loading" });

  const load = useCallback(() => {
    fetch("/api/providers")
      .then((response) => {
        if (!response.ok) throw new Error(`status check failed (${response.status})`);
        return response.json() as Promise<{ providers: ProviderStatus[] }>;
      })
      .then(({ providers: list }) => {
        const byId = Object.fromEntries(list.map((status) => [status.id, status])) as Record<ProviderId, ProviderStatus>;
        setProviders({ kind: "ready", byId });
      })
      .catch((error: Error) => setProviders({ kind: "error", message: error.message }));
  }, []);

  useEffect(load, [load]);
  const refresh = useCallback(() => {
    setProviders({ kind: "loading" });
    load();
  }, [load]);
  return { providers, refresh };
}

export function useOpenRouterModels(enabled: boolean): { models: ModelOption[]; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ models: ModelOption[]; error: string | null; fetched: boolean }>({ models: [], error: null, fetched: false });
  const shouldFetch = enabled && !state.fetched;

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    fetch("/api/openrouter/models")
      .then((response) => response.json() as Promise<{ models: ModelOption[]; error?: string }>)
      .then((body) => !cancelled && setState({ models: body.models, error: body.error ?? null, fetched: true }))
      .catch((error: Error) => !cancelled && setState({ models: [], error: error.message, fetched: true }));
    return () => {
      cancelled = true;
    };
  }, [shouldFetch]);

  return { models: state.models, error: state.error, loading: shouldFetch };
}
