import {
  readMessageReactions,
  reactionFeedbackValue,
} from "@ngriffin_uk/polychat-library-chat/reactions";
import {
  assessSkillOutcomes,
  SKILL_OUTCOME_WINDOW_DAYS,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import type { SkillOutcomeSummary } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { CorrectionRepository } from "~/modules/corrections/infrastructure/CorrectionRepository";
import type {
  AuthoredSkillRecord,
  AuthoredSkillScope,
} from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import { AuthoredSkillRepository } from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import { SkillUseRepository } from "~/modules/skills/infrastructure/SkillUseRepository";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_RUNS = 50;

function countThumbs(rows: readonly { data: string | null }[]): {
  thumbsUp: number;
  thumbsDown: number;
} {
  let thumbsUp = 0;
  let thumbsDown = 0;

  for (const row of rows) {
    for (const reaction of readMessageReactions(safeParseJson(row.data ?? ""))) {
      if (reaction.actor !== "person") {
        continue;
      }

      const value = reactionFeedbackValue(reaction.emoji);

      if (value === 1) {
        thumbsUp += 1;
      } else if (value === -1) {
        thumbsDown += 1;
      }
    }
  }

  return { thumbsUp, thumbsDown };
}

export async function summariseSkillOutcomes(
  context: ServiceContext,
  skill: AuthoredSkillRecord,
  now = Date.now(),
): Promise<SkillOutcomeSummary> {
  const uses = context.repositories.get(SkillUseRepository);
  const windowStart = new Date(now - SKILL_OUTCOME_WINDOW_DAYS * DAY_MS).toISOString();
  const [summary, runs] = await Promise.all([
    uses.summarise(skill.id, windowStart),
    uses.listRecentRuns(skill.id, RECENT_RUNS),
  ]);
  const [reacted, corrections] = await Promise.all([
    context.repositories
      .get(MessageRepository)
      .listReactedAssistantMessagesForRuns(runs.map((run) => run.run_id)),
    context.repositories
      .get(CorrectionRepository)
      .countActiveByConversationIds(skill.createdByUserId, [
        ...new Set(runs.map((run) => run.conversation_id)),
      ]),
  ]);
  const { thumbsUp, thumbsDown } = countThumbs(reacted);

  return {
    skillId: skill.name,
    usesTotal: summary.uses_total,
    usesInWindow: summary.uses_in_window,
    windowDays: SKILL_OUTCOME_WINDOW_DAYS,
    lastUsedAt: summary.last_used_at,
    thumbsUp,
    thumbsDown,
    corrections,
    verdict: assessSkillOutcomes({
      usesTotal: summary.uses_total,
      usesInWindow: summary.uses_in_window,
      thumbsUp,
      thumbsDown,
      corrections,
      createdAt: skill.createdAt,
      now,
    }),
  };
}

export async function getSkillOutcomes(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
): Promise<SkillOutcomeSummary | null> {
  const skill = await context.repositories
    .get(AuthoredSkillRepository)
    .getByScopeAndName(scope, name);

  return skill ? summariseSkillOutcomes(context, skill) : null;
}
