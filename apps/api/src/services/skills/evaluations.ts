import type {
  AuthoredSkillEvaluationCase,
  AuthoredSkillEvaluationCaseInput,
  AuthoredSkillEvaluationResult,
  AuthoredSkillEvaluationRunInput,
  AuthoredSkillHistoryResponse,
  AuthoredSkillVersionedDocument,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import type { TemplateRecord } from "~/repositories/TemplateRepository";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { extractTextFromMessageContent } from "~/utils/messages";

import {
  getPersonalSkillHistory,
  getPersonalSkillVersion,
  getProjectSkillHistory,
  getProjectSkillVersion,
} from "./lifecycle";
import { requireProjectSkillAdministration } from "./management-policy";

const EVALUATION_CASE_TYPE = "authored-skill-evaluation-case";
const EVALUATION_OUTPUT_KIND = "authored-skill-evaluation";

const evaluationCaseConfigurationSchema = z
  .object({
    type: z.literal(EVALUATION_CASE_TYPE),
    skillId: z.string().min(1),
    prompt: z.string().min(1),
    expectedContains: z.string().min(1).optional(),
  })
  .strict();

const evaluationResultContentSchema = z
  .object({
    skillId: z.string().min(1),
    revisionId: z.string().min(1),
    revision: z.number().int().positive(),
    caseId: z.string().min(1).nullable(),
    prompt: z.string().min(1),
    expectedContains: z.string().min(1).nullable(),
    response: z.string(),
    outcome: z.enum(["passed", "failed", "unscored"]),
    model: z.string().min(1),
  })
  .strict();

interface EvaluationScope {
  projectId?: string;
}

function parseCaseConfiguration(record: TemplateRecord) {
  return evaluationCaseConfigurationSchema.safeParse(safeParseJson(record.configuration));
}

function formatCase(record: TemplateRecord): AuthoredSkillEvaluationCase | null {
  const parsed = parseCaseConfiguration(record);

  if (!parsed.success) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    prompt: parsed.data.prompt,
    expectedContains: parsed.data.expectedContains,
    createdByUserId: record.created_by_user_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function formatResult(record: OutputRecord): AuthoredSkillEvaluationResult | null {
  const parsed = evaluationResultContentSchema.safeParse(safeParseJson(record.content));

  if (!parsed.success) {
    return null;
  }

  const { skillId: _skillId, ...result } = parsed.data;

  return {
    id: record.id,
    skill: record.capability_id,
    ...result,
    createdByUserId: record.created_by_user_id,
    createdAt: record.created_at,
  };
}

async function resolveSkill(
  context: ServiceContext,
  userId: number,
  skillName: string,
  scope: EvaluationScope,
): Promise<AuthoredSkillHistoryResponse> {
  return scope.projectId
    ? getProjectSkillHistory(context, scope.projectId, skillName)
    : getPersonalSkillHistory(context, userId, skillName);
}

async function resolveVersion(
  context: ServiceContext,
  userId: number,
  skillName: string,
  revisionId: string,
  scope: EvaluationScope,
): Promise<AuthoredSkillVersionedDocument> {
  return scope.projectId
    ? getProjectSkillVersion(context, scope.projectId, skillName, revisionId)
    : getPersonalSkillVersion(context, userId, skillName, revisionId);
}

async function listCaseRecords(
  context: ServiceContext,
  userId: number,
  skillName: string,
  skillId: string,
  scope: EvaluationScope,
): Promise<TemplateRecord[]> {
  const records = scope.projectId
    ? await context.repositories.templates.listProjectTemplates(scope.projectId, "capability")
    : await context.repositories.templates.listPersonalTemplates(userId, "capability");

  return records.filter((record) => {
    const parsed = parseCaseConfiguration(record);

    return record.capability_id === skillName && parsed.success && parsed.data.skillId === skillId;
  });
}

async function requireCaseRecord(
  context: ServiceContext,
  userId: number,
  skillName: string,
  caseId: string,
  scope: EvaluationScope,
): Promise<TemplateRecord> {
  const history = await resolveSkill(context, userId, skillName, scope);
  const record = await context.repositories.templates.getTemplateById(caseId);
  const parsed = record ? parseCaseConfiguration(record) : null;
  const belongsToScope = scope.projectId
    ? record?.project_id === scope.projectId
    : record?.project_id === null && record?.created_by_user_id === userId;

  if (
    !record ||
    !belongsToScope ||
    record.capability_id !== skillName ||
    !parsed?.success ||
    parsed.data.skillId !== history.skill.id
  ) {
    throw new AssistantError("Evaluation case not found", ErrorType.NOT_FOUND, 404);
  }

  return record;
}

async function recordProjectCaseAudit(
  context: ServiceContext,
  projectId: string | undefined,
  userId: number,
  action: string,
  skillName: string,
  caseId: string,
) {
  if (!projectId) {
    return;
  }

  const { project } = await requireProjectSkillAdministration(context, projectId, skillName);

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: userId,
    action,
    targetType: "skill_evaluation_case",
    targetId: caseId,
    metadata: { skill: skillName },
  });
}

export async function listSkillEvaluationCases(
  context: ServiceContext,
  userId: number,
  skillName: string,
  scope: EvaluationScope = {},
): Promise<{ cases: AuthoredSkillEvaluationCase[] }> {
  const history = await resolveSkill(context, userId, skillName, scope);
  const records = await listCaseRecords(context, userId, skillName, history.skill.id, scope);

  return { cases: records.map(formatCase).filter((item) => item !== null) };
}

export async function createSkillEvaluationCase(
  context: ServiceContext,
  userId: number,
  skillName: string,
  input: AuthoredSkillEvaluationCaseInput,
  scope: EvaluationScope = {},
): Promise<AuthoredSkillEvaluationCase> {
  const history = await resolveSkill(context, userId, skillName, scope);
  const created = await context.repositories.templates.createTemplate({
    createdByUserId: userId,
    projectId: scope.projectId,
    kind: "capability",
    capabilityId: skillName,
    name: input.name,
    configuration: {
      type: EVALUATION_CASE_TYPE,
      skillId: history.skill.id,
      prompt: input.prompt,
      expectedContains: input.expectedContains,
    },
  });

  await recordProjectCaseAudit(
    context,
    scope.projectId,
    userId,
    "skill.evaluation_case_created",
    skillName,
    created.id,
  );

  return {
    id: created.id,
    name: input.name,
    prompt: input.prompt,
    expectedContains: input.expectedContains,
    createdByUserId: created.created_by_user_id,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

export async function deleteSkillEvaluationCase(
  context: ServiceContext,
  userId: number,
  skillName: string,
  caseId: string,
  scope: EvaluationScope = {},
): Promise<void> {
  await requireCaseRecord(context, userId, skillName, caseId, scope);
  await context.repositories.templates.deleteTemplate(caseId);
  await recordProjectCaseAudit(
    context,
    scope.projectId,
    userId,
    "skill.evaluation_case_deleted",
    skillName,
    caseId,
  );
}

export async function listSkillEvaluationResults(
  context: ServiceContext,
  userId: number,
  skillName: string,
  scope: EvaluationScope = {},
): Promise<{ results: AuthoredSkillEvaluationResult[] }> {
  const history = await resolveSkill(context, userId, skillName, scope);
  const records = scope.projectId
    ? await context.repositories.outputs.listProjectOutputs(scope.projectId, skillName, {
        kind: EVALUATION_OUTPUT_KIND,
      })
    : await context.repositories.outputs.listPersonalOutputs(userId, skillName, {
        kind: EVALUATION_OUTPUT_KIND,
      });

  return {
    results: records
      .filter((record) => {
        const parsed = evaluationResultContentSchema.safeParse(safeParseJson(record.content));

        return parsed.success && parsed.data.skillId === history.skill.id;
      })
      .map(formatResult)
      .filter((item) => item !== null),
  };
}

export async function runSkillEvaluation(
  context: ServiceContext,
  user: IUser,
  skillName: string,
  input: AuthoredSkillEvaluationRunInput,
  scope: EvaluationScope = {},
): Promise<AuthoredSkillEvaluationResult> {
  const version = await resolveVersion(context, user.id, skillName, input.revisionId, scope);
  const evaluationCase = input.caseId
    ? await requireCaseRecord(context, user.id, skillName, input.caseId, scope)
    : null;
  const caseConfiguration = evaluationCase ? parseCaseConfiguration(evaluationCase) : null;
  const prompt = caseConfiguration?.success ? caseConfiguration.data.prompt : input.prompt;

  if (!prompt) {
    throw new AssistantError("Evaluation prompt is required", ErrorType.PARAMS_ERROR, 400);
  }

  const expectedContains = caseConfiguration?.success
    ? caseConfiguration.data.expectedContains
    : input.expectedContains;
  const response = await handleCreateChatCompletions({
    env: context.env,
    context,
    user,
    request: {
      ...(input.model ? { model: input.model } : { model_router_mode: "auto" as const }),
      messages: [{ role: "user", content: prompt }],
      system_prompt: version.content,
      mode: "chat",
      stream: false,
      store: false,
      disable_functions: true,
      enabled_tools: [],
      approved_tools: [],
    },
  });

  if (response instanceof Response) {
    throw new AssistantError(
      "Skill evaluation unexpectedly returned a streaming response",
      ErrorType.INTERNAL_ERROR,
    );
  }

  const responseContent = extractTextFromMessageContent(response.choices[0]?.message.content);
  const outcome: AuthoredSkillEvaluationResult["outcome"] = expectedContains
    ? responseContent.includes(expectedContains)
      ? "passed"
      : "failed"
    : "unscored";
  const outputId = generateId();
  const content = {
    skillId: version.id,
    revisionId: version.revision.id,
    revision: version.revision.revision,
    caseId: evaluationCase?.id ?? null,
    prompt,
    expectedContains: expectedContains ?? null,
    response: responseContent,
    outcome,
    model: response.model,
  };
  const project = scope.projectId
    ? (await requireProjectSkillAdministration(context, scope.projectId, skillName)).project
    : null;
  const created = await context.repositories.outputs.createOutput(
    {
      id: outputId,
      createdByUserId: user.id,
      projectId: scope.projectId,
      capabilityId: skillName,
      groupId: version.revision.id,
      kind: EVALUATION_OUTPUT_KIND,
      title: `Evaluation: ${skillName} r${version.revision.revision}`,
      content,
    },
    project
      ? {
          workspaceId: project.workspace_id,
          actorUserId: user.id,
          action: "output.created",
          outputId,
          metadata: {
            capabilityId: skillName,
            kind: EVALUATION_OUTPUT_KIND,
            revisionId: version.revision.id,
          },
        }
      : undefined,
  );

  const { skillId: _skillId, ...result } = content;

  return {
    id: created.id,
    skill: skillName,
    ...result,
    createdByUserId: created.created_by_user_id,
    createdAt: created.created_at,
  };
}
