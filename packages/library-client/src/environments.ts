import {
  environmentSchema,
  type Environment,
  type EnvironmentAction,
  type EnvironmentKind,
  type EnvironmentOf,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource, withQuery } from "./resource.js";

export const environments = resource<Environment>("/environments");

function isEnvironmentOf<TKind extends EnvironmentKind>(
  kind: TKind,
  environment: Environment,
): environment is EnvironmentOf<TKind> {
  return environment.kind === kind;
}

export function environmentPath(environmentId: string, suffix = ""): string {
  return `/environments/${encodeURIComponent(environmentId)}${suffix}`;
}

export async function readEnvironmentOfKind<TKind extends EnvironmentKind>(
  kind: TKind,
  environmentId: string,
): Promise<EnvironmentOf<TKind>> {
  const environment = environmentSchema.parse(
    await requestJson<unknown>(withQuery(environmentPath(environmentId), { kind }), "GET"),
  );

  if (!isEnvironmentOf(kind, environment)) {
    throw new Error(`Environment ${environmentId} is not a ${kind} environment`);
  }

  return environment;
}

export function actOnEnvironment<TResult>(
  environmentId: string,
  action: EnvironmentAction,
  kind?: EnvironmentKind,
): Promise<TResult> {
  return requestJson<TResult>(
    withQuery(environmentPath(environmentId, "/actions"), { kind }),
    "POST",
    action,
  );
}

export function removeEnvironment<TResult>(
  environmentId: string,
  kind?: EnvironmentKind,
): Promise<TResult> {
  return requestJson<TResult>(withQuery(environmentPath(environmentId), { kind }), "DELETE");
}
