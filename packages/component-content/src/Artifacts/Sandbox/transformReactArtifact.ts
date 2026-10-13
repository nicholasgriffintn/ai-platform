const MAX_CACHED_TRANSFORMS = 40;

const transformCache = new Map<string, string>();

type SucraseModule = typeof import("sucrase");

let sucrase: Promise<SucraseModule> | null = null;

function loadSucrase(): Promise<SucraseModule> {
  sucrase ??= import("sucrase").catch((error: unknown) => {
    sucrase = null;
    throw error;
  });

  return sucrase;
}

function remember(code: string, transpiled: string) {
  transformCache.delete(code);
  transformCache.set(code, transpiled);

  while (transformCache.size > MAX_CACHED_TRANSFORMS) {
    const oldest = transformCache.keys().next().value;

    if (oldest === undefined) {
      break;
    }

    transformCache.delete(oldest);
  }
}

export function importsRecharts(code: string): boolean {
  return /from\s+["']recharts["']|require\(\s*["']recharts["']\s*\)/.test(code);
}

export async function transformReactArtifact(code: string): Promise<string> {
  const cached = transformCache.get(code);

  if (cached !== undefined) {
    return cached;
  }

  const { transform } = await loadSucrase();
  const transpiled = transform(code, {
    transforms: ["jsx", "typescript", "imports"],
    jsxRuntime: "classic",
    production: true,
  }).code;

  remember(code, transpiled);

  return transpiled;
}
