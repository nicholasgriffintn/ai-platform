import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { parseJsonLines } from "@ngriffin_uk/polychat-utility-core";
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

const logger = getLogger({ prefix: "lib/batch/anthropic" });

const ANTHROPIC_API = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

const batchSchema = z.object({
  id: z.string().min(1),
  processing_status: z.enum(["in_progress", "canceling", "ended"]),
  results_url: z.string().url().nullable().optional(),
});

const resultLineSchema = z.object({
  custom_id: z.string(),
  result: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("succeeded"),
      message: z.object({
        content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
      }),
    }),
    z.object({
      type: z.literal("errored"),
      error: z
        .object({ error: z.object({ message: z.string().optional() }).optional() })
        .optional(),
    }),
    z.object({ type: z.literal("canceled") }),
    z.object({ type: z.literal("expired") }),
  ]),
});

function toResult(line: unknown): BatchCompletionResult | null {
  const parsed = resultLineSchema.safeParse(line);

  if (!parsed.success) {
    return null;
  }

  const { custom_id: id, result } = parsed.data;

  switch (result.type) {
    case "succeeded":
      return {
        id,
        text: result.message.content
          .flatMap((block) => (block.type === "text" && block.text ? [block.text] : []))
          .join(""),
      };
    case "errored":
      return { id, error: result.error?.error?.message ?? "The request errored" };
    default:
      return { id, error: `The request was ${result.type}` };
  }
}

export class AnthropicBatchProvider implements BatchProvider {
  name = "anthropic";

  constructor(
    private readonly env: ProviderEnv,
    private readonly runtime: ProviderRuntime,
  ) {}

  private async request(url: string, init: BatchRequestInit = {}): Promise<Response> {
    const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
      env: this.env,
      providerName: this.name,
      envKeyName: "ANTHROPIC_API_KEY",
      logger,
    });
    const response = await fetch(url, {
      ...init,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Anthropic batch request failed"),
        ErrorType.EXTERNAL_API_ERROR,
        response.status,
      );
    }

    return response;
  }

  async submit(items: readonly BatchCompletionItem[]): Promise<{ batchId: string }> {
    const batch = batchSchema.parse(
      await (
        await this.request(`${ANTHROPIC_API}/messages/batches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: items.map((item) => ({
              custom_id: item.id,
              params: {
                model: item.model,
                max_tokens: item.maxTokens,
                ...(item.system ? { system: item.system } : {}),
                messages: [{ role: "user", content: item.prompt }],
              },
            })),
          }),
        })
      ).json(),
    );

    return { batchId: batch.id };
  }

  async poll(batchId: string): Promise<BatchPoll> {
    const batch = batchSchema.parse(
      await (
        await this.request(`${ANTHROPIC_API}/messages/batches/${encodeURIComponent(batchId)}`)
      ).json(),
    );

    if (batch.processing_status !== "ended") {
      return { status: "in_progress" };
    }

    if (!batch.results_url || new URL(batch.results_url).origin !== new URL(ANTHROPIC_API).origin) {
      return { status: "failed", reason: "The Anthropic batch ended without usable results" };
    }

    const text = await (await this.request(batch.results_url)).text();

    return {
      status: "completed",
      results: parseJsonLines(text).flatMap((line) => {
        const result = toResult(line);

        return result ? [result] : [];
      }),
    };
  }
}
