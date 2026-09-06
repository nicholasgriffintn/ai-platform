import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import ts from "typescript";

export async function readProviderSources(sourceRoot) {
  const modelsDir = path.join(sourceRoot, "data-model/models");
  const registry = await fs.readFile(
    path.join(sourceRoot, "lib/providers/models/index.ts"),
    "utf8",
  );
  const imports = new Map(
    [...registry.matchAll(/import \{ (\w+) \} from "~\/data-model\/models\/([^"]+)";/g)].map(
      (match) => [match[1], match[2]],
    ),
  );
  const merge = /const modelConfig: ModelConfig = mergeModelConfigs\(([\s\S]*?)\);/.exec(registry);

  if (!merge) {
    throw new Error(
      "Conversion input must contain the original model registry and provider sources",
    );
  }

  const providers = {};

  for (const name of merge[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const file = imports.get(name);

    if (!file) {
      throw new Error(`Cannot locate provider source for ${name}`);
    }

    const config = await readProviderModule(modelsDir, file);

    for (const [id, model] of Object.entries(config[name])) {
      providers[model.provider] ??= {};
      if (Object.hasOwn(providers[model.provider], id)) {
        throw new Error(`Duplicate offering ${model.provider}/${id}`);
      }

      providers[model.provider][id] = model;
    }
  }

  return providers;
}

async function readProviderModule(modelsDir, relativePath) {
  let filename = path.join(modelsDir, `${relativePath}.ts`);

  try {
    await fs.access(filename);
  } catch {
    filename = path.join(modelsDir, relativePath, "index.ts");
  }

  const source = await fs.readFile(filename, "utf8");
  const dependencies = new Map();

  for (const match of source.matchAll(/from "(\.[^"]+)"/g)) {
    const relative = path.relative(modelsDir, path.resolve(path.dirname(filename), match[1]));

    dependencies.set(match[1], await readProviderModule(modelsDir, relative));
  }

  const exports = {};
  const context = vm.createContext(
    {
      exports,
      require(specifier) {
        if (dependencies.has(specifier)) {
          return dependencies.get(specifier);
        }

        if (specifier !== "~/lib/providers/models/utils") {
          throw new Error(`Unsupported conversion import: ${specifier}`);
        }

        return {
          createModelConfig(key, provider, config) {
            const { modalities, ...rest } = config;

            return [
              key,
              {
                matchingModel: rest.matchingModel || key,
                name: rest.name || key,
                provider,
                ...rest,
                modalities: modalities ?? { input: ["text"], output: ["text"] },
              },
            ];
          },
          createModelConfigObject: Object.fromEntries,
        };
      },
    },
    { codeGeneration: { strings: false, wasm: false } },
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });

  new vm.Script(compiled.outputText, { filename }).runInContext(context, { timeout: 1000 });

  return JSON.parse(JSON.stringify(exports));
}
