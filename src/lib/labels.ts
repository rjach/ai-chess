import type { ProvidersState } from "@/hooks/useProviders";
import type { PlayerConfig } from "@/lib/players";

export function modelLabel(player: PlayerConfig, providers: ProvidersState): string {
  if (!player.model) return "Choose a model";
  if (providers.kind !== "ready") return player.model;
  return providers.byId[player.provider]?.models.find((model) => model.id === player.model)?.label ?? player.model;
}
