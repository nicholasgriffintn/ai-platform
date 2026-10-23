import {
  CapabilityIcon,
  InstalledCapabilities,
  type InstalledCapabilityTile,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
  type CapabilitySurface,
  type EnabledCapability,
  getCapabilityOpenPath,
  getProjectCapabilityKind,
} from "@ngriffin_uk/polychat-library-react";
import type {
  AssistantActionItem,
  CapabilityCatalogItem,
  ModelToolDefinition,
  ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { useNavigate } from "react-router";

export type InstalledTileResolver = (item: AssistantActionItem) => InstalledCapabilityTile | null;

export function InstalledCapabilityStrip({
  items,
  capabilities,
  appById,
  toolById,
  toolConfigurationById,
  experiences,
  surface,
  onConfigureTool,
  resolveTile,
  onShowAll,
}: {
  items: readonly AssistantActionItem[];
  capabilities: EnabledCapability[];
  appById: Map<string, CapabilityCatalogItem>;
  toolById: Map<string, ModelToolDefinition>;
  toolConfigurationById: Map<string, Record<string, unknown>>;
  experiences: ProjectExperienceDefinition[];
  surface: CapabilitySurface;
  onConfigureTool: (tool: ModelToolDefinition, configuration?: Record<string, unknown>) => void;
  resolveTile?: InstalledTileResolver;
  onShowAll: () => void;
}) {
  const navigate = useNavigate();
  const tiles = items.flatMap((item): InstalledCapabilityTile[] => {
    const resolved = resolveTile?.(item);

    if (resolved) {
      return [resolved];
    }

    const kind = getProjectCapabilityKind(item);

    if (!kind) {
      return [];
    }

    const tool = kind === "tool" ? toolById.get(item.capability.id) : undefined;
    const openPath = getCapabilityOpenPath(item, surface, experiences);
    const configuration =
      capabilities.find(
        (capability) => capability.kind === kind && capability.capabilityId === item.capability.id,
      )?.configuration ?? toolConfigurationById.get(item.capability.id);

    return [
      {
        id: item.id,
        label: item.label,
        icon: (
          <CapabilityIcon
            app={appById.get(item.capability.id)}
            item={item}
            kind={kind}
            className="h-12 w-12 border border-border"
          />
        ),
        onSelect: tool?.requiresConfiguration
          ? () => onConfigureTool(tool, configuration)
          : openPath
            ? () => void navigate(openPath)
            : undefined,
      },
    ];
  });

  if (tiles.length === 0) {
    return null;
  }

  return <InstalledCapabilities tiles={tiles} onShowAll={onShowAll} />;
}
