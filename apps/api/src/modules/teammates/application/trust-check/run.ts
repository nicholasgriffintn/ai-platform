import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  isPolyTeammateId,
  SYNCED_PLATFORM_TEAMMATES,
  TEAMMATE_TRUST_CHECK_CAPABILITY_ID,
  TEAMMATE_TRUST_CHECK_OUTPUT_KIND,
  type PlatformTeammate,
  type TeammateTrustCheckCase,
  type TeammateTrustCheckReport,
  type TeammateTrustCheckTask,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { createOutput } from "~/modules/outputs/application";
import type { IUser } from "~/types";

import { ensurePlatformTeammates } from "../platform-teammates";
import { enqueueTeammateRun } from "../run-admission";
import { collectAttemptedEffects, summariseTrustCheck } from "./evaluate";
import { buildTrustCheckMessage, TRUST_CHECK_FIXTURES, type TrustCheckFixture } from "./fixtures";

const logger = getLogger({ prefix: "teammates/trust-check" });
const TRANSCRIPT_LIMIT = 200;

export function selectTrustCheckTeammates(teammateIds?: readonly string[]): PlatformTeammate[] {
  return SYNCED_PLATFORM_TEAMMATES.filter(
    (teammate) =>
      !isPolyTeammateId(teammate.id) && (!teammateIds || teammateIds.includes(teammate.id)),
  );
}

async function checkTeammate(
  context: ServiceContext,
  user: IUser,
  teammate: PlatformTeammate,
  fixture: TrustCheckFixture,
): Promise<TeammateTrustCheckCase> {
  const conversationId = `trust_check_${generateId()}`;
  const base = { teammateId: teammate.id, teammateName: teammate.name, fixtureId: fixture.id };

  try {
    await enqueueTeammateRun({
      env: context.env,
      context,
      body: {
        conversationId,
        messages: [{ role: "user", content: buildTrustCheckMessage(fixture) }],
        stream: false,
        store: true,
      },
      teammateId: teammate.id,
      user,
      anonymousUser: undefined,
      conversationType: "task",
      authority: { trigger: "schedule", dryRun: true },
    });

    const messages = await context.repositories
      .get(MessageRepository)
      .getConversationMessages(conversationId, TRANSCRIPT_LIMIT);
    const attemptedEffects = collectAttemptedEffects(messages);

    return {
      ...base,
      passed: attemptedEffects.length === 0,
      attemptedEffects,
      conversationId,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      passed: false,
      attemptedEffects: [],
      conversationId: null,
      error: getErrorMessage(error, "The check could not run"),
    };
  }
}

export async function runTeammateTrustCheck(
  context: ServiceContext,
  user: IUser,
  task: TeammateTrustCheckTask,
): Promise<TeammateTrustCheckReport> {
  await ensurePlatformTeammates(context);

  const cases: TeammateTrustCheckCase[] = [];

  for (const teammate of selectTrustCheckTeammates(task.teammateIds)) {
    for (const fixture of TRUST_CHECK_FIXTURES) {
      cases.push(await checkTeammate(context, user, teammate, fixture));
    }
  }

  const checkedAt = new Date().toISOString();
  const report = summariseTrustCheck(cases, checkedAt);

  if (report.failed > 0) {
    logger.warn("Built-in teammates acted on smuggled instructions", {
      failed: report.failed,
      teammates: [
        ...new Set(
          cases.filter((item) => !item.passed && !item.error).map((item) => item.teammateId),
        ),
      ],
    });
  }

  await createOutput(context, user.id, {
    capabilityId: TEAMMATE_TRUST_CHECK_CAPABILITY_ID,
    kind: TEAMMATE_TRUST_CHECK_OUTPUT_KIND,
    title: `Teammate trust check ${checkedAt.slice(0, 10)}`,
    status: "ready",
    content: report,
  });

  return report;
}
