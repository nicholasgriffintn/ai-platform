import {
  getModels,
  isSystemRoleModel,
  readSystemModelChoiceStatus,
  resolveSystemRoleModel,
} from "@ngriffin_uk/polychat-ai-models";
import {
  findModelByReference,
  getModelDisplayName,
  getSystemModelLineup,
  SYSTEM_MODEL_LINEUP,
  WORKSPACE_MANAGER_ROLES,
  type ModelConfig,
  type SystemModelChoice,
  type SystemModelChoices,
  type SystemModelChoicesResponse,
  type SystemModelChoiceView,
  type SystemModelOption,
  type SystemModelRole,
  type SystemModelRoleView,
  type UpdateSystemModelChoicesInput,
  type WorkInboxItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";
import {
  WorkspaceRepository,
  type WorkspaceRow,
} from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { listSystemRoleModels } from "./resolve";
import { readWorkspaceSystemModelChoices } from "./scope";

interface ChoiceTarget {
  workspace: WorkspaceRow | null;
  editable: boolean;
}

async function resolveChoiceTarget(
  context: ServiceContext,
  workspaceId: string | undefined,
): Promise<ChoiceTarget> {
  if (!workspaceId) {
    return { workspace: null, editable: true };
  }

  const { workspace, role } = await requireWorkspaceAccess(context, workspaceId);

  return { workspace, editable: WORKSPACE_MANAGER_ROLES.includes(role) };
}

function viewChoices(
  choices: readonly SystemModelChoice[],
  catalogue: ModelConfig,
  accessible: ModelConfig,
): SystemModelChoiceView[] {
  return choices.map((choice) => ({
    model: choice.model,
    provider: choice.provider,
    id: findModelByReference(catalogue, choice)?.id ?? null,
    status: readSystemModelChoiceStatus(choice, catalogue, accessible),
  }));
}

function toOption(id: string, config: ModelConfig[string]): SystemModelOption {
  return {
    id,
    name: getModelDisplayName(config),
    provider: config.provider,
    ...(config.avatarUrl ? { avatarUrl: config.avatarUrl } : {}),
  };
}

export async function getSystemModelChoices(
  context: ServiceContext,
  workspaceId?: string,
): Promise<SystemModelChoicesResponse> {
  const user = context.requireUser();
  const target = await resolveChoiceTarget(context, workspaceId);
  const { choices: userChoices } = await context.repositories
    .get(UserSettingsRepository)
    .getSystemModelChoices(user.id);
  const workspaceChoices = target.workspace
    ? readWorkspaceSystemModelChoices(target.workspace.system_models)
    : null;
  const stored = workspaceChoices ?? userChoices;
  const catalogue = getModels();
  const models: Record<string, SystemModelOption> = {};
  const roles = await Promise.all(
    SYSTEM_MODEL_LINEUP.map(async (definition): Promise<SystemModelRoleView> => {
      const accessible = await listSystemRoleModels(context.env, user, definition.id);
      const choices = viewChoices(stored[definition.id] ?? [], catalogue, accessible);
      const defaults = viewChoices(definition.defaults, catalogue, accessible);
      const active = resolveSystemRoleModel(
        accessible,
        definition.id,
        { workspace: workspaceChoices, user: userChoices },
        user,
      );

      for (const [id, config] of Object.entries(accessible)) {
        models[id] = toOption(id, config);
      }

      for (const entry of [...choices, ...defaults]) {
        const listed = entry.id ? catalogue[entry.id] : undefined;

        if (entry.id && listed && !models[entry.id]) {
          models[entry.id] = toOption(entry.id, listed);
        }
      }

      return {
        role: definition.id,
        choices,
        defaults,
        options: Object.keys(accessible).sort((left, right) =>
          models[left].name.localeCompare(models[right].name),
        ),
        active: active ? { id: active.id, source: active.source } : null,
      };
    }),
  );

  return {
    scope: target.workspace ? "workspace" : "user",
    editable: target.editable,
    models,
    roles,
  };
}

async function normaliseChoices(
  context: ServiceContext,
  role: SystemModelRole,
  choices: readonly SystemModelChoice[],
): Promise<SystemModelChoice[]> {
  const accessible = await listSystemRoleModels(context.env, context.requireUser(), role, {
    shouldUseCache: false,
  });
  const seen = new Set<string>();

  return choices.map((choice) => {
    const match = findModelByReference(accessible, choice);

    if (!match || !isSystemRoleModel(role, match.config)) {
      throw new AssistantError(
        `${choice.model} cannot be used for ${getSystemModelLineup(role).label.toLowerCase()} on this account`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    if (seen.has(match.id)) {
      throw new AssistantError(`${choice.model} is listed twice`, ErrorType.PARAMS_ERROR, 400);
    }

    seen.add(match.id);

    return { model: match.id, provider: match.config.provider };
  });
}

function withRoleChoices(
  stored: SystemModelChoices,
  role: SystemModelRole,
  choices: SystemModelChoice[],
): SystemModelChoices {
  const { [role]: _replaced, ...rest } = stored;

  return choices.length > 0 ? { ...rest, [role]: choices } : rest;
}

export async function updateSystemModelChoices(
  context: ServiceContext,
  input: UpdateSystemModelChoicesInput,
): Promise<SystemModelChoicesResponse> {
  const user = context.requireUser();
  const choices = await normaliseChoices(context, input.role, input.choices);

  if (input.workspace_id) {
    const { workspace } = await requireWorkspaceAccess(context, input.workspace_id, [
      "owner",
      "admin",
    ]);
    const next = withRoleChoices(
      readWorkspaceSystemModelChoices(workspace.system_models),
      input.role,
      choices,
    );

    await context.repositories
      .get(WorkspaceRepository)
      .updateWorkspace(workspace.id, { system_models: JSON.stringify(next) });
    await context.repositories.get(AuditRepository).createRecord({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "workspace.model_choices_updated",
      targetType: "workspace",
      targetId: workspace.id,
      metadata: { role: input.role, models: choices.map((choice) => choice.model) },
    });

    return getSystemModelChoices(context, workspace.id);
  }

  const repository = context.repositories.get(UserSettingsRepository);
  const { choices: stored } = await repository.getSystemModelChoices(user.id);

  await repository.replaceSystemModelChoices(user.id, withRoleChoices(stored, input.role, choices));

  return getSystemModelChoices(context);
}

async function describeOutdatedChoices(
  context: ServiceContext,
  stored: SystemModelChoices,
): Promise<string[]> {
  const user = context.requireUser();
  const catalogue = getModels();
  const roles = SYSTEM_MODEL_LINEUP.filter((definition) => stored[definition.id]?.length);
  const notes = await Promise.all(
    roles.map(async (definition) => {
      const accessible = await listSystemRoleModels(context.env, user, definition.id);

      return (stored[definition.id] ?? []).flatMap((choice) => {
        const status = readSystemModelChoiceStatus(choice, catalogue, accessible);
        const listed = findModelByReference(catalogue, choice);
        const name = listed ? getModelDisplayName(listed.config) : choice.model;

        if (status === "retired") {
          return [`${definition.label}: ${name} has been retired`];
        }

        return status === "unavailable"
          ? [`${definition.label}: ${name} is no longer available to you`]
          : [];
      });
    }),
  );

  return notes.flat();
}

function outdatedInboxItem(
  item: Pick<WorkInboxItem, "id" | "workspaceId" | "title" | "since" | "deepLink">,
  notes: string[],
): WorkInboxItem {
  return {
    ...item,
    kind: "models",
    projectId: null,
    taskId: null,
    teammateId: null,
    detail: notes.join(". "),
    dueAt: null,
    conversationId: null,
  };
}

export async function listOutdatedModelChoiceInboxItems(
  context: ServiceContext,
  managedWorkspaces: readonly Pick<
    WorkspaceRow,
    "id" | "name" | "system_models" | "updated_at" | "created_at"
  >[],
): Promise<WorkInboxItem[]> {
  const user = context.requireUser();
  const personal = await context.repositories
    .get(UserSettingsRepository)
    .getSystemModelChoices(user.id);
  const [personalNotes, workspaceNotes] = await Promise.all([
    describeOutdatedChoices(context, personal.choices),
    Promise.all(
      managedWorkspaces.map(async (workspace) => ({
        workspace,
        notes: await describeOutdatedChoices(
          context,
          readWorkspaceSystemModelChoices(workspace.system_models),
        ),
      })),
    ),
  ]);
  const items: WorkInboxItem[] = [];

  if (personalNotes.length > 0) {
    items.push(
      outdatedInboxItem(
        {
          id: `models:user:${user.id}:${personalNotes.length}`,
          workspaceId: null,
          title: "Some of your model choices need a replacement",
          since: personal.updatedAt ?? new Date().toISOString(),
          deepLink: "/profile?tab=models",
        },
        personalNotes,
      ),
    );
  }

  for (const { workspace, notes } of workspaceNotes) {
    if (notes.length > 0) {
      items.push(
        outdatedInboxItem(
          {
            id: `models:workspace:${workspace.id}:${notes.length}`,
            workspaceId: workspace.id,
            title: `Model choices for ${workspace.name} need a replacement`,
            since: workspace.updated_at ?? workspace.created_at,
            deepLink: `/work/${encodeURIComponent(workspace.id)}/models/choices`,
          },
          notes,
        ),
      );
    }
  }

  return items;
}
