import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  modelCatalogueSchema,
  resolveCatalogueProvider,
  resolveModelCatalogue,
} from "../../src/schema.ts";
import { convertCatalogue } from "./catalogue-conversion.mjs";
import { catalogueFiles, readCatalogue } from "./catalogue-files.mjs";
import { syncCatalogue } from "./catalogue-sync.mjs";
import { runSyncModelsDev } from "./run-sync.mjs";

const directories = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true })),
  );
});

const remote = {
  first: {
    models: {
      alpha: {
        id: "alpha",
        name: "Alpha",
        family: "test",
        description: "Shared upstream description",
        tool_call: false,
        temperature: false,
        cost: { input: 2, output: 4 },
      },
    },
  },
  second: {
    models: {
      alpha: {
        id: "alpha",
        name: "Alpha",
        family: "test",
        description: "Shared upstream description",
      },
    },
  },
};
const providers = {
  first: {
    alpha: {
      provider: "first",
      matchingModel: "alpha",
      name: "Alpha",
      family: "test",
      contextWindow: 1000,
      costPer1kInputTokens: 0.01,
      supportsToolCalls: true,
      supportsTemperature: true,
      supportsStreaming: true,
      reasoningConfig: { supportedEffortLevels: ["low", "high"], defaultEffort: "low" },
    },
  },
  second: {
    alpha: {
      provider: "second",
      matchingModel: "alpha",
      name: "Alpha",
      family: "test",
      contextWindow: 1000,
      costPer1kInputTokens: 0,
      supportsToolCalls: false,
      reasoningConfig: { supportedEffortLevels: ["high"], defaultEffort: "high" },
    },
  },
};

describe("layered model catalogue", () => {
  it("writes namespaced family imports that coverage can resolve and sync can read without collisions", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "polychat-catalogue-paths-"));

    directories.push(directory);
    const catalogue = modelCatalogueSchema.parse({
      families: Object.fromEntries(
        ["azure-openai/o1-preview", "azure-openai~2Fo1-preview", "literal%2Ffamily"].map(
          (family) => [family, { description: family, defaults: {}, models: {} }],
        ),
      ),
      providers: {},
    });
    const files = catalogueFiles(catalogue);

    expect([...files.keys()].filter((file) => file.startsWith("families/"))).toHaveLength(3);
    for (const [relative, contents] of files) {
      const filename = path.join(directory, relative);

      expect(fileURLToPath(new URL(`file://${filename}`))).toBe(filename);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, contents);
    }

    expect(await readCatalogue(directory)).toEqual(catalogue);
  });

  it("shares model descriptions while retaining provider prices, reasoning contracts and public IDs", () => {
    const catalogue = convertCatalogue(providers, remote);

    expect(Object.keys(catalogue.families.test.models)).toEqual(["alpha"]);
    expect(catalogue.families.test.models.alpha.defaults.description).toBe(
      "Shared upstream description",
    );
    const resolved = resolveModelCatalogue(catalogue);

    expect(Object.keys(resolved)).toEqual(["alpha", "second/alpha"]);
    expect(resolved.alpha).toEqual({
      ...providers.first.alpha,
      description: "Shared upstream description",
    });
    expect(resolved["second/alpha"]).toEqual({
      ...providers.second.alpha,
      description: "Shared upstream description",
    });
    expect(
      convertCatalogue(
        {
          first: resolveCatalogueProvider(catalogue, "first"),
          second: resolveCatalogueProvider(catalogue, "second"),
        },
        remote,
        catalogue,
      ),
    ).toEqual(catalogue);
  });

  it("applies family, model, provider and offering precedence, replacing nested values and supporting removal", () => {
    const catalogue = convertCatalogue(providers, remote);

    catalogue.families.test.defaults.supportsStreaming = false;
    catalogue.families.test.models.alpha.defaults.supportsStreaming = false;
    catalogue.providers.first.defaults.supportsStreaming = true;
    catalogue.providers.first.models.alpha.overrides.supportsStreaming = false;
    catalogue.providers.first.models.alpha.overrides.reasoningConfig = {
      supportedEffortLevels: [],
      defaultEffort: "none",
    };
    catalogue.providers.first.models.alpha.unset = ["supportsTemperature"];
    const resolved = resolveCatalogueProvider(catalogue, "first").alpha;

    expect(resolved.supportsStreaming).toBe(false);
    expect(resolved.reasoningConfig).toEqual({ supportedEffortLevels: [], defaultEffort: "none" });
    expect(resolved).not.toHaveProperty("supportsTemperature");
    delete catalogue.providers.first.models.alpha.overrides.supportsStreaming;
    expect(resolveCatalogueProvider(catalogue, "first").alpha.supportsStreaming).toBe(true);
  });

  it("rejects broken references and invalid fields instead of silently dropping catalogue configuration", () => {
    const catalogue = convertCatalogue(providers, remote);

    catalogue.providers.first.models.alpha.model = "test/missing";
    expect(() => resolveModelCatalogue(catalogue)).toThrow("Unknown model");
    catalogue.providers.first.models.alpha.model = "test/alpha";
    catalogue.providers.first.models.alpha.model = "missing/alpha";
    expect(() => resolveModelCatalogue(catalogue)).toThrow("Unknown family");
    expect(() => modelCatalogueSchema.parse({ ...catalogue, surprise: true })).toThrow();
    catalogue.providers.first.defaults.madeUpCapability = true;
    expect(() => modelCatalogueSchema.parse(catalogue)).toThrow();
  });

  it("uses a family description when no narrower description is configured", () => {
    const catalogue = convertCatalogue(providers, remote);

    delete catalogue.families.test.models.alpha.defaults.description;
    expect(resolveCatalogueProvider(catalogue, "first").alpha.description).toBe(
      catalogue.families.test.description,
    );
  });
});

describe("models.dev catalogue sync", () => {
  it("retains Anthropic and OpenAI execution overrides when upstream advertises incompatible reasoning settings", async () => {
    const catalogue = await readCatalogue(path.resolve(import.meta.dirname, "../../src/data"));
    const anthropic = resolveCatalogueProvider(catalogue, "anthropic");
    const openai = resolveCatalogueProvider(catalogue, "openai");
    const source = {
      anthropic: { "claude-opus-5": anthropic["claude-opus-5"] },
      openai: { "gpt-5.3-codex": openai["gpt-5.3-codex"], "gpt-6-astra": openai["gpt-6-astra"] },
    };
    const upstream = {
      anthropic: {
        models: {
          "claude-opus-5": {
            id: "claude-opus-5",
            family: "claude-opus",
            temperature: true,
            reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "xhigh"] }],
          },
        },
      },
      openai: {
        models: {
          "gpt-5.3-codex": {
            id: "gpt-5.3-codex",
            family: "gpt-codex",
            reasoning_options: [{ type: "effort", values: ["none", "low", "high"] }],
          },
        },
      },
    };
    const converted = convertCatalogue(source, upstream);
    const synced = syncCatalogue(converted, upstream, new Map(), new Set()).catalogue;

    expect(resolveCatalogueProvider(synced, "anthropic")["claude-opus-5"]).toMatchObject({
      supportsTemperature: false,
      supportsTopP: false,
      supportsSearchGrounding: true,
      supportsCodeExecution: true,
      supportsWebFetch: true,
      hostedToolCosts: { web_search: 0.01 },
      costPerCodeExecutionHour: 0.05,
      reasoningConfig: {
        supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
        thinkingApi: "adaptive",
      },
    });
    const resolvedOpenai = resolveCatalogueProvider(synced, "openai");

    expect(resolvedOpenai["gpt-5.3-codex"]).toMatchObject({
      requiresResponsesApi: true,
      supportsHostedShell: true,
      reasoningConfig: {
        supportedEffortLevels: ["low", "medium", "high", "xhigh"],
        defaultEffort: "medium",
      },
    });
    expect(resolvedOpenai["gpt-6-astra"]).toEqual(openai["gpt-6-astra"]);
  });

  it("honours filtering, preserves provider defaults for new models, and is repeatable", () => {
    const catalogue = convertCatalogue(providers, remote);

    catalogue.providers.second.models.alpha.overrides.name = "Hosting Alpha";
    const nextRemote = structuredClone(remote);

    nextRemote.first.models.beta = {
      id: "beta",
      name: "Beta",
      family: "test",
      tool_call: false,
      temperature: false,
    };
    const result = syncCatalogue(catalogue, nextRemote, new Map(), new Set(["first"]));
    const first = resolveCatalogueProvider(result.catalogue, "first");

    expect(first.alpha.costPer1kInputTokens).toBe(0.002);
    expect(first.alpha.supportsToolCalls).toBe(false);
    expect(first.beta.supportsStreaming).toBe(true);
    expect(first.beta.supportsToolCalls).toBe(false);
    expect(first.beta.supportsTemperature).toBe(false);
    expect(first.beta.description).toBeTruthy();
    expect(resolveCatalogueProvider(result.catalogue, "second")).toEqual(
      resolveCatalogueProvider(catalogue, "second"),
    );
    expect(result.catalogue.providers.second.models.alpha.model).toBe("test/alpha");
    expect(
      syncCatalogue(result.catalogue, nextRemote, new Map(), new Set(["first"])).catalogue,
    ).toEqual(result.catalogue);
    expect(() => syncCatalogue(catalogue, remote, new Map(), new Set(["typo"]))).toThrow(
      "Unknown selected provider",
    );
  });

  it("removes deprecated offerings without deleting another provider's same model", () => {
    const catalogue = convertCatalogue(providers, remote);
    const nextRemote = structuredClone(remote);

    nextRemote.first.models.alpha.status = "deprecated";
    const result = syncCatalogue(catalogue, nextRemote, new Map(), new Set());

    expect(resolveCatalogueProvider(result.catalogue, "first")).toEqual({});
    expect(resolveCatalogueProvider(result.catalogue, "second").alpha).toBeDefined();
  });

  it("routes mantle endpoint models into the split provider and is repeatable", () => {
    const bedrockRemote = {
      "amazon-bedrock": {
        models: {
          "openai.runtime-model": {
            id: "openai.runtime-model",
            name: "Runtime Model",
            family: "gpt-oss",
          },
          "openai.mantle-model": {
            id: "openai.mantle-model",
            name: "Mantle Model",
            family: "gpt-oss",
            provider: {
              npm: "@ai-sdk/amazon-bedrock/mantle",
              api: "https://bedrock-mantle.${AWS_REGION}.api.aws/v1",
              shape: "responses",
            },
          },
        },
      },
    };
    const bedrockProviders = {
      bedrock: {
        "openai.runtime-model": {
          provider: "bedrock",
          matchingModel: "openai.runtime-model",
          name: "Runtime Model",
          family: "gpt-oss",
          supportsStreaming: true,
        },
        "openai.mantle-model": {
          provider: "bedrock",
          matchingModel: "openai.mantle-model",
          name: "Mantle Model",
          family: "gpt-oss",
          speed: 4,
          supportsStreaming: true,
        },
      },
    };
    const selected = new Set(["bedrock"]);
    const catalogue = convertCatalogue(bedrockProviders, bedrockRemote);
    const result = syncCatalogue(catalogue, bedrockRemote, new Map(), selected);

    expect(Object.keys(result.catalogue.providers)).toEqual(["bedrock", "bedrock-mantle"]);
    expect(Object.keys(resolveCatalogueProvider(result.catalogue, "bedrock"))).toEqual([
      "openai.runtime-model",
    ]);
    expect(resolveCatalogueProvider(result.catalogue, "bedrock-mantle")).toMatchObject({
      "openai.mantle-model": {
        provider: "bedrock-mantle",
        matchingModel: "openai.mantle-model",
        name: "Mantle Model",
        speed: 4,
        apiBaseUrl: "https://bedrock-mantle.${AWS_REGION}.api.aws/v1",
        apiShape: "responses",
      },
    });
    expect(syncCatalogue(result.catalogue, bedrockRemote, new Map(), selected).catalogue).toEqual(
      result.catalogue,
    );

    const runtimeOnly = structuredClone(bedrockRemote);

    delete runtimeOnly["amazon-bedrock"].models["openai.mantle-model"].provider;
    const movedBack = syncCatalogue(result.catalogue, runtimeOnly, new Map(), selected);

    expect(Object.keys(resolveCatalogueProvider(movedBack.catalogue, "bedrock"))).toEqual([
      "openai.runtime-model",
      "openai.mantle-model",
    ]);
    expect(resolveCatalogueProvider(movedBack.catalogue, "bedrock-mantle")).toEqual({});
  });

  it("is idempotent against a saved snapshot and only writes when asked", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "polychat-catalogue-test-"));

    directories.push(directory);
    const output = path.join(directory, "output");

    for (const [relative, content] of catalogueFiles(convertCatalogue(providers, remote))) {
      await fs.mkdir(path.dirname(path.join(output, relative)), { recursive: true });
      await fs.writeFile(path.join(output, relative), content);
    }

    const snapshot = path.join(directory, "snapshot.json");
    const options = {
      snapshot,
      modelsDir: output,
      providers: new Set(),
      write: false,
    };

    await fs.writeFile(snapshot, JSON.stringify(remote));
    const seeded = await fs.readFile(path.join(output, "providers/first.json"), "utf8");

    await runSyncModelsDev(options);
    expect(await fs.readFile(path.join(output, "providers/first.json"), "utf8")).toBe(seeded);
    await runSyncModelsDev({ ...options, write: true });
    expect((await runSyncModelsDev(options)).changedFiles).toBe(0);
    await fs.writeFile(snapshot, "[]");
    await expect(runSyncModelsDev({ ...options, write: true })).rejects.toThrow("provider map");
    expect(
      JSON.parse(await fs.readFile(path.join(output, "providers/first.json"), "utf8")),
    ).toHaveProperty("models.alpha");
    const deprecated = structuredClone(remote);

    deprecated.first.models.alpha.status = "deprecated";
    await fs.writeFile(snapshot, JSON.stringify(deprecated));
    expect((await runSyncModelsDev(options)).changedFiles).toBeGreaterThan(0);
    expect(
      JSON.parse(await fs.readFile(path.join(output, "providers/first.json"), "utf8")),
    ).toHaveProperty("models.alpha");
    await runSyncModelsDev({ ...options, write: true });
    expect(
      JSON.parse(await fs.readFile(path.join(output, "providers/first.json"), "utf8")),
    ).not.toHaveProperty("models.alpha");
    expect((await runSyncModelsDev(options)).changedFiles).toBe(0);
  });
});
