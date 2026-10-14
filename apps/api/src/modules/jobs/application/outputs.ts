import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

import type { JobScope } from "../domain/job-kind";

export function readScopedOutput(scope: JobScope, outputId: string): Promise<OutputRecord | null> {
  const outputs = scope.context.repositories.outputs;

  return scope.projectId
    ? outputs.getProjectOutput(scope.projectId, outputId)
    : outputs.getPersonalOutput(scope.user.id, outputId);
}

export async function requireScopedOutput(
  scope: JobScope,
  outputId: string,
): Promise<OutputRecord> {
  const record = await readScopedOutput(scope, outputId);

  if (!record) {
    throw new AssistantError("Job not found", ErrorType.NOT_FOUND, 404);
  }

  return record;
}

export function listScopedOutputs(scope: JobScope, capabilityId: string): Promise<OutputRecord[]> {
  const outputs = scope.context.repositories.outputs;

  return scope.projectId
    ? outputs.listProjectOutputs(scope.projectId, capabilityId)
    : outputs.listPersonalOutputs(scope.user.id, capabilityId);
}

export function listScopedOutputGroup(
  scope: JobScope,
  capabilityId: string,
  groupId: string,
): Promise<OutputRecord[]> {
  const outputs = scope.context.repositories.outputs;

  return scope.projectId
    ? outputs.listProjectOutputGroup(scope.projectId, capabilityId, groupId)
    : outputs.listPersonalOutputGroup(scope.user.id, capabilityId, groupId);
}
