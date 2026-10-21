import {
  extractChatCompletionText,
  extractTextFromMessageContent,
} from "@ngriffin_uk/polychat-ai-providers";
import {
  SKILL_REPLAY_MAX_CASES,
  SKILL_REPLAY_TASK_TYPE,
  skillReplayReportSchema,
  skillReplayVerdictSchema,
  type SkillReplayCase,
  type SkillReplayReport,
  type SkillReplayTask,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, truncateText } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";
import z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { startResponse } from "~/modules/responses/application/start";
import {
  AuthoredSkillRepository,
  type AuthoredSkillRecord,
  type AuthoredSkillScope,
} from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import { SkillUseRepository } from "~/modules/skills/infrastructure/SkillUseRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IUser } from "~/types";

import { getStoredSkillVersion } from "./persistence";

const REQUEST_PREVIEW_CHARS = 280;
const ANSWER_CHARS = 6_000;

const replayJudgementSchema = z.object({
  verdict: skillReplayVerdictSchema,
  reason: z.string().min(1).max(400),
});

interface ReplayExchange {
  runId: string;
  request: string;
  original: string;
}

export function summariseReplay(
  cases: readonly SkillReplayCase[],
): Pick<SkillReplayReport, "status"> {
  if (cases.length === 0) {
    return { status: "no_history" };
  }

  return {
    status: cases.some((replayCase) => replayCase.verdict === "worse") ? "regressed" : "passed",
  };
}

export function assertReplayAllowsPromotion(
  report: SkillReplayReport | null,
  acceptRegression: boolean,
): void {
  if (report?.status === "running") {
    throw new AssistantError(
      "This draft is still being replayed against recent requests. Promote it once the replay finishes.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (report?.status === "regressed" && !acceptRegression) {
    const worse = report.cases.filter((replayCase) => replayCase.verdict === "worse").length;

    throw new AssistantError(
      `Replaying this draft made ${worse} of ${report.cases.length} recent requests worse. Revise it, or promote it with acceptReplayRegression.`,
      ErrorType.CONFLICT_ERROR,
      409,
      { replay: report },
    );
  }
}

export async function readSkillReplay(
  context: ServiceContext,
  skillId: string,
  revisionId: string,
): Promise<SkillReplayReport | null> {
  const stored = await context.repositories
    .get(AuthoredSkillRepository)
    .getRevisionReplay(skillId, revisionId);
  const parsed = skillReplayReportSchema.safeParse(stored);

  return parsed.success ? parsed.data : null;
}

export async function assertDraftReplayAllowsPromotion(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  skillName: string,
  input: { revisionId: string; acceptReplayRegression?: boolean },
): Promise<void> {
  const record = await context.repositories
    .get(AuthoredSkillRepository)
    .getByScopeAndName(scope, skillName);

  if (!record) {
    return;
  }

  assertReplayAllowsPromotion(
    await readSkillReplay(context, record.id, input.revisionId),
    input.acceptReplayRegression === true,
  );
}

export async function requestSkillReplay(
  context: ServiceContext,
  userId: number,
  task: SkillReplayTask,
): Promise<SkillReplayReport> {
  const report: SkillReplayReport = {
    revisionId: task.revisionId,
    status: "running",
    cases: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };

  await context.repositories
    .get(AuthoredSkillRepository)
    .setRevisionReplay(task.skillId, task.revisionId, report);
  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    id: `skill_replay_${task.revisionId}_${generateId()}`,
    task_type: SKILL_REPLAY_TASK_TYPE,
    user_id: userId,
    task_data: task,
    priority: 6,
  });

  return report;
}

async function requireReplayableSkill(
  context: ServiceContext,
  user: IUser,
  skillId: string,
): Promise<AuthoredSkillRecord> {
  const skill = await context.repositories.get(AuthoredSkillRepository).getById(skillId);

  if (!skill) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  if (skill.scopeType === "personal" && skill.scopeId !== String(user.id)) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  if (skill.scopeType === "project") {
    await requireProjectAccess(context, skill.scopeId, ["owner", "admin"]);
  }

  return skill;
}

async function loadExchange(
  context: ServiceContext,
  run: { runId: string; conversationId: string },
): Promise<ReplayExchange | null> {
  const messages = await context.repositories
    .get(MessageRepository)
    .getRunMessages(run.conversationId, run.runId);
  const request = messages.find((message) => message.role === "user");
  const original = [...messages].reverse().find((message) => message.role === "assistant");
  const requestText = request ? extractTextFromMessageContent(request.content) : "";
  const originalText = original ? extractTextFromMessageContent(original.content) : "";

  return requestText && originalText
    ? { runId: run.runId, request: requestText, original: originalText }
    : null;
}

async function replayExchange(
  context: ServiceContext,
  user: IUser,
  skillDocument: string,
  exchange: ReplayExchange,
): Promise<SkillReplayCase> {
  const response = await startResponse({
    env: context.env,
    context,
    user,
    command: {
      conversationId: `skill_replay_${generateId()}`,
      conversationType: "task",
      messages: [
        {
          role: "system",
          content: `Follow this skill for the request below.\n\n${skillDocument}`,
        },
        { role: "user", content: exchange.request },
      ],
      stream: false,
      store: true,
      settings: { mode: "agent", tool_choice: "auto" },
    },
    authority: { trigger: "schedule", dryRun: true },
  });
  const replayed = extractChatCompletionText(response, {
    fallback: "The replay produced no answer.",
  });
  const judgement = await ai.extract({
    env: context.env,
    user,
    completion_id: `skill-replay:${exchange.runId}`,
    schema: replayJudgementSchema,
    instructions:
      "You compare two answers to the same request. The original came from the skill's current version, the replay from a draft revision run with every external effect simulated. Judge only whether the replay serves the request better, the same or worse. Simulated effects are not a fault.",
    input: redactSensitiveTokens(
      [
        `Request:\n${exchange.request}`,
        `Original answer:\n${truncateText(exchange.original, ANSWER_CHARS)}`,
        `Replayed answer:\n${truncateText(replayed, ANSWER_CHARS)}`,
      ].join("\n\n"),
    ),
  });

  return {
    runId: exchange.runId,
    request: truncateText(exchange.request, REQUEST_PREVIEW_CHARS),
    verdict: judgement.verdict,
    reason: judgement.reason,
  };
}

export async function runSkillReplay(
  context: ServiceContext,
  user: IUser,
  task: SkillReplayTask,
): Promise<SkillReplayReport> {
  const skills = context.repositories.get(AuthoredSkillRepository);
  const startedAt =
    (await readSkillReplay(context, task.skillId, task.revisionId))?.startedAt ??
    new Date().toISOString();
  const finish = async (
    report: Omit<SkillReplayReport, "revisionId" | "startedAt" | "finishedAt">,
  ) => {
    const finished: SkillReplayReport = {
      revisionId: task.revisionId,
      startedAt,
      finishedAt: new Date().toISOString(),
      ...report,
    };

    await skills.setRevisionReplay(task.skillId, task.revisionId, finished);

    return finished;
  };

  try {
    const skill = await requireReplayableSkill(context, user, task.skillId);
    const draft = await getStoredSkillVersion(
      context,
      { type: skill.scopeType, id: skill.scopeId },
      skill.name,
      task.revisionId,
    );

    if (!draft) {
      throw new AssistantError("That revision no longer exists", ErrorType.NOT_FOUND, 404);
    }

    const runs =
      task.runs ??
      (await context.repositories
        .get(SkillUseRepository)
        .listRecentRuns(task.skillId, SKILL_REPLAY_MAX_CASES)
        .then((rows) =>
          rows.map((row) => ({ runId: row.run_id, conversationId: row.conversation_id })),
        ));
    const exchanges = (await Promise.all(runs.map((run) => loadExchange(context, run)))).filter(
      (exchange) => exchange !== null,
    );
    const cases: SkillReplayCase[] = [];

    for (const exchange of exchanges) {
      cases.push(await replayExchange(context, user, draft.content, exchange));
    }

    return finish({ ...summariseReplay(cases), cases, error: null });
  } catch (error) {
    return finish({
      status: "failed",
      cases: [],
      error: getErrorMessage(error, "The replay could not finish"),
    });
  }
}
