const DECLARATION_EXPORT =
  /^\s*export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
const LIST_EXPORT = /^\s*export\s*\{([^}]*)\}/gm;
const DEFAULT_EXPORT = /^\s*export\s+default\b/m;

export const DEFAULT_EXPORT_BINDING = "defaultExport";

export function listModuleExports(source: string): string[] {
  const names = new Set<string>();

  for (const match of source.matchAll(DECLARATION_EXPORT)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }

  for (const match of source.matchAll(LIST_EXPORT)) {
    for (const entry of (match[1] ?? "").split(",")) {
      const [, exported] = entry.trim().match(/^[\w$]+(?:\s+as\s+([\w$]+))?$/) ?? [];
      const local = entry
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      const name = exported ?? local;

      if (name && name !== "default") {
        names.add(name);
      }
    }
  }

  return [...names];
}

export function moduleHasDefaultExport(source: string): boolean {
  return DEFAULT_EXPORT.test(source);
}
