import type {
  ProjectWorkbenchServiceItem,
  ProjectWorkbenchStatus,
} from "@ngriffin_uk/polychat-component-workspaces";
import type {
  ProjectTask,
  SandboxRunControl,
  SandboxRunControlState,
  SandboxRunData,
} from "@ngriffin_uk/polychat-schemas";

export interface ProjectWorkbenchPresentation {
  status: ProjectWorkbenchStatus;
  detail?: string;
}

export function deriveProjectWorkbenchServices(
  run?: SandboxRunData,
): ProjectWorkbenchServiceItem[] {
  const services = new Map<string, ProjectWorkbenchServiceItem>();

  for (const evidence of run?.manifest?.services ?? run?.result?.proof?.services ?? []) {
    services.set(evidence.name, {
      name: evidence.name,
      status: evidence.status,
      expectedPort: evidence.expectedPort,
      restartCount: evidence.restartCount,
      updatedAt: evidence.stoppedAt ?? evidence.healthyAt ?? evidence.startedAt,
      error: evidence.error,
    });
  }

  for (const event of run?.events ?? []) {
    if (!event.serviceName || !event.serviceStatus) {
      continue;
    }

    const existing = services.get(event.serviceName);

    services.set(event.serviceName, {
      name: event.serviceName,
      status: event.serviceStatus,
      expectedPort: event.servicePort ?? existing?.expectedPort,
      restartCount: event.serviceRestartCount ?? existing?.restartCount ?? 0,
      updatedAt: event.timestamp ?? existing?.updatedAt,
      error:
        event.error ??
        (event.serviceStatus === "healthy" || event.serviceStatus === "running"
          ? undefined
          : existing?.error),
    });
  }

  return Array.from(services.values());
}

function hasActiveEnvironmentPreparation(run: SandboxRunData): boolean {
  const events = run.events ?? [];

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const type = events[index]?.type;

    if (type === "environment_setup_completed" || type === "environment_setup_failed") {
      return false;
    }

    if (type === "environment_setup_started" || type === "environment_setup_command_started") {
      return true;
    }
  }

  return false;
}

export function deriveProjectWorkbenchControlState(
  run?: SandboxRunData,
): SandboxRunControlState | undefined {
  if (!run) {
    return undefined;
  }

  if (run.status === "queued" || run.status === "running" || run.status === "paused") {
    return run.status;
  }

  return "cancelled";
}

export function deriveProjectWorkbenchPresentation({
  run,
  task,
  control,
  hasPendingApproval = false,
  hasCodingEnvironment,
}: {
  run?: SandboxRunData;
  task?: ProjectTask;
  control?: SandboxRunControl;
  hasPendingApproval?: boolean;
  hasCodingEnvironment: boolean;
}): ProjectWorkbenchPresentation {
  const runDetail = run ? `${run.repo} · ${run.task}` : undefined;

  if (run?.status === "failed") {
    return { status: "failed", detail: run.error ?? run.result?.error ?? runDetail };
  }

  if (run?.status === "cancelled") {
    return { status: "cancelled", detail: run.cancellationReason ?? runDetail };
  }

  if (run && hasPendingApproval) {
    return { status: "waiting_approval", detail: runDetail };
  }

  if (task?.status === "blocked" && task.blockedReason === "awaiting_approval") {
    return { status: "waiting_approval", detail: task.blockedDetail ?? runDetail };
  }

  if (task?.status === "blocked" && task.blockedReason === "awaiting_input") {
    return { status: "waiting_input", detail: task.blockedDetail ?? runDetail };
  }

  if (task?.status === "review") {
    return { status: "review", detail: task.objective };
  }

  if (run?.status === "completed" || task?.status === "done") {
    return { status: "completed", detail: runDetail ?? task?.objective };
  }

  if (run && control?.state === "cancelled") {
    return { status: "cancelled", detail: control.cancellationReason ?? runDetail };
  }

  if (run && control?.state === "paused") {
    return { status: "paused", detail: control.pauseReason ?? runDetail };
  }

  if (run && control?.state === "running" && run.status === "paused") {
    return { status: "running", detail: runDetail };
  }

  if (run?.status === "paused") {
    return { status: "paused", detail: run.pauseReason ?? runDetail };
  }

  if (run?.status === "queued" && run.workflowPhase === "dispatching") {
    return { status: "preparing", detail: runDetail };
  }

  if (run?.status === "queued" || task?.status === "queued") {
    return { status: "queued", detail: runDetail ?? task?.objective };
  }

  if (run?.status === "running" && hasActiveEnvironmentPreparation(run)) {
    return { status: "preparing", detail: runDetail };
  }

  if (run?.status === "running" || task?.status === "running") {
    return { status: "running", detail: runDetail ?? task?.objective };
  }

  if (task?.status === "cancelled") {
    return { status: "cancelled", detail: task.objective };
  }

  return {
    status: "ready",
    detail: hasCodingEnvironment ? "Coding environment configured" : runDetail,
  };
}
