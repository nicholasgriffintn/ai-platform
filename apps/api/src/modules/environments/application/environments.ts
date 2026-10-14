import {
  listPageOf,
  type Environment,
  type EnvironmentAction,
  type EnvironmentKind,
  type ListPage,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { listMachines } from "~/modules/machines/application";

import type { EnvironmentKindDefinition, EnvironmentScope } from "../domain/environment-kind";
import { browserEnvironments } from "./kinds/browser";
import { machineEnvironments } from "./kinds/machine";
import { sandboxEnvironments } from "./kinds/sandbox";
import { teammateComputerEnvironments } from "./kinds/teammate-computer";

type EnvironmentKindRegistry = { [TKind in EnvironmentKind]: EnvironmentKindDefinition<TKind> };

type AnyEnvironmentKind = EnvironmentKindRegistry[EnvironmentKind];

const ENVIRONMENT_KIND_DEFINITIONS: EnvironmentKindRegistry = {
  sandbox: sandboxEnvironments,
  browser: browserEnvironments,
  teammate_computer: teammateComputerEnvironments,
  machine: machineEnvironments,
};

const RESOLUTION_ORDER: AnyEnvironmentKind[] = [
  sandboxEnvironments,
  browserEnvironments,
  teammateComputerEnvironments,
  machineEnvironments,
];

function isNotFound(error: unknown): boolean {
  return (
    error instanceof AssistantError &&
    (error.type === ErrorType.NOT_FOUND || error.statusCode === 404)
  );
}

async function resolve(
  scope: EnvironmentScope,
  id: string,
  kind?: EnvironmentKind,
): Promise<{ definition: AnyEnvironmentKind; environment: Environment }> {
  const candidates: AnyEnvironmentKind[] = kind
    ? [ENVIRONMENT_KIND_DEFINITIONS[kind]]
    : RESOLUTION_ORDER;

  for (const definition of candidates) {
    try {
      return { definition, environment: await definition.read(scope, id) };
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }

  throw new AssistantError("Environment not found", ErrorType.NOT_FOUND, 404);
}

export async function listEnvironments(
  scope: EnvironmentScope,
  kind?: EnvironmentKind,
): Promise<ListPage<Environment>> {
  if (kind && kind !== "machine") {
    return listPageOf([], (environment) => environment.id);
  }

  const machines = await listMachines(scope.context, scope.user.id);

  return listPageOf(
    machines.map((machine) => ({
      object: "environment" as const,
      id: machine.machineId,
      kind: "machine" as const,
      detail: machine,
    })),
    (environment) => environment.id,
  );
}

export async function readEnvironment(
  scope: EnvironmentScope,
  id: string,
  kind?: EnvironmentKind,
): Promise<Environment> {
  return (await resolve(scope, id, kind)).environment;
}

export async function removeEnvironment(
  scope: EnvironmentScope,
  id: string,
  kind?: EnvironmentKind,
): Promise<unknown> {
  const { definition } = await resolve(scope, id, kind);

  if (!definition.remove) {
    throw new AssistantError("This environment cannot be removed", ErrorType.CONFLICT_ERROR, 409);
  }

  return definition.remove(scope, id);
}

export async function actOnEnvironment(
  scope: EnvironmentScope,
  id: string,
  action: EnvironmentAction,
  kind?: EnvironmentKind,
): Promise<unknown> {
  const { definition } = await resolve(scope, id, kind);

  if (!definition.act || !definition.actions.has(action.action)) {
    throw new AssistantError(
      `A ${definition.kind} environment does not support ${action.action}`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return definition.act(scope, id, action);
}

export async function requireEnvironmentKind(
  scope: EnvironmentScope,
  id: string,
  kind: EnvironmentKind,
): Promise<void> {
  await resolve(scope, id, kind);
}
