import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { DISCOVER_RECIPE_ID, recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { fetchSyndicationFeed } from "@ngriffin_uk/polychat-utility-server/feeds";
import {
  fetchFollowingSafeRedirects,
  readResponseTextWithinLimit,
} from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { executeRecipeConnectorOperation } from "~/modules/connectors/application/operations";
import type {
  DiscoverConnectorSignal,
  DiscoverPublicSignal,
  DiscoverSignal,
  DiscoverSignalRead,
} from "~/modules/discover/domain/signal-sources/types";

const logger = getLogger({ prefix: "discover/signal-reads" });
const SIGNAL_EXPANSION_CONCURRENCY = 4;
const PUBLIC_RESPONSE_BYTES = 5_000_000;

type SignalOperationRunner = (
  operation: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

async function expandConnectorSignal(
  signal: DiscoverConnectorSignal,
  listed: unknown,
  read: DiscoverSignalRead,
  run: SignalOperationRunner,
): Promise<unknown> {
  const expansion = signal.expand;

  if (!expansion) {
    return listed;
  }

  const requests = expansion.requests(listed, read);
  const failures: unknown[] = [];
  const results = await mapWithConcurrency(requests, SIGNAL_EXPANSION_CONCURRENCY, (params) =>
    run(expansion.operation, params).catch((error: unknown) => {
      failures.push(error);
      logger.warn("Part of a Discover signal could not be read", {
        signal: signal.id,
        error_message: getErrorMessage(error),
      });

      return null;
    }),
  );

  if (requests.length > 0 && failures.length === requests.length) {
    throw failures[0];
  }

  return results.filter((result) => result !== null);
}

async function readConnectorSignal(
  context: ServiceContext,
  signal: DiscoverConnectorSignal,
  read: DiscoverSignalRead,
): Promise<unknown> {
  const userId = context.requireUser().id;
  const run: SignalOperationRunner = (operation, params) =>
    executeRecipeConnectorOperation({
      context,
      userId,
      request: {
        provider: recipeConnectorProviderSchema.parse(signal.providerId),
        operation,
        params,
      },
      scope: {
        completionId: context.connectorRunId,
        conversationId: null,
        recipeId: DISCOVER_RECIPE_ID,
      },
    });

  return expandConnectorSignal(
    signal,
    await run(signal.operation, signal.parameters(read)),
    read,
    run,
  );
}

async function readPublicSignal(
  signal: DiscoverPublicSignal,
  read: DiscoverSignalRead,
): Promise<unknown> {
  const url = signal.url(read);

  if (signal.format === "feed") {
    return fetchSyndicationFeed(url, PUBLIC_RESPONSE_BYTES);
  }

  const response = await fetchFollowingSafeRedirects(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `${signal.title} answered with ${response.status}`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const body = await readResponseTextWithinLimit(response, PUBLIC_RESPONSE_BYTES);
  const parsed = safeParseJson<unknown>(body);

  if (parsed === null) {
    throw new AssistantError(
      `${signal.title} did not answer with JSON`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return parsed;
}

export function readDiscoverSignalResult(
  context: ServiceContext,
  signal: DiscoverSignal,
  read: DiscoverSignalRead,
): Promise<unknown> {
  return signal.kind === "public"
    ? readPublicSignal(signal, read)
    : readConnectorSignal(context, signal, read);
}
