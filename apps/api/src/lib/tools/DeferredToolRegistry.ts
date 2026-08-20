export interface DeferredToolDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface DeferredToolEntry {
  group: string;
  definition: DeferredToolDefinition;
}

export interface DeferredToolMatch {
  name: string;
  group: string;
  description: string;
}

export interface DeferredToolGroup {
  name: string;
  toolNames: string[];
}

const NAME_MATCH_SCORE = 100;
const NAME_PREFIX_MATCH_SCORE = 50;
const TERM_MATCH_SCORE = 2;

const STOP_WORDS = new Set(["and", "are", "for", "from", "its", "the", "this", "that", "with"]);

function tokenise(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function toMatch(entry: DeferredToolEntry): DeferredToolMatch {
  return {
    name: entry.definition.name,
    group: entry.group,
    description: entry.definition.description ?? "",
  };
}

export class DeferredToolRegistry {
  private readonly entries: Map<string, DeferredToolEntry>;
  private readonly searchTerms: Map<string, Set<string>>;
  private readonly activatedNames = new Set<string>();

  constructor(entries: readonly DeferredToolEntry[]) {
    this.entries = new Map(entries.map((entry) => [entry.definition.name, entry]));
    this.searchTerms = new Map(
      entries.map((entry) => [
        entry.definition.name,
        new Set([
          ...tokenise(entry.definition.name),
          ...tokenise(entry.group),
          ...tokenise(entry.definition.description ?? ""),
        ]),
      ]),
    );
  }

  get size(): number {
    return this.entries.size;
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

  search(query: string, limit: number): DeferredToolMatch[] {
    const normalisedQuery = query.trim().toLowerCase();
    const queryTerms = tokenise(normalisedQuery);
    const scored: { entry: DeferredToolEntry; score: number }[] = [];

    for (const entry of this.entries.values()) {
      const name = entry.definition.name.toLowerCase();
      const terms = this.searchTerms.get(entry.definition.name);
      let score = 0;

      if (name === normalisedQuery) {
        score += NAME_MATCH_SCORE;
      } else if (name.includes(normalisedQuery)) {
        score += NAME_PREFIX_MATCH_SCORE;
      }

      for (const term of queryTerms) {
        if (terms?.has(term)) {
          score += TERM_MATCH_SCORE;
        }
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    return scored
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.entry.definition.name.localeCompare(right.entry.definition.name),
      )
      .slice(0, limit)
      .map(({ entry }) => toMatch(entry));
  }

  activate(names: readonly string[]): DeferredToolMatch[] {
    const activated: DeferredToolMatch[] = [];

    for (const name of names) {
      const entry = this.entries.get(name);

      if (!entry) {
        continue;
      }

      this.activatedNames.add(name);
      activated.push(toMatch(entry));
    }

    return activated;
  }

  activatedDefinitions(): DeferredToolDefinition[] {
    return [...this.entries.values()]
      .filter((entry) => this.activatedNames.has(entry.definition.name))
      .map((entry) => entry.definition);
  }
}
