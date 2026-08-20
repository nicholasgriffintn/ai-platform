export type DeferredToolOrigin = "function" | "external";

export interface DeferredToolDefinition {
  name: string;
  description?: string;
  inputSchema?: unknown;
  parameters?: Record<string, unknown>;
}

export interface DeferredToolEntry {
  group: string;
  origin: DeferredToolOrigin;
  definition: DeferredToolDefinition;
}

export interface DeferredToolGroup {
  name: string;
  toolNames: string[];
}

export class DeferredToolSession {
  private readonly entries: Map<string, DeferredToolEntry>;
  private readonly loadedNames = new Set<string>();

  constructor(entries: readonly DeferredToolEntry[]) {
    this.entries = new Map(entries.map((entry) => [entry.definition.name, entry]));
  }

  get size(): number {
    return this.entries.size;
  }

  isWithheld(name: string): boolean {
    return this.entries.has(name) && !this.loadedNames.has(name);
  }

  withheldNames(): string[] {
    return [...this.entries.keys()].filter((name) => !this.loadedNames.has(name));
  }

  list(origin?: DeferredToolOrigin): DeferredToolEntry[] {
    return [...this.entries.values()].filter((entry) => !origin || entry.origin === origin);
  }

  describe(name: string): DeferredToolEntry | undefined {
    return this.entries.get(name);
  }

  groups(): DeferredToolGroup[] {
    const grouped = new Map<string, string[]>();

    for (const entry of this.entries.values()) {
      const toolNames = grouped.get(entry.group) ?? [];

      toolNames.push(entry.definition.name);
      grouped.set(entry.group, toolNames);
    }

    return [...grouped].map(([name, toolNames]) => ({ name, toolNames }));
  }

  load(names: readonly string[]): string[] {
    const loaded: string[] = [];

    for (const name of names) {
      if (!this.entries.has(name) || this.loadedNames.has(name)) {
        continue;
      }

      this.loadedNames.add(name);
      loaded.push(name);
    }

    return loaded;
  }

  loadedDefinitions(origin?: DeferredToolOrigin): DeferredToolDefinition[] {
    return [...this.entries.values()]
      .filter(
        (entry) =>
          this.loadedNames.has(entry.definition.name) && (!origin || entry.origin === origin),
      )
      .map((entry) => entry.definition);
  }
}
