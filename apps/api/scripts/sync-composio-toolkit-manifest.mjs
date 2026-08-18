import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE_URL = "https://backend.composio.dev/api/v3.1";
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const API_DIRECTORY = resolve(SCRIPT_DIRECTORY, "..");
const REPOSITORY_DIRECTORY = resolve(API_DIRECTORY, "../..");
const OUTPUT_PATH = resolve(
  API_DIRECTORY,
  "src/lib/providers/capabilities/connectors/composio/configured-toolkit-manifest.generated.json",
);
const PROVIDER_IDS_OUTPUT_PATH = resolve(
  REPOSITORY_DIRECTORY,
  "packages/schemas/src/generated/composio-recipe-connector-providers.generated.json",
);

async function readApiKey() {
  if (process.env.COMPOSIO_API_KEY?.trim()) {
    return process.env.COMPOSIO_API_KEY.trim();
  }

  const envText = await readFile(resolve(API_DIRECTORY, ".dev.vars"), "utf8");
  const match = envText.match(/^COMPOSIO_API_KEY=(.*)$/m);

  if (!match) {
    throw new Error("COMPOSIO_API_KEY is not configured");
  }

  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

async function request(apiKey, path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json", "x-api-key": apiKey },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Composio ${path} failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function listAll(apiKey, path, params, resource) {
  const items = [];
  let cursor;

  do {
    const query = new URLSearchParams(params);

    if (cursor) {
      query.set("cursor", cursor);
    }

    const page = await request(apiKey, `${path}?${query}`);

    if (!Array.isArray(page.items)) {
      throw new Error(`Invalid ${resource} response`);
    }

    items.push(...page.items);
    cursor =
      typeof page.next_cursor === "string" && page.next_cursor ? page.next_cursor : undefined;
  } while (cursor);

  return items;
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = Array.from({ length: values.length });
  let index = 0;

  async function worker() {
    while (index < values.length) {
      const current = index;

      index += 1;
      results[current] = await mapper(values[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));

  return results;
}

function parseAuthConfig(data) {
  if (
    typeof data?.id !== "string" ||
    typeof data?.name !== "string" ||
    typeof data?.toolkit?.slug !== "string" ||
    typeof data?.auth_scheme !== "string" ||
    data?.status !== "ENABLED"
  ) {
    throw new Error(`Invalid enabled auth config: ${JSON.stringify(data)}`);
  }

  return {
    id: data.id,
    name: data.name,
    toolkitSlug: data.toolkit.slug,
    authScheme: data.auth_scheme,
    isManaged: data.is_composio_managed === true,
  };
}

async function listEnabledAuthConfigs(apiKey) {
  const summaries = await listAll(
    apiKey,
    "/auth_configs",
    { show_disabled: "false", limit: "50" },
    "auth configs",
  );
  const configs = await mapConcurrent(summaries, 8, async (summary) =>
    parseAuthConfig(await request(apiKey, `/auth_configs/${encodeURIComponent(summary.id)}`)),
  );

  return configs.sort((left, right) => left.toolkitSlug.localeCompare(right.toolkitSlug));
}

async function listTools(apiKey, authConfig, importantOnly = false) {
  const tools = await listAll(
    apiKey,
    "/tools",
    {
      toolkit_slug: authConfig.toolkitSlug,
      auth_config_ids: authConfig.id,
      toolkit_versions: "latest",
      include_deprecated: "false",
      limit: "1000",
      ...(importantOnly ? { important: "true" } : {}),
    },
    `${authConfig.toolkitSlug} tools`,
  );
  const unique = new Map(tools.map((tool) => [tool.slug, tool]));

  if (unique.size !== tools.length) {
    throw new Error(`Duplicate tool slugs returned for ${authConfig.toolkitSlug}`);
  }

  return [...unique.values()];
}

function normaliseOperation(tool, toolkitSlug, importantToolSlugs) {
  if (
    typeof tool.slug !== "string" ||
    tool.toolkit?.slug !== toolkitSlug ||
    tool.is_deprecated === true
  ) {
    throw new Error(`Invalid tool returned for ${toolkitSlug}: ${JSON.stringify(tool)}`);
  }

  const tags = new Set(Array.isArray(tool.tags) ? tool.tags : []);

  return {
    id: tool.slug,
    readOnlyHint: tags.has("readOnlyHint"),
    destructiveHint: tags.has("destructiveHint"),
    idempotentHint: tags.has("idempotentHint"),
    openWorldHint: tags.has("openWorldHint"),
    access: tags.has("readOnlyHint") ? "read" : "write",
    isImportant: importantToolSlugs.has(tool.slug),
  };
}

const apiKey = await readApiKey();
const authConfigs = await listEnabledAuthConfigs(apiKey);
const authConfigsByToolkit = new Map();

for (const config of authConfigs) {
  const toolkitConfigs = authConfigsByToolkit.get(config.toolkitSlug) ?? [];

  toolkitConfigs.push(config);
  authConfigsByToolkit.set(config.toolkitSlug, toolkitConfigs);
}

const entries = await mapConcurrent(
  [...authConfigsByToolkit.entries()],
  4,
  async ([toolkitSlug, configs]) => {
    const [toolkit, configTools] = await Promise.all([
      request(apiKey, `/toolkits/${encodeURIComponent(toolkitSlug)}?version=latest`),
      mapConcurrent(configs, 4, async (authConfig) => {
        const [tools, importantTools] = await Promise.all([
          listTools(apiKey, authConfig),
          listTools(apiKey, authConfig, true),
        ]);

        if (tools.length === 0) {
          throw new Error(`${authConfig.id} exposes no current tools`);
        }

        return { authConfig, tools, importantTools };
      }),
    ]);
    const allTools = configTools.flatMap(({ tools }) => tools);
    const versions = [...new Set(allTools.map((tool) => tool.version))];

    if (versions.length !== 1 || typeof versions[0] !== "string") {
      throw new Error(
        `Expected one current toolkit version for ${toolkitSlug}, received ${versions}`,
      );
    }

    if (toolkit?.slug !== toolkitSlug || typeof toolkit?.name !== "string") {
      throw new Error(`${toolkitSlug} has invalid toolkit metadata`);
    }

    const operations = new Map();

    for (const { authConfig, tools, importantTools } of configTools) {
      const importantToolSlugs = new Set(importantTools.map((tool) => tool.slug));

      for (const tool of tools) {
        const operation = normaliseOperation(tool, toolkitSlug, importantToolSlugs);
        const existing = operations.get(operation.id);

        if (existing) {
          if (
            existing.readOnlyHint !== operation.readOnlyHint ||
            existing.destructiveHint !== operation.destructiveHint ||
            existing.idempotentHint !== operation.idempotentHint ||
            existing.openWorldHint !== operation.openWorldHint
          ) {
            throw new Error(`${toolkitSlug}.${operation.id} differs between auth configs`);
          }

          existing.isImportant ||= operation.isImportant;
          existing.authConfigIds.push(authConfig.id);
        } else {
          operations.set(operation.id, { ...operation, authConfigIds: [authConfig.id] });
        }
      }
    }

    const operationList = [...operations.values()]
      .map((operation) => ({
        ...operation,
        authConfigIds: operation.authConfigIds.sort(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const readToolCount = operationList.filter((operation) => operation.access === "read").length;

    console.log(
      `${toolkitSlug}: ${operations.size} tools across ${configs.length} auth config${configs.length === 1 ? "" : "s"} (${versions[0]})`,
    );

    return [
      toolkitSlug,
      {
        providerId: toolkitSlug,
        name: toolkit.name,
        description:
          typeof toolkit.meta?.description === "string"
            ? toolkit.meta.description
            : `Use the complete configured ${toolkit.name} API surface.`,
        logoUrl:
          typeof toolkit.meta?.logo === "string"
            ? toolkit.meta.logo
            : `https://logos.composio.dev/api/${encodeURIComponent(toolkitSlug)}`,
        appUrl: typeof toolkit.meta?.app_url === "string" ? toolkit.meta.app_url : undefined,
        categories: Array.isArray(toolkit.meta?.categories)
          ? toolkit.meta.categories
              .filter(
                (category) =>
                  typeof category?.slug === "string" && typeof category?.name === "string",
              )
              .map((category) => ({ id: category.slug, name: category.name }))
          : [],
        authConfigs: configTools
          .map(({ authConfig, tools }) => ({
            id: authConfig.id,
            name: authConfig.name,
            authScheme: authConfig.authScheme,
            isManaged: authConfig.isManaged,
            ...(configs.length > 1 ? { operationIds: tools.map((tool) => tool.slug).sort() } : {}),
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        toolkitSlug,
        toolkitVersion: versions[0],
        toolCount: operationList.length,
        readToolCount,
        writeToolCount: operationList.length - readToolCount,
        scopes: [
          ...new Set(
            allTools
              .flatMap((tool) => (Array.isArray(tool.scopes) ? tool.scopes : []))
              .filter(Boolean),
          ),
        ].sort(),
        operations: {
          read: operationList
            .filter((operation) => operation.access === "read")
            .map((operation) => operation.id),
          write: operationList
            .filter((operation) => operation.access === "write")
            .map((operation) => operation.id),
          important: operationList
            .filter((operation) => operation.isImportant)
            .map((operation) => operation.id),
          destructive: operationList
            .filter((operation) => operation.destructiveHint)
            .map((operation) => operation.id),
          idempotent: operationList
            .filter((operation) => operation.idempotentHint)
            .map((operation) => operation.id),
          openWorld: operationList
            .filter((operation) => operation.openWorldHint)
            .map((operation) => operation.id),
        },
      },
    ];
  },
);

const manifest = Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));

await writeFile(OUTPUT_PATH, JSON.stringify(manifest), "utf8");
await writeFile(PROVIDER_IDS_OUTPUT_PATH, JSON.stringify(Object.keys(manifest)), "utf8");

console.log(
  `Synced ${authConfigs.length} auth configs into ${entries.length} toolkits with ${entries.reduce((total, [, toolkit]) => total + toolkit.toolCount, 0)} unique tools`,
);
