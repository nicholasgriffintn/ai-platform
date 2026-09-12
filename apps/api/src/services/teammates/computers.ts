import type {
  TeammateComputer,
  TeammateComputerAction,
  TeammateComputerInput,
  TeammateContext,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getComputerProvider } from "~/lib/providers/capabilities/computer";
import type { TeammateComputerRecord } from "~/repositories/TeammateComputerRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generatePrefixedId } from "~/utils/id";

import { requireTeammateContext } from "./contexts";

const USER_CONTROL_LEASE_MS = 5 * 60 * 1000;
const AGENT_LEASE_MS = 60 * 1000;

async function requireRunningComputerRun(params: {
  context: ServiceContext;
  contextId: string;
  runId: string;
  runAttempt: number;
}): Promise<void> {
  const user = params.context.requireUser();
  const run = await params.context.repositories.conversationRuns.getById(params.runId);

  if (
    !run ||
    run.attempt !== params.runAttempt ||
    run.status !== "running" ||
    run.initiatorUserId !== user.id ||
    run.teammateContextId !== params.contextId
  ) {
    throw new AssistantError(
      "The originating run can no longer control this computer",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}

function toComputer(record: TeammateComputerRecord): TeammateComputer {
  const { providerHandle: _providerHandle, leaseFence: _leaseFence, ...computer } = record;

  return computer;
}

async function requireComputer(
  context: ServiceContext,
  contextId: string,
): Promise<TeammateComputerRecord> {
  await requireTeammateContext(context, contextId);

  return context.repositories.teammateComputers.ensure(contextId, "hosted");
}

async function provisionComputer(
  context: ServiceContext,
  computer: TeammateComputerRecord,
): Promise<TeammateComputerRecord> {
  if (computer.providerHandle && ["ready", "takeover"].includes(computer.status)) {
    return computer;
  }

  const claimed = await context.repositories.teammateComputers.claimProvisioning(computer.id);

  if (!claimed) {
    const current = await context.repositories.teammateComputers.getByContextId(computer.contextId);

    if (current?.providerHandle && ["ready", "takeover"].includes(current.status)) {
      return current;
    }

    throw new AssistantError(
      "The computer is already changing state",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  try {
    const resource = await getComputerProvider(context.env).provision({
      resourceId: claimed.id,
      checkpointReference: claimed.checkpointReference,
    });
    const updated = await context.repositories.teammateComputers.updateState({
      id: claimed.id,
      status: "ready",
      providerHandle: resource.handle,
      checkpointReference: resource.checkpointReference,
    });

    if (!updated) {
      throw new AssistantError(
        "Computer state changed while provisioning",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return updated;
  } catch (error) {
    await context.repositories.teammateComputers.updateState({
      id: claimed.id,
      status: "error",
      lastError: error instanceof Error ? error.message.slice(0, 500) : "Provisioning failed",
    });
    throw error;
  }
}

function requireProviderHandle(computer: TeammateComputerRecord): string {
  if (!computer.providerHandle) {
    throw new AssistantError("Computer has not been provisioned", ErrorType.CONFLICT_ERROR, 409);
  }

  return computer.providerHandle;
}

async function revokeSupersededScreen(
  context: ServiceContext,
  computer: TeammateComputerRecord,
): Promise<void> {
  const fence = computer.lease?.fence;

  if (!fence || fence <= 1) {
    return;
  }

  await getComputerProvider(context.env).revokeControl({
    resourceId: computer.id,
    handle: requireProviderHandle(computer),
    fence: fence - 1,
  });
}

async function revokeAndReleaseComputerLease(params: {
  context: ServiceContext;
  computer: TeammateComputerRecord & {
    lease: NonNullable<TeammateComputerRecord["lease"]>;
  };
  ownerId: string;
}): Promise<TeammateComputerRecord> {
  const handle = requireProviderHandle(params.computer);
  const fence = params.computer.lease.fence;

  await getComputerProvider(params.context.env).revokeControl({
    resourceId: params.computer.id,
    handle,
    fence,
  });
  const released = await params.context.repositories.teammateComputers.releaseLease({
    id: params.computer.id,
    ownerId: params.ownerId,
    fence,
  });

  if (!released) {
    throw new AssistantError("Computer control lease has changed", ErrorType.CONFLICT_ERROR, 409);
  }

  return released;
}

async function acquireComputerLease(params: {
  context: ServiceContext;
  computer: TeammateComputerRecord;
  kind: "agent" | "user";
  ownerId: string;
  durationMs: number;
  unavailableMessage: string;
}): Promise<
  TeammateComputerRecord & {
    lease: NonNullable<TeammateComputerRecord["lease"]>;
  }
> {
  const leased = await params.context.repositories.teammateComputers.acquireLease({
    id: params.computer.id,
    kind: params.kind,
    ownerId: params.ownerId,
    expiresAt: new Date(Date.now() + params.durationMs).toISOString(),
    now: new Date().toISOString(),
  });

  if (!leased?.lease || leased.lease.kind !== params.kind) {
    throw new AssistantError(params.unavailableMessage, ErrorType.CONFLICT_ERROR, 409);
  }

  await revokeSupersededScreen(params.context, leased);

  return { ...leased, lease: leased.lease };
}

export async function getTeammateComputer(
  context: ServiceContext,
  contextId: string,
): Promise<TeammateComputer> {
  return toComputer(await requireComputer(context, contextId));
}

export async function performTeammateComputerAction(
  context: ServiceContext,
  contextId: string,
  action: TeammateComputerAction,
): Promise<{
  computer: TeammateComputer;
  observation?: Record<string, unknown>;
}> {
  let computer = await requireComputer(context, contextId);

  if (action.action === "provision") {
    computer = await provisionComputer(context, computer);

    return { computer: toComputer(computer) };
  }

  if (action.action !== "destroy") {
    computer = await provisionComputer(context, computer);
  } else if (!computer.providerHandle) {
    const destroyed = await context.repositories.teammateComputers.updateState({
      id: computer.id,
      status: "destroyed",
      providerHandle: null,
    });

    return { computer: toComputer(destroyed ?? computer) };
  }

  const user = context.requireUser();
  const ownerId = `action:${user.id}`;
  const leased = await acquireComputerLease({
    context,
    computer,
    kind: "user",
    ownerId,
    durationMs: AGENT_LEASE_MS,
    unavailableMessage: "The computer is currently in use",
  });

  const provider = getComputerProvider(context.env);
  const handle = requireProviderHandle(leased);
  const fence = leased.lease.fence;
  let observation: Record<string, unknown> | undefined;

  try {
    switch (action.action) {
      case "observe":
        observation = await provider.observe({
          resourceId: leased.id,
          handle,
          fence,
        });
        break;
      case "checkpoint": {
        await context.repositories.teammateComputers.updateState({
          id: leased.id,
          status: "checkpointing",
          expectedFence: fence,
        });

        try {
          const checkpoint = await provider.checkpoint({
            resourceId: leased.id,
            handle,
            fence,
          });

          await context.repositories.teammateComputers.updateState({
            id: leased.id,
            status: "ready",
            checkpointReference: checkpoint.checkpointReference,
            lastError: null,
            expectedFence: fence,
          });
        } catch (error) {
          await context.repositories.teammateComputers.updateState({
            id: leased.id,
            status: "error",
            lastError: error instanceof Error ? error.message.slice(0, 500) : "Checkpoint failed",
            expectedFence: fence,
          });
          throw error;
        }

        break;
      }

      case "restore":
        if (!leased.checkpointReference) {
          throw new AssistantError(
            "This computer has no checkpoint",
            ErrorType.CONFLICT_ERROR,
            409,
          );
        }

        await provider.restore({
          resourceId: leased.id,
          handle,
          checkpointReference: leased.checkpointReference,
          fence,
        });
        break;
      case "stop":
        await provider.stop({ resourceId: leased.id, handle, fence });
        await context.repositories.teammateComputers.updateState({
          id: leased.id,
          status: "stopped",
          expectedFence: fence,
        });
        break;
      case "destroy":
        await provider.destroy({ resourceId: leased.id, handle, fence });
        await context.repositories.teammateComputers.updateState({
          id: leased.id,
          status: "destroyed",
          providerHandle: null,
          expectedFence: fence,
        });
        break;
    }
  } finally {
    await context.repositories.teammateComputers.releaseLease({
      id: leased.id,
      ownerId,
      fence,
    });
  }

  const updated = await context.repositories.teammateComputers.getByContextId(contextId);

  return {
    computer: toComputer(updated ?? leased),
    ...(observation ? { observation } : {}),
  };
}

export async function takeOverTeammateComputer(
  context: ServiceContext,
  contextId: string,
  recordTeaching: boolean,
) {
  const user = context.requireUser();
  const computer = await provisionComputer(context, await requireComputer(context, contextId));
  const ownerId = `user:${user.id}`;
  const leased = await acquireComputerLease({
    context,
    computer,
    kind: "user",
    ownerId,
    durationMs: USER_CONTROL_LEASE_MS,
    unavailableMessage: "The computer is currently in use",
  });

  try {
    const recordingId = recordTeaching ? generatePrefixedId("teaching_") : undefined;
    const screen = await getComputerProvider(context.env).connectScreen({
      resourceId: leased.id,
      handle: requireProviderHandle(leased),
      fence: leased.lease.fence,
      recordingId,
    });

    return {
      computer: toComputer(leased),
      screenUrl: screen.screenUrl,
      expiresAt: screen.expiresAt,
      ...(recordingId ? { recordingId } : {}),
    };
  } catch (error) {
    await revokeAndReleaseComputerLease({ context, computer: leased, ownerId });
    throw error;
  }
}

export async function getTeammateComputerTeachingRecording(
  context: ServiceContext,
  contextId: string,
  recordingId: string,
  fence: number,
) {
  const user = context.requireUser();
  const computer = await requireComputer(context, contextId);

  if (
    computer.status !== "takeover" ||
    computer.lease?.kind !== "user" ||
    computer.lease.ownerId !== `user:${user.id}` ||
    computer.lease.fence !== fence
  ) {
    throw new AssistantError(
      "The teaching session is no longer active",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return getComputerProvider(context.env).getTeachingRecording({
    resourceId: computer.id,
    handle: requireProviderHandle(computer),
    fence,
    recordingId,
  });
}

export async function releaseTeammateComputer(
  context: ServiceContext,
  contextId: string,
  fence: number,
): Promise<TeammateComputer> {
  const user = context.requireUser();
  const computer = await requireComputer(context, contextId);
  const ownerId = `user:${user.id}`;

  if (!computer.lease && computer.leaseFence === fence) {
    return toComputer(computer);
  }

  if (!computer.lease || computer.lease.ownerId !== ownerId || computer.lease.fence !== fence) {
    throw new AssistantError("Computer control lease has changed", ErrorType.CONFLICT_ERROR, 409);
  }

  const provider = getComputerProvider(context.env);

  await provider.observe({
    resourceId: computer.id,
    handle: requireProviderHandle(computer),
    fence,
  });
  const released = await revokeAndReleaseComputerLease({
    context,
    computer: { ...computer, lease: computer.lease },
    ownerId,
  });

  return toComputer(released);
}

export async function operateTeammateComputerAsAgent(params: {
  context: ServiceContext;
  contextId: string;
  runId: string;
  runAttempt: number;
  input?: TeammateComputerInput;
}): Promise<{
  computer: TeammateComputer;
  observation: Record<string, unknown>;
}> {
  await requireRunningComputerRun(params);
  const computer = await provisionComputer(
    params.context,
    await requireComputer(params.context, params.contextId),
  );
  const ownerId = `run:${params.runId}`;
  const leased = await acquireComputerLease({
    context: params.context,
    computer,
    kind: "agent",
    ownerId,
    durationMs: AGENT_LEASE_MS,
    unavailableMessage: "The computer is under user control",
  });

  const provider = getComputerProvider(params.context.env);
  const providerInput = {
    resourceId: leased.id,
    handle: requireProviderHandle(leased),
    fence: leased.lease.fence,
  };

  await requireRunningComputerRun(params);
  const observation = params.input
    ? await provider.input({ ...providerInput, input: params.input })
    : await provider.observe(providerInput);

  return { computer: toComputer(leased), observation };
}

export async function releaseTeammateComputerAgentLease(params: {
  context: ServiceContext;
  contextId: string;
  runId: string;
}): Promise<void> {
  const computer = await requireComputer(params.context, params.contextId);

  if (computer.lease?.kind !== "agent" || computer.lease.ownerId !== `run:${params.runId}`) {
    return;
  }

  await revokeAndReleaseComputerLease({
    context: params.context,
    computer: { ...computer, lease: computer.lease },
    ownerId: computer.lease.ownerId,
  });
}

export async function destroyTeammateContextComputerResources(
  context: ServiceContext,
  teammateContexts: readonly TeammateContext[],
): Promise<void> {
  for (const teammateContext of teammateContexts) {
    const computer = await context.repositories.teammateComputers.getByContextId(
      teammateContext.id,
    );

    if (!computer || computer.status === "destroyed") {
      continue;
    }

    if (!computer.providerHandle) {
      await context.repositories.teammateComputers.updateState({
        id: computer.id,
        status: "destroyed",
        providerHandle: null,
      });
      continue;
    }

    const ownerId = `teardown:${teammateContext.teammateId}`;
    const leased = await context.repositories.teammateComputers.forceAcquireLease({
      id: computer.id,
      ownerId,
      expiresAt: new Date(Date.now() + AGENT_LEASE_MS).toISOString(),
    });

    if (!leased?.lease) {
      throw new AssistantError(
        "The teammate computer could not be claimed for deletion",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    await revokeSupersededScreen(context, leased);
    await getComputerProvider(context.env).destroy({
      resourceId: leased.id,
      handle: requireProviderHandle(leased),
      fence: leased.lease.fence,
    });
    await context.repositories.teammateComputers.updateState({
      id: leased.id,
      status: "destroyed",
      providerHandle: null,
      expectedFence: leased.lease.fence,
    });
  }
}

export async function revokeTeammateContextResources(
  context: ServiceContext,
  teammateContexts: readonly TeammateContext[],
): Promise<void> {
  if (teammateContexts.length === 0) {
    return;
  }

  await context.repositories.composioConnectorSessions.markContextsCleanupPending(
    teammateContexts.map((teammateContext) => teammateContext.id),
    new Date().toISOString(),
  );
  await destroyTeammateContextComputerResources(context, teammateContexts);
}
