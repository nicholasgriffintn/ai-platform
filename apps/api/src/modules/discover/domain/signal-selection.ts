import { DISCOVER_SIGNAL_GROUPS, type DiscoverSignal } from "./signal-catalogue";

export interface DiscoverSignalSelectionInput {
  signals: readonly DiscoverSignal[];
  connectedProviders: ReadonlySet<string>;
  excludedProviders: ReadonlySet<string>;
  supports: (providerId: string, operation: string) => boolean;
  hasLocation: boolean;
}

export interface DiscoverSignalSelection {
  selected: DiscoverSignal[];
  unsupported: DiscoverSignal[];
}

export function selectDiscoverSignals(
  input: DiscoverSignalSelectionInput,
): DiscoverSignalSelection {
  const selected: DiscoverSignal[] = [];
  const unsupported: DiscoverSignal[] = [];
  const providerByGroup = new Map<string, string>();

  for (const signal of input.signals) {
    if (
      !input.connectedProviders.has(signal.providerId) ||
      input.excludedProviders.has(signal.providerId) ||
      (signal.needsLocation && !input.hasLocation)
    ) {
      continue;
    }

    if (!input.supports(signal.providerId, signal.operation)) {
      unsupported.push(signal);
      continue;
    }

    if (DISCOVER_SIGNAL_GROUPS[signal.group].oneOf) {
      const chosen = providerByGroup.get(signal.group);

      if (chosen && chosen !== signal.providerId) {
        continue;
      }

      providerByGroup.set(signal.group, signal.providerId);
    }

    selected.push(signal);
  }

  return { selected, unsupported };
}

export function listDiscoverSignalProviders(
  signals: readonly DiscoverSignal[],
): { providerId: string; title: string; description: string; group: string }[] {
  const seen = new Map<
    string,
    { providerId: string; title: string; description: string; group: string }
  >();

  for (const signal of signals) {
    if (!seen.has(signal.providerId)) {
      seen.set(signal.providerId, {
        providerId: signal.providerId,
        title: signal.title.replace(/ (top artists|shelf|week ahead|newsletters|Reader)$/u, ""),
        description: signal.description,
        group: signal.group,
      });
    }
  }

  return [...seen.values()];
}
