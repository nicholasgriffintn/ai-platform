import {
  buildSkillHarvestTrace,
  describeSkillHarvestTrace,
  SKILL_HARVEST_MIN_TOOL_CALLS,
  wasThumbedDown,
} from "@ngriffin_uk/polychat-library-chat/skill-harvest";
import { buildSkillDocument } from "@ngriffin_uk/polychat-library-skills-catalogue";
import {
  SKILL_HARVEST_TASK_TYPE,
  skillIdSchema,
  type ChatRun,
} from "@ngriffin_uk/polychat-schemas";
import { slugify } from "@ngriffin_uk/polychat-utility-core";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";
import z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { recordSkillProposal } from "~/modules/poly/application/skill-proposals";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { AgentLoopExecutionResult } from "~/modules/responses/application/engine/agent/agent-loop";
import type { IUser } from "~/types";

import { getSkillDefinition } from "./catalog";
import { personalSkillScope, projectSkillScope } from "./management-policy";
import { createStoredSkill, getStoredSkill } from "./persistence";

const MAX_NAME_ATTEMPTS = 5;

const harvestedSkillSchema = z.object({
  reusable: z
    .boolean()
    .describe("Whether this run followed a procedure worth repeating for similar requests"),
  name: z.string().min(3).max(64).describe("Short kebab-case name for the procedure"),
  description: z
    .string()
    .min(10)
    .max(300)
    .describe("One line saying when to use the skill, written for someone choosing between skills"),
  instructions: z
    .string()
    .min(40)
    .max(4_000)
    .describe(
      "Numbered steps naming the tools to call and what to pass, generalised from this run; never include personal data, identifiers or credentials",
    ),
});

type HarvestedSkill = z.infer<typeof harvestedSkillSchema>;

export function harvestTaskId(run: Pick<ChatRun, "id">): string {
  return `skill_harvest_${run.id}`;
}

export function shouldConsiderHarvest(
  run: Pick<ChatRun, "trigger" | "status" | "initiatorUserId">,
  result: Pick<AgentLoopExecutionResult, "toolResponses"> | undefined,
): boolean {
  return (
    run.trigger === "user" &&
    run.status === "succeeded" &&
    (result?.toolResponses.filter((message) => message.status === "success").length ?? 0) >=
      SKILL_HARVEST_MIN_TOOL_CALLS
  );
}

export async function considerSkillHarvest(
  context: ServiceContext,
  run: ChatRun,
  result: AgentLoopExecutionResult | undefined,
): Promise<void> {
  if (!shouldConsiderHarvest(run, result)) {
    return;
  }

  await new TaskService(context.env, context.repositories.get(TaskRepository)).enqueueTask({
    id: harvestTaskId(run),
    task_type: SKILL_HARVEST_TASK_TYPE,
    user_id: run.initiatorUserId,
    ...(run.projectId ? { project_id: run.projectId } : {}),
    priority: 6,
    task_data: { runId: run.id, conversationId: run.conversationId },
  });
}

async function availableSkillName(
  context: ServiceContext,
  scope: ReturnType<typeof personalSkillScope>,
  proposed: string,
): Promise<string | null> {
  const base = slugify(proposed, 48) || "harvested-skill";

  for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    if (
      skillIdSchema.safeParse(candidate).success &&
      !(await getSkillDefinition(candidate)) &&
      !(await getStoredSkill(context, scope, candidate))
    ) {
      return candidate;
    }
  }

  return null;
}

export interface SkillHarvestInput {
  user: IUser;
  runId: string;
  conversationId: string;
  projectId: string | null;
}

export type SkillHarvestOutcome =
  | { status: "skipped"; reason: "too_short" | "thumbed_down" | "not_reusable" | "no_name" }
  | { status: "drafted"; skillName: string };

export async function harvestSkillFromRun(
  context: ServiceContext,
  input: SkillHarvestInput,
): Promise<SkillHarvestOutcome> {
  const messages = await context.repositories
    .get(MessageRepository)
    .getRunMessages(input.conversationId, input.runId);
  const trace = buildSkillHarvestTrace(messages);

  if (!trace) {
    return { status: "skipped", reason: "too_short" };
  }

  if (wasThumbedDown(messages)) {
    return { status: "skipped", reason: "thumbed_down" };
  }

  const harvested: HarvestedSkill = await ai.extract({
    env: context.env,
    user: input.user,
    completion_id: `skill-harvest:${input.runId}`,
    schema: harvestedSkillSchema,
    instructions:
      "You are turning one completed run into a reusable skill. Only mark it reusable when the same tool sequence would serve other requests of the same shape. Write instructions as the procedure, not as a record of this run.",
    input: redactSensitiveTokens(describeSkillHarvestTrace(trace)),
  });

  if (!harvested.reusable) {
    return { status: "skipped", reason: "not_reusable" };
  }

  const scope = input.projectId
    ? projectSkillScope(input.projectId)
    : personalSkillScope(input.user.id);
  const name = await availableSkillName(context, scope, harvested.name);

  if (!name) {
    return { status: "skipped", reason: "no_name" };
  }

  const description = redactSensitiveTokens(harvested.description.trim());

  await createStoredSkill(
    context,
    scope,
    name,
    {
      description,
      content: buildSkillDocument({
        name,
        description,
        instructions: redactSensitiveTokens(harvested.instructions),
      }),
      createdByUserId: input.user.id,
      changeNote: `Drafted by Poly from a run with ${trace.steps.length} tool calls; review before promotion`,
    },
    { personalEnabled: false },
  );

  await recordSkillProposal(context, {
    userId: input.user.id,
    kind: "skill_draft",
    skillName: name,
    groupKey: input.runId,
    title: `Poly drafted a skill: ${name}`,
    summary: description,
    reason: "skill_drafted_from_run",
    conversationId: input.conversationId,
  });

  return { status: "drafted", skillName: name };
}
