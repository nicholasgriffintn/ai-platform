import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createMetrics, resolveTelemetryIdentity } from "~/infrastructure/telemetry";
import type { IUser } from "~/types";

const logger = getLogger({ prefix: "services/sites/performance" });

export type SiteGenerationMilestone =
  | "planCompleted"
  | "modelSelected"
  | "providerStreamOpened"
  | "firstToken"
  | "firstPatch"
  | "firstRenderable"
  | "buildCompleted"
  | "initialSaved"
  | "reviewCompleted"
  | "finalSaved";

type SiteGenerationMarks = Partial<Record<SiteGenerationMilestone, number>>;

export interface SiteGenerationPerformance {
  mark(milestone: SiteGenerationMilestone): void;
  finish(outcome: "success" | "error", error?: unknown): void;
}

export function createSiteGenerationPerformance({
  context,
  user,
  completionId,
  refining,
}: {
  context: ServiceContext;
  user: IUser;
  completionId: string;
  refining: boolean;
}): SiteGenerationPerformance {
  const startedAt = Date.now();
  const marks: SiteGenerationMarks = {};
  let finished = false;

  return {
    mark(milestone) {
      marks[milestone] ??= Date.now() - startedAt;
    },
    finish(outcome, error) {
      if (finished) {
        return;
      }

      finished = true;
      const totalDurationMs = Date.now() - startedAt;
      const metadata = {
        refining,
        plan_completed_ms: marks.planCompleted,
        model_selected_ms: marks.modelSelected,
        provider_stream_opened_ms: marks.providerStreamOpened,
        first_token_ms: marks.firstToken,
        first_patch_ms: marks.firstPatch,
        first_renderable_ms: marks.firstRenderable,
        build_completed_ms: marks.buildCompleted,
        initial_saved_ms: marks.initialSaved,
        review_completed_ms: marks.reviewCompleted,
        final_saved_ms: marks.finalSaved,
      };

      try {
        createMetrics(context.env, context.executionCtx).recordMetric({
          traceId: completionId,
          type: "performance",
          name: "site_generation_finished",
          value: totalDurationMs,
          metadata,
          identity: resolveTelemetryIdentity({ user }),
          status: outcome,
          ...(error ? { error: getErrorMessage(error) } : {}),
        });
      } catch (telemetryError) {
        logger.debug("Failed to record site generation performance", {
          completion_id: completionId,
          error_message: getErrorMessage(telemetryError),
        });
      }
    },
  };
}
