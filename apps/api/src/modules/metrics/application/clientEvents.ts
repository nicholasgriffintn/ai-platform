import {
  buildTelemetryPersonProperties,
  getLogger,
  resolveAnalyticsDistinctId,
  toTelemetryRecord,
} from "@ngriffin_uk/polychat-ai-telemetry";
import {
  compactAnalyticsProperties,
  type ClientAnalyticsBatch,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveTelemetryIdentity } from "~/infrastructure/telemetry";

const logger = getLogger({ prefix: "modules/metrics/clientEvents" });

export async function recordClientEvents(
  context: ServiceContext,
  batch: ClientAnalyticsBatch,
  country: string | null,
): Promise<{ accepted: number }> {
  const stream = context.env.TELEMETRY_STREAM;

  if (!stream) {
    logger.warn("Dropped client analytics because TELEMETRY_STREAM is not bound", {
      events: batch.events.length,
    });

    return { accepted: 0 };
  }

  const identity = resolveTelemetryIdentity(context);
  const distinctId = resolveAnalyticsDistinctId(identity);
  const personProperties = buildTelemetryPersonProperties(identity);
  const now = Date.now();
  const records = batch.events.map((event) =>
    toTelemetryRecord(
      {
        traceId: "",
        timestamp: now,
        type: event.category,
        name: event.name,
        value: typeof event.value === "number" ? event.value : 1,
        status: "success",
        distinctId,
        personProperties,
        metadata: {
          ...compactAnalyticsProperties(event.properties),
          ...(event.label !== undefined ? { label: event.label } : {}),
          ...(typeof event.value === "string" ? { value_label: event.value } : {}),
          ...(event.nonInteraction !== undefined ? { nonInteraction: event.nonInteraction } : {}),
        },
      },
      {
        environment: batch.environment,
        app: batch.app,
        source: "client",
        appVersion: batch.appVersion,
        sessionId: batch.sessionId,
        path: event.path,
        country,
      },
    ),
  );

  try {
    await stream.send(records);
  } catch (error) {
    logger.error("Failed to write client analytics to Basin", { error, events: records.length });
    throw new AssistantError("Failed to record analytics", ErrorType.PROVIDER_ERROR, 502);
  }

  return { accepted: records.length };
}
