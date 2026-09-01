import { withRetry } from "@ngriffin_uk/polychat-library-client/retry";
import type { SandboxRunUsageReport } from "@ngriffin_uk/polychat-schemas";

const USAGE_REPORT_USER_AGENT = "Polychat-Sandbox-Worker/1.0 (+https://polychat.app)";
const USAGE_REPORT_MAX_ATTEMPTS = 3;
const USAGE_REPORT_BASE_DELAY_MS = 400;
const USAGE_REPORT_MAX_DELAY_MS = 3000;
const DEFAULT_INSTANCE_TYPE = "basic";

export function buildSandboxRunUsageReport(params: {
  runId: string;
  userId: number;
  instanceType: string | undefined;
  startedAtMs: number;
  endedAtMs: number;
}): SandboxRunUsageReport {
  const endedAtMs = Math.max(params.endedAtMs, params.startedAtMs);

  return {
    runId: params.runId,
    userId: params.userId,
    instanceType: params.instanceType?.trim() || DEFAULT_INSTANCE_TYPE,
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
          new Request(
            `http://polychat-api/apps/sandbox/runs/${encodeURIComponent(params.report.runId)}/usage`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${params.userToken}`,
                "User-Agent": USAGE_REPORT_USER_AGENT,
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
