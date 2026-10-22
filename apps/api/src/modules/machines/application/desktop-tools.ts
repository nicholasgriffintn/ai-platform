import {
  desktopToolResultSchema,
  isMachineOnline,
  machineRunRequestSchema,
  type DesktopToolInput,
  type DesktopToolResult,
  type MachineDirectory,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  MachineRepository,
  type StoredMachine,
} from "~/modules/machines/infrastructure/MachineRepository";

import { parseMachineSnapshot, pollMachineRun } from "./machine-run-polling";
import { callMachineRun } from "./runs";

const DESKTOP_TOOL_TIMEOUT_MS = 60_000;

export interface DesktopWorkspace {
  machineId: string;
  machineLabel: string;
  directory: MachineDirectory;
}

export type DesktopWorkspaceSelection =
  | { status: "selected"; workspace: DesktopWorkspace }
  | { status: "none"; reason: string }
  | { status: "ambiguous"; workspaces: DesktopWorkspace[] };

export function listDesktopWorkspaces(
  machines: readonly StoredMachine[],
  now = Date.now(),
): DesktopWorkspace[] {
  return machines
    .filter(
      (machine) => isMachineOnline(machine, now) && machine.capabilities.includes("local-tools"),
    )
    .flatMap((machine) =>
      machine.runtimes
        .flatMap((runtime) => (runtime.kind === "local-tools" ? runtime.directories : []))
        .map((directory) => ({
          machineId: machine.machineId,
          machineLabel: machine.label,
          directory,
        })),
    );
}

export function selectDesktopWorkspace(
  machines: readonly StoredMachine[],
  wanted: { machineId?: string; directory?: string },
  now = Date.now(),
): DesktopWorkspaceSelection {
  const workspaces = listDesktopWorkspaces(machines, now);

  if (workspaces.length === 0) {
    return {
      status: "none",
      reason:
        "No desktop is online with a granted folder. Open Polychat Desktop and grant a folder first.",
    };
  }

  const directoryWanted = wanted.directory?.trim().toLowerCase();
  const candidates = workspaces.filter(
    (workspace) =>
      (!wanted.machineId || workspace.machineId === wanted.machineId) &&
      (!directoryWanted ||
        workspace.directory.id === wanted.directory ||
        workspace.directory.label.toLowerCase() === directoryWanted),
  );

  if (candidates.length === 1) {
    return { status: "selected", workspace: candidates[0] };
  }

  if (candidates.length === 0) {
    return {
      status: "none",
      reason: "No granted folder matches that name on an online desktop.",
    };
  }

  return { status: "ambiguous", workspaces: candidates };
}

export async function listUserDesktopWorkspaces(
  context: ServiceContext,
): Promise<DesktopWorkspace[]> {
  const machines = await context.repositories
    .get(MachineRepository)
    .listForUser(context.requireUser().id);

  return listDesktopWorkspaces(machines);
}

export async function runDesktopTool(
  context: ServiceContext,
  params: { machineId?: string; directory?: string; input: DesktopToolInput },
): Promise<{ workspace: DesktopWorkspace; result: DesktopToolResult }> {
  const machines = await context.repositories
    .get(MachineRepository)
    .listForUser(context.requireUser().id);
  const selection = selectDesktopWorkspace(machines, params);

  if (selection.status === "none") {
    throw new AssistantError(selection.reason, ErrorType.NOT_FOUND, 404);
  }

  if (selection.status === "ambiguous") {
    throw new AssistantError(
      `Say which folder to use: ${selection.workspaces
        .map((workspace) => `${workspace.directory.label} on ${workspace.machineLabel}`)
        .join(", ")}`,
      ErrorType.PARAMS_ERROR,
      400,
      { workspaces: selection.workspaces },
    );
  }

  const { workspace } = selection;
  const request = machineRunRequestSchema.parse({
    id: generateId(),
    kind: "tool",
    conversationId: context.executionRunId ?? "desktop-tools",
    directoryId: workspace.directory.id,
    input: params.input,
  });
  const created = await parseMachineSnapshot(
    await callMachineRun(context, workspace.machineId, "/create", request),
  );
  const text = await pollMachineRun(
    context,
    workspace.machineId,
    request.id,
    created,
    Date.now() + DESKTOP_TOOL_TIMEOUT_MS,
    () => undefined,
  );
  const result = desktopToolResultSchema.safeParse(safeParseJson(text));

  if (!result.success) {
    throw new AssistantError(
      "The desktop returned a result Polychat could not read",
      ErrorType.PROVIDER_ERROR,
    );
  }

  return { workspace, result: result.data };
}
