import { readEnvString } from "@ngriffin_uk/polychat-utility-server/env";

import { getPashiToolFields, isPashiToolExecutable } from "./catalogue.js";
import {
  pashiConversionJobSchema,
  pashiInfoSchema,
  type PashiInfo,
  type PashiOperation,
  type PashiOperationResult,
  type PashiTool,
} from "./contracts.js";

const DEFAULT_PASHI_ORIGIN = "https://pashi.app";
const PASHI_INFO_PATH = "/api/info";
const PASHI_CONFIGURATION_ERROR_MESSAGE = "PASHI_API_KEY is required to access Pashi.";
const DEFAULT_CATALOG_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;
const CONVERSION_POLL_INTERVAL_MS = 2_000;
const CONVERSION_TIMEOUT_MS = 120_000;

export interface PashiEnvironment {
  PASHI_API_KEY?: string;
  PASHI_URL?: string;
}

export function resolvePashiOrigin(value?: string): string {
  const configured = readEnvString(value);

  return configured ? new URL(configured).origin : DEFAULT_PASHI_ORIGIN;
}

export type PashiClientErrorCode =
  | "catalog_unavailable"
  | "configuration_error"
  | "invalid_catalog"
  | "invalid_input"
  | "timeout"
  | "tool_not_found"
  | "tool_unavailable"
  | "upstream_error";

export class PashiClientError extends Error {
  constructor(
    public readonly code: PashiClientErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PashiClientError";
  }
}

interface PashiClientOptions {
  apiKey: string;
  origin?: string;
  catalogTtlMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  supportsFiles?: boolean;
  timeoutMs?: number;
}

export class PashiClient {
  readonly supportsFiles: boolean;
  private readonly apiKey: string;
  private readonly origin: string;
  private readonly catalogTtlMs: number;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;
  private cachedInfo?: { expiresAt: number; value: PashiInfo };
  private pendingInfo?: Promise<PashiInfo>;

  constructor(options: PashiClientOptions) {
    const apiKey = readEnvString(options.apiKey);

    if (!apiKey) {
      throw new PashiClientError("configuration_error", PASHI_CONFIGURATION_ERROR_MESSAGE);
    }

    this.apiKey = apiKey;
    this.origin = resolvePashiOrigin(options.origin);
    this.catalogTtlMs = options.catalogTtlMs ?? DEFAULT_CATALOG_TTL_MS;
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ?? ((milliseconds) => new Promise((done) => setTimeout(done, milliseconds)));
    this.supportsFiles = options.supportsFiles ?? false;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getInfo(): Promise<PashiInfo> {
    if (this.cachedInfo && this.cachedInfo.expiresAt > this.now()) {
      return this.cachedInfo.value;
    }

    if (this.pendingInfo !== undefined) {
      return this.pendingInfo;
    }

    this.pendingInfo = this.fetchInfo();
    try {
      const value = await this.pendingInfo;

      this.cachedInfo = {
        expiresAt: this.now() + this.catalogTtlMs,
        value,
      };

      return value;
    } finally {
      this.pendingInfo = undefined;
    }
  }

  async execute(operation: PashiOperation): Promise<PashiOperationResult> {
    const info = await this.getInfo();
    const tool = info.tools.find((candidate) => candidate.id === operation.toolId);

    if (!tool) {
      throw new PashiClientError(
        "tool_not_found",
        `Pashi tool "${operation.toolId}" was not found. Refresh discovery before retrying.`,
      );
    }

    if (!isPashiToolExecutable(tool, this.supportsFiles)) {
      throw new PashiClientError(
        "tool_unavailable",
        tool.input.kind === "file"
          ? `Pashi tool "${tool.id}" needs Pashi linked to this account, from the sign-in page on pashi.app.`
          : `Pashi tool "${tool.id}" is currently unavailable.`,
      );
    }

    if (tool.input.kind === "file") {
      return this.convertFile(tool, operation);
    }

    const fields = validateOperation(tool, operation);

    if (tool.toolType === "generator" && tool.result?.kind === "image") {
      return {
        data: {
          imageUrl: buildPashiImageUrl(this.origin, tool, operation.input, fields),
        },
        resultKind: "image",
        toolId: tool.id,
        toolType: tool.toolType,
      };
    }

    const data = await this.requestJson(
      tool.endpoint,
      {
        body: JSON.stringify({
          fields,
          input: operation.input ?? "",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      false,
    );

    return {
      data,
      resultKind: tool.result?.kind ?? "fields",
      toolId: tool.id,
      toolType: tool.toolType,
    };
  }

  private async convertFile(
    tool: PashiTool,
    operation: PashiOperation,
  ): Promise<PashiOperationResult> {
    if (!operation.file) {
      throw new PashiClientError(
        "invalid_input",
        `Pashi tool "${tool.id}" converts a file. Pass file_url with a file from this chat.`,
      );
    }

    const form = new FormData();

    form.set("file", operation.file.blob, operation.file.name);

    for (const [id, value] of Object.entries(validateOperation(tool, operation))) {
      form.set(id, value);
    }

    const queued = parseConversionJob(
      await this.requestJson(tool.endpoint, { body: form, method: "POST" }, false),
    );
    const finished = await this.waitForConversion(tool, queued);
    const response = await this.send(
      `${tool.endpoint}?download=${encodeURIComponent(finished.jobId)}`,
      {},
      false,
    );
    const name = `pashi-${finished.jobId}.${finished.outputFormat}`;

    return {
      data: { jobId: finished.jobId, name, outputFormat: finished.outputFormat },
      file: { blob: await response.blob(), name },
      resultKind: "file",
      toolId: tool.id,
      toolType: tool.toolType,
    };
  }

  private async waitForConversion(tool: PashiTool, queued: PashiConversionJob) {
    const deadline = this.now() + CONVERSION_TIMEOUT_MS;
    let job = queued;

    while (job.status === "queued" || job.status === "processing") {
      if (this.now() >= deadline) {
        throw new PashiClientError("timeout", "Pashi is still converting that file.");
      }

      await this.sleep(CONVERSION_POLL_INTERVAL_MS);
      job = parseConversionJob(
        await this.requestJson(`${tool.endpoint}?job=${encodeURIComponent(job.jobId)}`, {}),
      );
    }

    if (job.status === "failed") {
      throw new PashiClientError(
        "upstream_error",
        job.error || "Pashi could not convert that file.",
      );
    }

    return job;
  }

  private async fetchInfo(): Promise<PashiInfo> {
    let data: unknown;

    try {
      data = await this.requestJson(PASHI_INFO_PATH, {
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      if (error instanceof PashiClientError) {
        throw new PashiClientError(
          error.code === "timeout" ? "timeout" : "catalog_unavailable",
          error.code === "timeout"
            ? "Pashi catalogue request timed out."
            : "Pashi catalogue is currently unavailable.",
          error.status,
        );
      }

      throw error;
    }

    const parsed = pashiInfoSchema.safeParse(data);

    if (!parsed.success) {
      throw new PashiClientError(
        "invalid_catalog",
        "Pashi returned a catalogue that does not match the supported contract.",
      );
    }

    for (const tool of parsed.data.tools) {
      resolvePashiUrl(this.origin, tool.endpoint);
    }

    return parsed.data;
  }

  private async requestJson(
    path: string,
    init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
    bounded = true,
  ): Promise<unknown> {
    const response = await this.send(path, init, bounded);
    const body = await response.text();

    try {
      return JSON.parse(body);
    } catch {
      throw new PashiClientError(
        "upstream_error",
        "Pashi returned an invalid JSON response.",
        response.status,
      );
    }
  }

  private async send(
    path: string,
    init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
    bounded: boolean,
  ): Promise<Response> {
    const url = resolvePashiUrl(this.origin, path);
    const controller = new AbortController();
    const timeoutId = bounded ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;

    let response: Response;

    try {
      response = await this.fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...init.headers,
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PashiClientError("timeout", "Pashi request timed out.");
      }

      throw new PashiClientError("upstream_error", "Pashi request failed.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403) {
      throw new PashiClientError(
        "tool_unavailable",
        response.status === 401
          ? "Pashi no longer accepts this link. Reconnect from the sign-in page on pashi.app."
          : "Media conversion in Pashi needs Polychat Pro.",
        response.status,
      );
    }

    if (!response.ok) {
      throw new PashiClientError(
        "upstream_error",
        `Pashi request failed with status ${response.status}.`,
        response.status,
      );
    }

    return response;
  }
}

type PashiConversionJob = ReturnType<typeof parseConversionJob>;

function parseConversionJob(value: unknown) {
  const parsed = pashiConversionJobSchema.safeParse(value);

  if (!parsed.success) {
    throw new PashiClientError("upstream_error", "Pashi returned an unexpected conversion job.");
  }

  return parsed.data.result;
}

const clientsByEnvironment = new WeakMap<
  PashiEnvironment,
  { apiKey: string; client: PashiClient; origin?: string }
>();

export function getPashiClient(env: PashiEnvironment): PashiClient {
  const apiKey = readEnvString(env.PASHI_API_KEY);

  if (!apiKey) {
    throw new PashiClientError("configuration_error", PASHI_CONFIGURATION_ERROR_MESSAGE);
  }

  const cached = clientsByEnvironment.get(env);

  if (cached?.apiKey === apiKey && cached.origin === env.PASHI_URL) {
    return cached.client;
  }

  const client = new PashiClient({ apiKey, origin: env.PASHI_URL });

  clientsByEnvironment.set(env, { apiKey, client, origin: env.PASHI_URL });

  return client;
}

function resolvePashiUrl(origin: string, path: string): string {
  const url = new URL(path, origin);

  if (url.origin !== origin || !url.pathname.startsWith("/api/")) {
    throw new PashiClientError("invalid_catalog", "Pashi returned an unsafe API endpoint.");
  }

  return url.toString();
}

function validateOperation(tool: PashiTool, operation: PashiOperation): Record<string, string> {
  const input = operation.input ?? "";
  const fields = operation.fields ?? {};
  const entries = Object.entries(fields);

  const descriptors = getPashiToolFields(tool);
  const descriptorById = new Map(descriptors.map((field) => [field.id, field]));
  const unknownField = entries.find(([id]) => !descriptorById.has(id));

  if (unknownField) {
    throw new PashiClientError(
      "invalid_input",
      `Field "${unknownField[0]}" is not supported by Pashi tool "${tool.id}".`,
    );
  }

  const missingField = descriptors.find(
    (field) => field.required && !(field.id in fields) && field.defaultValue === undefined,
  );

  if (missingField) {
    throw new PashiClientError(
      "invalid_input",
      `Field "${missingField.id}" is required by Pashi tool "${tool.id}".`,
    );
  }

  for (const [id, value] of entries) {
    const descriptor = descriptorById.get(id);
    const allowedValues = descriptor?.options ?? descriptor?.values;

    if (allowedValues?.length && !allowedValues.includes(value)) {
      throw new PashiClientError(
        "invalid_input",
        `Field "${id}" must be one of: ${allowedValues.join(", ")}.`,
      );
    }
  }

  const hasStructuredFields = descriptors.length > 0;
  const requiresInput =
    tool.toolType === "converter"
      ? tool.input.required
      : tool.input.mode !== "none" && tool.input.required && !hasStructuredFields;

  if (requiresInput && !input.trim() && !operation.file) {
    throw new PashiClientError(
      "invalid_input",
      `Pashi tool "${tool.id}" requires ${tool.input.label.toLowerCase()}.`,
    );
  }

  return fields;
}

function buildPashiImageUrl(
  origin: string,
  tool: PashiTool,
  input: string | undefined,
  fields: Record<string, string>,
): string {
  const url = new URL(resolvePashiUrl(origin, tool.endpoint));

  url.searchParams.set("generate", "1");
  if (input) {
    url.searchParams.set("input", input);
  }

  for (const [key, value] of Object.entries(fields)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
