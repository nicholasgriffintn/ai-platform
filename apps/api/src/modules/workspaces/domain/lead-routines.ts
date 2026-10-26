import {
  DEFAULT_LEAD_ROUTINES,
  leadRoutinesSchema,
  type LeadRoutines,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

export function readLeadRoutines(value: string | null | undefined): LeadRoutines {
  const parsed = leadRoutinesSchema.safeParse(value ? safeParseJson(value) : null);

  return parsed.success ? parsed.data : DEFAULT_LEAD_ROUTINES;
}

export function keepRoutineRuns(current: LeadRoutines, next: LeadRoutines): LeadRoutines {
  return {
    dailyBrief: { ...next.dailyBrief, lastRunAt: current.dailyBrief.lastRunAt },
    initiativeReview: { ...next.initiativeReview, lastRunAt: current.initiativeReview.lastRunAt },
  };
}
