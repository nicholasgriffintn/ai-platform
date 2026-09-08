import {
  createHandoffRequestSchema,
  handoffDecisionResponseSchema,
  handoffSchema,
  isMachineOnline,
  type CreateHandoffRequest,
  type Handoff,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";

const NOT_FOUND = "Handoff not found or no longer available";

export async function createHandoff(
  context: ServiceContext,
  input: CreateHandoffRequest,
): Promise<Handoff> {
  const user = context.requireUser();
  const request = createHandoffRequestSchema.parse(input);
  const machine = (await context.repositories.machines.listForUser(user.id)).find(
    (candidate) => candidate.machineId === request.machineId,
  );

  if (!machine || !isMachineOnline(machine) || !machine.capabilities.includes("model-run")) {
    throw new Error("The selected machine is offline or cannot run models.");
  }

  return handoffSchema.parse(await context.repositories.handoffs.create(user.id, request));
}

export async function claimHandoff(
  context: ServiceContext,
  id: string,
  machineId: string,
): Promise<Handoff> {
  const user = context.requireUser();
  const machine = (await context.repositories.machines.listForUser(user.id)).find(
    (candidate) => candidate.machineId === machineId,
  );

  if (!machine || !isMachineOnline(machine)) {
    throw new Error(NOT_FOUND);
  }

  const handoff = await context.repositories.handoffs.claim(id, machineId);

  if (!handoff) {
    throw new Error(NOT_FOUND);
  }

  return handoffDecisionResponseSchema.parse({ handoff }).handoff;
}

export async function getHandoff(context: ServiceContext, id: string): Promise<Handoff> {
  const handoff = await context.repositories.handoffs.getForUser(id, context.requireUser().id);

  if (!handoff) {
    throw new Error(NOT_FOUND);
  }

  return handoff;
}

export async function decideHandoff(
  context: ServiceContext,
  id: string,
  machineId: string,
  state: "running" | "done" | "declined",
): Promise<Handoff> {
  const user = context.requireUser();
  const machine = (await context.repositories.machines.listForUser(user.id)).find(
    (candidate) => candidate.machineId === machineId,
  );

  if (!machine) {
    throw new Error(NOT_FOUND);
  }

  const existing = await context.repositories.handoffs.getForUser(id, user.id);

  if (!existing || existing.claimedBy !== machineId) {
    throw new Error(NOT_FOUND);
  }

  await context.repositories.handoffs.decide(id, machineId, state);

  return handoffSchema.parse({
    ...existing,
    state,
  });
}
