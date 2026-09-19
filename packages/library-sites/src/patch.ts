import { sitePatchSchema, type SitePatch } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

const SITE_PATCH_MAX_LINE_LENGTH = 64_000;

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function parseSitePointer(path: string): string[] {
  if (path === "" || path === "/") {
    return [];
  }

  if (!path.startsWith("/")) {
    throw new Error(`Patch path must start with "/": ${path}`);
  }

  return path.slice(1).split("/").map(decodePointerSegment);
}

function isForbiddenKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function resolveParent(target: Record<string, unknown>, segments: string[], create: boolean) {
  let current: unknown = target;

  for (const segment of segments) {
    if (isForbiddenKey(segment)) {
      throw new Error(`Patch path contains a forbidden key: ${segment}`);
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return null;
    }

    if (!(segment in current)) {
      if (!create) {
        return null;
      }

      current[segment] = {};
    }

    current = current[segment];
  }

  return current;
}

export function applySitePatch(target: Record<string, unknown>, patch: SitePatch): void {
  const segments = parseSitePointer(patch.path);

  if (segments.length === 0) {
    if (patch.op === "remove") {
      for (const key of Object.keys(target)) {
        delete target[key];
      }

      return;
    }

    if (!isRecord(patch.value)) {
      throw new Error("A root patch value must be an object");
    }

    for (const key of Object.keys(target)) {
      delete target[key];
    }

    Object.assign(target, structuredClone(patch.value));

    return;
  }

  const key = segments[segments.length - 1];

  if (isForbiddenKey(key)) {
    throw new Error(`Patch path contains a forbidden key: ${key}`);
  }

  const parent = resolveParent(target, segments.slice(0, -1), patch.op !== "remove");

  if (parent === null || parent === undefined) {
    if (patch.op === "remove") {
      return;
    }

    throw new Error(`Patch parent does not exist: ${patch.path}`);
  }

  if (Array.isArray(parent)) {
    if (key === "-") {
      if (patch.op === "remove") {
        parent.pop();
      } else {
        parent.push(structuredClone(patch.value));
      }

      return;
    }

    const index = Number.parseInt(key, 10);

    if (!Number.isInteger(index) || index < 0 || index > parent.length) {
      throw new Error(`Patch index is out of range: ${patch.path}`);
    }

    if (patch.op === "remove") {
      parent.splice(index, 1);
    } else if (patch.op === "add" && index < parent.length) {
      parent.splice(index, 0, structuredClone(patch.value));
    } else {
      parent[index] = structuredClone(patch.value);
    }

    return;
  }

  if (!isRecord(parent)) {
    throw new Error(`Patch parent is not a container: ${patch.path}`);
  }

  if (patch.op === "remove") {
    delete parent[key];

    return;
  }

  parent[key] = structuredClone(patch.value);
}

export function parseSitePatchLine(line: string): SitePatch | null {
  const trimmed = line.trim();

  if (!trimmed.startsWith("{")) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const result = sitePatchSchema.safeParse(parsed);

  if (!result.success) {
    return null;
  }

  if (result.data.op !== "remove" && !(isRecord(parsed) && "value" in parsed)) {
    return null;
  }

  return result.data;
}

export interface SitePatchStreamReader {
  push(chunk: string): SitePatch[];
  flush(): SitePatch[];
  skippedLines(): number;
}

export function createSitePatchStreamReader(): SitePatchStreamReader {
  let pending = "";
  let skipped = 0;

  const take = (line: string): SitePatch | null => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("```")) {
      return null;
    }

    const patch = parseSitePatchLine(trimmed);

    if (!patch) {
      skipped += 1;
    }

    return patch;
  };

  return {
    push(chunk) {
      pending += chunk;

      if (pending.length > SITE_PATCH_MAX_LINE_LENGTH) {
        throw new Error(`Site patch line exceeded ${SITE_PATCH_MAX_LINE_LENGTH} characters`);
      }

      const lines = pending.split("\n");

      pending = lines.pop() ?? "";

      return lines.flatMap((line) => {
        const patch = take(line);

        return patch ? [patch] : [];
      });
    },
    flush() {
      const line = pending;

      pending = "";

      const patch = take(line);

      return patch ? [patch] : [];
    },
    skippedLines: () => skipped,
  };
}
