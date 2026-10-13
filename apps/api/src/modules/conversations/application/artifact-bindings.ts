import {
  getConnectorOperationConfig,
  isConnectorOperationSupported,
} from "@ngriffin_uk/polychat-ai-integrations";
import { extractArtifactBindings } from "@ngriffin_uk/polychat-library-chat/artifact-bindings";
import { formattedMessageContent } from "@ngriffin_uk/polychat-library-chat/messages";
import {
  ARTIFACT_BINDING_MAX_RESULT_CHARS,
  artifactBindingReadRequestSchema,
  type ArtifactBinding,
  type ArtifactBindingArgs,
  type ArtifactBindingReadRequest,
  type ArtifactBindingReadResponse,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { KVCache } from "~/infrastructure/cache";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { executeRecipeConnectorOperation } from "~/modules/apps/application/connectors/operations";

import { requireConversationAccess } from "./access";

const CACHE_TTL_SECONDS = 60;

function notFound(): never {
  throw new AssistantError("This data source is not available", ErrorType.NOT_FOUND, 404);
}

export function mergeBindingArgs(
  declared: ArtifactBindingArgs,
  requested: ArtifactBindingArgs | undefined,
): ArtifactBindingArgs {
  const overrides = Object.entries(requested ?? {});
  const undeclared = overrides.find(([key]) => !Object.hasOwn(declared, key));

  if (undeclared) {
    throw new AssistantError(
      `"${undeclared[0]}" is not one of this data source's declared arguments`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { ...declared, ...Object.fromEntries(overrides) };
}

export function requireReadOnlyBinding(binding: ArtifactBinding): void {
  const operation = isConnectorOperationSupported(binding.provider, binding.operation)
    ? getConnectorOperationConfig(binding.provider, binding.operation)
    : undefined;

  if (!operation) {
    throw new AssistantError(
      `${binding.operation} is not a known ${binding.provider} operation`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (operation.access !== "read") {
    throw new AssistantError(
      "Artifacts can only read data. This data source would change something, so it will not run.",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}

async function loadDeclaredBinding(
  context: ServiceContext,
  conversationId: string,
  input: ArtifactBindingReadRequest,
): Promise<ArtifactBinding> {
  const stored = await context.repositories.messages.getMessageById(input.messageId);

  if (!stored || stored.conversation_id !== conversationId || stored.message.role !== "assistant") {
    return notFound();
  }

  const content = typeof stored.message.content === "string" ? stored.message.content : "";
  const artifact = formattedMessageContent("assistant", content).artifacts.find(
    (candidate) => candidate.identifier === input.artifactIdentifier,
  );
  const binding = artifact
    ? extractArtifactBindings(artifact.content).bindings.find(
        (candidate) => candidate.id === input.bindingId,
      )
    : undefined;

  return binding ?? notFound();
}

function serialiseResult(result: unknown): unknown {
  const text = typeof result === "string" ? result : JSON.stringify(result ?? null);

  if (text.length > ARTIFACT_BINDING_MAX_RESULT_CHARS) {
    throw new AssistantError(
      "This data source returned more than one read can carry. Narrow it with a limit or filter.",
      ErrorType.PARAMS_ERROR,
      413,
    );
  }

  return typeof result === "string" ? result : JSON.parse(text);
}

export async function readArtifactBinding(
  context: ServiceContext,
  conversationId: string,
  rawInput: ArtifactBindingReadRequest,
): Promise<ArtifactBindingReadResponse> {
  const user = context.requireUser();
  const input = artifactBindingReadRequestSchema.parse(rawInput);

  await requireConversationAccess(context, conversationId);

  const binding = await loadDeclaredBinding(context, conversationId, input);

  requireReadOnlyBinding(binding);

  const args = mergeBindingArgs(binding.args, input.args);
  const limiter = context.env.PRO_RATE_LIMITER;

  if (limiter) {
    const { success } = await limiter.limit({
      key: `artifact-binding:${user.id}:${input.messageId}:${input.artifactIdentifier}`,
    });

    if (!success) {
      throw new AssistantError(
        "This artifact is reading its data too often. Wait a minute and refresh.",
        ErrorType.RATE_LIMIT_ERROR,
        429,
      );
    }
  }

  const cacheKey = `artifact-binding:${await sha256Hex(
    canonicalJson({
      userId: user.id,
      messageId: input.messageId,
      artifact: input.artifactIdentifier,
      binding: binding.id,
      args,
    }),
  )}`;
  const cache = context.env.CACHE ? new KVCache(context.env.CACHE, CACHE_TTL_SECONDS) : null;
  const cached = await cache?.get<{ data: unknown; fetchedAt: string }>(cacheKey);

  if (cached) {
    return { ...cached, cached: true };
  }

  const data = serialiseResult(
    await executeRecipeConnectorOperation({
      context,
      userId: user.id,
      request: { provider: binding.provider, operation: binding.operation, params: args },
    }),
  );
  const fetchedAt = new Date().toISOString();

  await cache?.set(cacheKey, { data, fetchedAt }, { ttl: CACHE_TTL_SECONDS });

  return { data, fetchedAt, cached: false };
}
