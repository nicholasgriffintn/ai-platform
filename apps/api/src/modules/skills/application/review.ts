import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  SKILL_OUTCOME_REVIEW_TASK_TYPE,
  type SkillOutcomeSummary,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { recordSkillProposal } from "~/modules/poly/application/skill-proposals";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { AuthoredSkillRepository } from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import type { IEnv } from "~/types";

import { personalSkillScope } from "./management-policy";
import { summariseSkillOutcomes } from "./outcomes";

const logger = getLogger({ prefix: "skills/review" });

function reviewPeriod(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function describeVerdict(summary: SkillOutcomeSummary): string | null {
  switch (summary.verdict) {
    case "unused":
      return `Not used in the last ${summary.windowDays} days. Retire it, or keep it if the season just has not come round.`;
    case "struggling":
      return `${summary.thumbsDown} replies were marked down against ${summary.thumbsUp} marked up. Revise the instructions or retire it.`;
    default:
      return null;
  }
}

export async function reviewUserSkills(context: ServiceContext, userId: number): Promise<number> {
  const skills = await context.repositories
    .get(AuthoredSkillRepository)
    .listByScope(personalSkillScope(userId));
  const period = reviewPeriod(new Date());
  let proposed = 0;

  for (const skill of skills) {
    const summary = await summariseSkillOutcomes(context, skill);
    const verdict = describeVerdict(summary);

    if (!verdict) {
      continue;
    }

    const recorded = await recordSkillProposal(context, {
      userId,
      kind: "skill_review",
      skillName: skill.name,
      groupKey: `${skill.id}:${period}`,
      title: `${summary.verdict === "unused" ? "Retire" : "Revise"} the ${skill.name} skill?`,
      summary: verdict,
      reason: `skill_${summary.verdict}`,
      conversationId: null,
    });

    if (recorded) {
      proposed += 1;
    }
  }

  return proposed;
}

export async function scheduleSkillOutcomeReview(env: IEnv): Promise<void> {
  const owners = await env.DB.prepare(
    `SELECT DISTINCT created_by_user_id AS id FROM resource
     WHERE resource_type = 'skill' AND scope_type = 'personal' AND archived_at IS NULL`,
  ).all<{ id: number }>();
  const taskService = new TaskService(env, new TaskRepository(env));
  const period = reviewPeriod(new Date());

  for (const owner of owners.results) {
    try {
      await taskService.enqueueTask({
        id: `skill_outcome_review_${owner.id}_${period}`,
        task_type: SKILL_OUTCOME_REVIEW_TASK_TYPE,
        user_id: owner.id,
        task_data: {},
        priority: 7,
      });
    } catch (error) {
      logger.error(`Failed to schedule skill review for user ${owner.id}`, error);
    }
  }
}
