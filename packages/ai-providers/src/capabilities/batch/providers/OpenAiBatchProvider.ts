import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { formatJsonLines, parseJsonLines } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderEnv } from "../../../env.js";
import type { ProviderRuntime } from "../../../runtime.js";
import { formatProviderError } from "../../../utils/errors.js";
import type {
  BatchRequestInit,
  BatchCompletionItem,
  BatchCompletionResult,
  BatchPoll,
  BatchProvider,
} from "../types.js";

const logger = getLogger({ prefix: "lib/batch/openai" });

const OPENAI_API = "https://api.openai.com/v1";
const COMPLETIONS_ENDPOINT = "/v1/chat/completions";
const IN_PROGRESS = new Set(["validating", "in_progress", "finalizing"]);

const fileSchema = z.object({ id: z.string().min(1) });

const batchSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  output_file_id: z.string().nullable().optional(),
  error_file_id: z.string().nullable().optional(),
  errors: z
    .object({ data: z.array(z.object({ message: z.string().optional() })).optional() })
    .nullable()
    .optional(),
});

const outputLineSchema = z.object({
  custom_id: z.string(),
  response: z
    .object({
      status_code: z.number(),
      body: z.object({
        choices: z
          .array(z.object({ message: z.object({ content: z.string().nullable().optional() }) }))
          .optional(),
        error: z.object({ message: z.string().optional() }).optional(),
      }),
    })
    .nullable()
    .optional(),
  error: z.object({ message: z.string().optional() }).nullable().optional(),
});

function toResult(line: unknown): BatchCompletionResult | null {
  const parsed = outputLineSchema.safeParse(line);

  if (!parsed.success) {
    return null;
  }

  const { custom_id: id, response, error } = parsed.data;
  const text = response?.body.choices?.[0]?.message.content ?? undefined;

  if (response && response.status_code < 400 && typeof text === "string") {
    return { id, text };
  }

  return {
    id,
    error:
      error?.message ??
      response?.body.error?.message ??
      `Request failed with status ${response?.status_code ?? "unknown"}`,
  };
}

export class OpenAiBatchProvider implements BatchProvider {
  name = "openai";

  constructor(
    private readonly env: ProviderEnv,
    private readonly runtime: ProviderRuntime,
  ) {}

  private async request(path: string, init: BatchRequestInit = {}): Promise<Response> {
    const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
      env: this.env,
      providerName: this.name,
      envKeyName: "OPENAI_API_KEY",
      logger,
    });
    const response = await fetch(`${OPENAI_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, ...init.headers },
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "OpenAI batch request failed"),
        ErrorType.EXTERNAL_API_ERROR,
        response.status,
      );
    }

    return response;
  }

  async submit(items: readonly BatchCompletionItem[]): Promise<{ batchId: string }> {
    const lines = formatJsonLines(
      items.map((item) => ({
        custom_id: item.id,
        method: "POST",
        url: COMPLETIONS_ENDPOINT,
        body: {
          model: item.model,
          max_completion_tokens: item.maxTokens,
          messages: [
            ...(item.system ? [{ role: "system", content: item.system }] : []),
            { role: "user", content: item.prompt },
          ],
        },
      })),
    );
    const form = new FormData();

    form.append("purpose", "batch");
    form.append("file", new Blob([lines], { type: "application/jsonl" }), "batch.jsonl");

    const file = fileSchema.parse(
      await (await this.request("/files", { method: "POST", body: form })).json(),
    );
    const batch = batchSchema.parse(
      await (
        await this.request("/batches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_file_id: file.id,
            endpoint: COMPLETIONS_ENDPOINT,
            completion_window: "24h",
          }),
        })
      ).json(),
    );

    return { batchId: batch.id };
  }

  private async readResults(fileId: string | null | undefined): Promise<BatchCompletionResult[]> {
    if (!fileId) {
      return [];
    }

    const text = await (await this.request(`/files/${encodeURIComponent(fileId)}/content`)).text();

    return parseJsonLines(text).flatMap((line) => {
      const result = toResult(line);

      return result ? [result] : [];
    });
  }

  async poll(batchId: string): Promise<BatchPoll> {
    const batch = batchSchema.parse(
      await (await this.request(`/batches/${encodeURIComponent(batchId)}`)).json(),
    );

    if (IN_PROGRESS.has(batch.status)) {
      return { status: "in_progress" };
    }

    if (batch.status !== "completed") {
      return {
        status: "failed",
        reason:
          batch.errors?.data?.[0]?.message ?? `The OpenAI batch ended with status ${batch.status}`,
      };
    }

    const [outputs, errors] = await Promise.all([
      this.readResults(batch.output_file_id),
      this.readResults(batch.error_file_id),
    ]);

    return { status: "completed", results: [...outputs, ...errors] };
  }
}
