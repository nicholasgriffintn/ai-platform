import { useEffect } from "react";

import { usePetStore } from "~/state/stores/petStore";
import { useUsageStore } from "~/state/stores/usageStore";

const USAGE_NUDGE_ID = "usage-close-to-limit";
const GOAL_NUDGE_ID = "goal-stopped";
const QUESTION_NUDGE_ID = "pending-question";

export interface PetNudgeSources {
  goalStatus?: string | null;
  goalStoppedReason?: string | null;
  hasPendingQuestion?: boolean;
}

export function usePetNudgeSources({
  goalStatus,
  goalStoppedReason,
  hasPendingQuestion = false,
}: PetNudgeSources): void {
  const usageLimits = useUsageStore((state) => state.usageLimits);
  const pushNudge = usePetStore((state) => state.pushNudge);
  const retractNudge = usePetStore((state) => state.retractNudge);

  useEffect(() => {
    const credits = usageLimits?.credits;

    if (!credits || credits.state === "ok") {
      retractNudge(USAGE_NUDGE_ID);

      return;
    }

    pushNudge({
      id: USAGE_NUDGE_ID,
      message:
        credits.state === "exhausted"
          ? "Your credits are spent for this period."
          : "You are into your credit reserve.",
      actionLabel: "See usage",
      href: "/profile?tab=billing",
    });
  }, [pushNudge, retractNudge, usageLimits]);

  useEffect(() => {
    if (goalStatus === "stopped" || goalStatus === "paused") {
      pushNudge({
        id: GOAL_NUDGE_ID,
        message: goalStoppedReason
          ? `The goal stopped: ${goalStoppedReason}`
          : "The goal has stopped and is waiting for you.",
      });

      return;
    }

    retractNudge(GOAL_NUDGE_ID);
  }, [goalStatus, goalStoppedReason, pushNudge, retractNudge]);

  useEffect(() => {
    if (hasPendingQuestion) {
      pushNudge({
        id: QUESTION_NUDGE_ID,
        message: "There is a question waiting on your answer.",
      });

      return;
    }

    retractNudge(QUESTION_NUDGE_ID);
  }, [hasPendingQuestion, pushNudge, retractNudge]);
}
