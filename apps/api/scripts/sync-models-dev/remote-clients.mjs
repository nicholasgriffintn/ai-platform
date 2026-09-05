import z from "zod/v4";

const remoteModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    family: z.string().optional(),
    attachment: z.boolean().optional(),
    temperature: z.boolean().optional(),
    tool_call: z.boolean().optional(),
    structured_output: z.boolean().optional(),
    reasoning: z.boolean().optional(),
    open_weights: z.boolean().optional(),
    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    modalities: z.object({ input: z.array(z.string()), output: z.array(z.string()) }).optional(),
    limit: z
      .object({
        context: z.number().nonnegative().optional(),
        output: z.number().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
    cost: z
      .object({
        input: z.number().nonnegative().optional(),
        output: z.number().nonnegative().optional(),
        reasoning: z.number().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const remoteProvidersSchema = z.record(
  z.string(),
  z
    .object({
      models: z.record(z.string(), remoteModelSchema),
      status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    })
    .passthrough(),
);

export async function fetchApiData(apiUrl) {
  const response = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${apiUrl}: ${response.status}`);
  }

  return validateRemoteProviders(await response.json());
}

export function validateRemoteProviders(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("models.dev payload is not a provider map");
  }

  return remoteProvidersSchema.parse(json);
}

export function buildArtificialAnalysisModelsUrl(apiUrl) {
  if (!apiUrl) {
    return null;
  }

  const url = new URL(apiUrl);

  if (!url.pathname.endsWith("/models/artificial-analysis")) {
    return new URL("/models/artificial-analysis", url).toString();
  }

  return url.toString();
}

export async function fetchArtificialAnalysisData({ apiUrl, apiKey }) {
  if (!apiKey) {
    return [];
  }

  const modelsUrl = buildArtificialAnalysisModelsUrl(apiUrl);

  if (!modelsUrl) {
    return [];
  }

  const models = [];
  let page = 1;

  while (true) {
    const url = new URL(modelsUrl);

    url.searchParams.set("page", String(page));
    if (!url.searchParams.has("limit")) {
      url.searchParams.set("limit", "100");
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url.toString()}: ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.models)) {
      throw new Error("Polychat Artificial Analysis payload is not a model list");
    }

    models.push(...payload.models);
    const totalPages =
      typeof payload.pagination?.totalPages === "number" ? payload.pagination.totalPages : page;

    if (page >= totalPages) {
      break;
    }

    page += 1;
  }

  return models;
}
