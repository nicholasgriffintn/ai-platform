import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { gateMemoryClassification } from "~/modules/memory/application/gate";
import type { MemoryScope } from "~/types";

import { enqueueMemoryReflection, requireMemoryReflectionConsent } from "./reflection";
import { selectMemoryReflectionSources } from "./reflection-sources";
import { requireRunMemoryDocument } from "./run-access";

export async function queueTeammateMemoryCorrection(input: {
  context: ServiceContext;
  scope: MemoryScope;
  conversationId: string;
  runId: string;
  classify: boolean;
}) {
  const { context, scope, conversationId, runId } = input;

  if (scope.type !== "bound" || !scope.teammateContext) {
    return null;
  }

  const user = context.requireUser();

  await requireRunMemoryDocument(
    context,
    scope,
    scope.teammateContext.memoryDocumentId,
    "read-write",
  );
  await requireMemoryReflectionConsent(context);

  const row = await context.repositories.messages.getMemoryReflectionInput({
    conversationId,
    runId,
    contextId: scope.teammateContext.id,
    userId: user.id,
  });

  if (!row) {
    return null;
  }

  const { sources } = selectMemoryReflectionSources([row]);
  const source = sources[0];

  if (!source) {
    return null;
  }

  if (input.classify) {
    const gate = await gateMemoryClassification({
      env: context.env,
      user,
      message: source.text,
      completionId: conversationId,
    });

    if (!gate.proceed) {
      return null;
    }
  }

  return enqueueMemoryReflection(context, {
    contextId: scope.teammateContext.id,
    conversationId,
    throughMessageId: source.id,
    reason: "correction",
  });
}
