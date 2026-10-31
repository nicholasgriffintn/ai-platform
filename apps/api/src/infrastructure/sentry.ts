import type { TelemetryLogRecord } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveUrl } from "@ngriffin_uk/polychat-utility-server/redaction";
import type { CloudflareOptions } from "@sentry/cloudflare";
import * as Sentry from "@sentry/cloudflare";

import type { IEnv } from "~/types";

import packageJson from "../../package.json";

const NON_REPORTABLE_AUTH_ERROR_TYPES = new Set<ErrorType>([
  ErrorType.AUTHENTICATION_ERROR,
  ErrorType.AUTHORISATION_ERROR,
  ErrorType.FORBIDDEN,
  ErrorType.UNAUTHORIZED,
]);

const WARNING_ERROR_TYPES = new Set<ErrorType>([ErrorType.RATE_LIMIT_ERROR]);

export function getSentryOptions(env: Pick<IEnv, "ENV" | "SENTRY_DSN">): CloudflareOptions {
  const dsn = env.SENTRY_DSN?.trim();

  if (!dsn) {
    return { enabled: false };
  }

  return {
    dsn,
    environment: env.ENV,
    release: `polychat-api@${packageJson.version}`,
    sampleRate: 1,
    enableLogs: false,
    tracesSampler: ({ attributes, inheritOrSampleWith }) =>
      attributes?.["gen_ai.operation.name"] ? 1 : inheritOrSampleWith(0),
    beforeSend(event) {
      if (!event.exception?.values?.length) {
        return null;
      }

      if (event.request?.url) {
        event.request.url = redactSensitiveUrl(event.request.url);
      }

      if (event.request) {
        delete event.request.query_string;
      }

      return event;
    },
    enableRpcTracePropagation: true,
  };
}

export function shouldCaptureApiError(error: AssistantError): boolean {
  if (NON_REPORTABLE_AUTH_ERROR_TYPES.has(error.type)) {
    return false;
  }

  return WARNING_ERROR_TYPES.has(error.type) || (error.statusCode ?? 500) >= 500;
}

export function captureApiError(error: AssistantError, originalError: Error = error): void {
  if (!shouldCaptureApiError(error)) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(WARNING_ERROR_TYPES.has(error.type) ? "warning" : "error");
    scope.setTag("error.type", error.type);
    scope.setTag("http.status_code", String(error.statusCode ?? 500));

    const requestId = error.context?.requestId;

    if (requestId) {
      scope.setTag("request_id", requestId);
    }

    Sentry.captureException(originalError);
  });
}

export function captureLoggedError(record: TelemetryLogRecord): void {
  if (record.level !== "error" || !record.error || !Sentry.isEnabled()) {
    return;
  }

  if (record.error instanceof AssistantError && !shouldCaptureApiError(record.error)) {
    return;
  }

  const { error } = record;

  Sentry.withScope((scope) => {
    scope.setTag("logger", record.prefix ?? "root");
    scope.setContext("log", { message: record.message });
    Sentry.captureException(error);
  });
}

export function setSentryUser(id: string | number | undefined): void {
  if (id === undefined || !Sentry.isEnabled()) {
    return;
  }

  Sentry.setUser({ id: String(id) });
}
