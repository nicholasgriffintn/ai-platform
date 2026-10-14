import { withRetry } from "@ngriffin_uk/polychat-library-client/retry";
import {
  SANDBOX_WORKSPACE_INSTANCE_TYPE,
  type SandboxRunUsageReport,
} from "@ngriffin_uk/polychat-schemas";

import { createPolychatRequest } from "./polychat-request";

const USAGE_REPORT_MAX_ATTEMPTS = 3;
const USAGE_REPORT_BASE_DELAY_MS = 400;
const USAGE_REPORT_MAX_DELAY_MS = 3000;

export function buildSandboxRunUsageReport(params: {
  runId: string;
  userId: number;
  startedAtMs: number;
  endedAtMs: number;
}): SandboxRunUsageReport {
  const endedAtMs = Math.max(params.endedAtMs, params.startedAtMs);

  return {
    runId: params.runId,
    userId: params.userId,
    instanceType: SANDBOX_WORKSPACE_INSTANCE_TYPE,
    startedAt: new Date(params.startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationSeconds: Math.round((endedAtMs - params.startedAtMs) / 1000),
  };
}

export async function reportSandboxRunUsage(params: {
  polychatApi: Pick<Fetcher, "fetch">;
  userToken: string;
  report: SandboxRunUsageReport;
}): Promise<boolean> {
  try {
    await withRetry(
      async () => {
        const response = await params.polychatApi.fetch(
          createPolychatRequest(
            `/environments/${encodeURIComponent(params.report.runId)}/usage_reports`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${params.userToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(params.report),
            },
          ),
        );

        if (!response.ok) {
          throw new Error(`Sandbox usage report failed (${response.status})`);
        }
      },
      {
        maxAttempts: USAGE_REPORT_MAX_ATTEMPTS,
        baseDelayMs: USAGE_REPORT_BASE_DELAY_MS,
        maxDelayMs: USAGE_REPORT_MAX_DELAY_MS,
        isRetryable: () => true,
      },
    );

    return true;
  } catch (error) {
    console.error("Failed to report sandbox run usage", {
      runId: params.report.runId,
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
}
