import {
  extractTextFromMessageContent,
  type ChatCompletionParameters,
  type Message,
  type ProviderRuntime,
} from "@ngriffin_uk/polychat-ai-providers";
import { flattenObjectRootSchema } from "@ngriffin_uk/polychat-library-tools";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type {
  CompletionMetadata,
  CompletionRequest,
  CompletionResult,
  StructuredResult,
} from "./types.js";

export interface ResolvedCompletionTarget {
  model: string;
  provider: string;
}

export interface StructuredRequest<TObject> extends CompletionRequest {
  schema: z.ZodType<TObject>;
  name?: string;
}

export interface Ai {
  resolveTarget(request: CompletionRequest): Promise<ResolvedCompletionTarget>;
  complete(request: CompletionRequest): Promise<CompletionResult>;
  stream(request: CompletionRequest): Promise<unknown>;
  generateText(request: CompletionRequest | string, scope?: CompletionRequest): Promise<string>;
  generateObject<TObject>(request: StructuredRequest<TObject>): Promise<StructuredResult<TObject>>;
}

export function buildCompletionMessages(request: CompletionRequest): Message[] {
  const messages: Message[] = [];

  if (request.system) {
    messages.push({ role: "system", content: request.system });
  }

  if (request.messages?.length) {
    messages.push(...request.messages);
  } else if (request.prompt) {
    messages.push({ role: "user", content: request.prompt });
  }

  if (messages.length === 0) {
    throw new AssistantError("A prompt or messages are required", ErrorType.PARAMS_ERROR, 400);
  }

  return messages;
}

export function extractCompletionText(response: unknown): string {
  if (!isRecord(response)) {
    return typeof response === "string" ? response.trim() : "";
  }

  if (typeof response.response === "string") {
    return response.response.trim();
  }

  if (Array.isArray(response.response)) {
    return extractTextFromMessageContent(response.response);
  }

  return typeof response.content === "string" ? response.content.trim() : "";
}

export function extractCompletionMetadata(response: unknown): CompletionMetadata {
  if (!isRecord(response)) {
    return {};
  }

  return {
    id: typeof response.id === "string" ? response.id : undefined,
    logId: typeof response.log_id === "string" ? response.log_id : undefined,
    citations: Array.isArray(response.citations) ? response.citations : undefined,
    usage: response.usage,
  };
}

function requiresEveryProperty(schema: Record<string, unknown>): boolean {
  if (!isRecord(schema.properties)) {
    return false;
  }

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);

  return Object.keys(schema.properties).every((key) => required.has(key));
}

function toJsonSchema(schema: z.ZodType, name: string) {
  const { $schema: _schema, ...jsonSchema } = z.toJSONSchema(schema, { io: "input" });
  const flattened = flattenObjectRootSchema(jsonSchema);

  return {
    type: "json_schema" as const,
    json_schema: {
      name,
      strict: requiresEveryProperty(flattened),
      schema: flattened,
    },
  };
}

export function createAi(runtime: ProviderRuntime): Ai {
  const resolveTarget = async (request: CompletionRequest): Promise<ResolvedCompletionTarget> => {
    if (!request.model) {
      throw new AssistantError("A model is required", ErrorType.PARAMS_ERROR, 400);
    }

    const provider =
      request.provider ??
      (await runtime.host.models.findModelConfig(request.model, request.env))?.provider;

    if (!provider) {
      throw new AssistantError(
        `No provider is registered for model ${request.model}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    return { model: request.model, provider };
  };

  const buildParams = (
    request: CompletionRequest,
    target: ResolvedCompletionTarget,
  ): ChatCompletionParameters => {
    const { env, user, messages: _messages, prompt: _prompt, system: _system, ...rest } = request;

    return {
      ...rest,
      env,
      model: target.model,
      provider: target.provider,
      messages: buildCompletionMessages(request),
      context: { env, user },
    };
  };

  const run = async (request: CompletionRequest): Promise<CompletionResult> => {
    const target = await resolveTarget(request);
    const provider = runtime.providers.resolve("chat", target.provider, {
      env: request.env,
      user: request.user,
    });
    const raw = await provider.getResponse(
      buildParams({ ...request, stream: false }, target),
      request.user?.id,
    );

    return { ...extractCompletionMetadata(raw), text: extractCompletionText(raw), raw, ...target };
  };

  return {
    resolveTarget,
    complete: run,
    stream: async (request) => {
      const target = await resolveTarget(request);
      const provider = runtime.providers.resolve("chat", target.provider, {
        env: request.env,
        user: request.user,
      });

      return provider.getResponse(
        buildParams({ ...request, stream: true }, target),
        request.user?.id,
      );
    },
    generateText: async (request, scope) => {
      const merged = typeof request === "string" ? { ...scope, prompt: request } : request;

      if (!merged?.env) {
        throw new AssistantError("An env scope is required", ErrorType.PARAMS_ERROR, 400);
      }

      return (await run(merged as CompletionRequest)).text;
    },
    generateObject: async (request) => {
      const { schema, name = "structured_output", ...completion } = request;
      const result = await run({
        ...completion,
        response_format: toJsonSchema(schema, name),
      });
      const parsed = parseAIResponseJson<unknown>(result.text);

      if (parsed.data === null) {
        throw new AssistantError(
          `The model did not return valid JSON: ${parsed.error}`,
          ErrorType.PROVIDER_ERROR,
        );
      }

      const validated = schema.safeParse(parsed.data);

      if (!validated.success) {
        throw new AssistantError(
          `The model response did not match the schema: ${validated.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("; ")}`,
          ErrorType.PROVIDER_ERROR,
        );
      }

      return { ...result, object: validated.data };
    },
  };
}
