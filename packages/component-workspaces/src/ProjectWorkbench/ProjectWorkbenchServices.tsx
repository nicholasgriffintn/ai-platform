import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import type { SandboxServiceAction, SandboxServiceStatus } from "@ngriffin_uk/polychat-schemas";
import { CirclePlay, RefreshCw, Server, Square } from "lucide-react";

import { ProjectWorkbenchSection } from "./ProjectWorkbenchSection";

export interface ProjectWorkbenchServiceItem {
  name: string;
  status: SandboxServiceStatus;
  expectedPort?: number;
  restartCount: number;
  updatedAt?: string;
  error?: string;
  logs: Array<{
    stream: "stdout" | "stderr";
    output: string;
  }>;
}

export interface ProjectWorkbenchServicesProps {
  services: ProjectWorkbenchServiceItem[];
  canControl: boolean;
  disabledReason?: string;
  isUpdating?: boolean;
  errorMessage?: string;
  onAction: (serviceName: string, action: SandboxServiceAction) => Promise<void>;
}

const SERVICE_STATUS_LABELS: Record<SandboxServiceStatus, string> = {
  starting: "Starting",
  running: "Running",
  healthy: "Healthy",
  unhealthy: "Unhealthy",
  restarting: "Restarting",
  stopped: "Stopped",
  failed: "Failed",
  timed_out: "Timed out",
};

function serviceStatusClass(status: SandboxServiceStatus): string {
  if (status === "healthy" || status === "running") {
    return "border-success/40 text-success";
  }

  if (status === "starting" || status === "restarting") {
    return "border-active-work/40 text-active-work";
  }

  if (status === "unhealthy" || status === "timed_out") {
    return "border-attention/40 text-attention";
  }

  if (status === "failed") {
    return "border-failure/40 text-failure";
  }

  return "text-muted-foreground";
}

function serviceIsActive(status: SandboxServiceStatus): boolean {
  return (
    status === "starting" ||
    status === "running" ||
    status === "healthy" ||
    status === "unhealthy" ||
    status === "restarting"
  );
}

function runAction(action: () => Promise<void>): void {
  void action().catch(() => undefined);
}

export function ProjectWorkbenchServices({
  services,
  canControl,
  disabledReason,
  isUpdating = false,
  errorMessage,
  onAction,
}: ProjectWorkbenchServicesProps) {
  if (services.length === 0) {
    return null;
  }

  const disabled = !canControl || Boolean(disabledReason) || isUpdating;
  const actionTitle =
    disabledReason ??
    (!canControl ? "Only the person who started this run can control its services." : undefined);

  return (
    <ProjectWorkbenchSection
      title="Services"
      label="Project services"
      icon={Server}
      className="mb-4"
    >
      <ul className="space-y-2">
        {services.map((service) => {
          const active = serviceIsActive(service.status);

          return (
            <li
              key={service.name}
              className="rounded-lg border border-border bg-surface-elevated p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-medium">{service.name}</p>
                <Badge variant="outline" className={serviceStatusClass(service.status)}>
                  {SERVICE_STATUS_LABELS[service.status]}
                </Badge>
                {service.expectedPort ? (
                  <span className="text-xs text-muted-foreground">Port {service.expectedPort}</span>
                ) : null}
                {service.restartCount > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {service.restartCount} {service.restartCount === 1 ? "restart" : "restarts"}
                  </span>
                ) : null}
                <div className="ml-auto flex gap-1">
                  {active ? (
                    <>
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        title={actionTitle ?? `Restart ${service.name}`}
                        aria-label={`Restart ${service.name}`}
                        disabled={disabled}
                        onClick={() => runAction(() => onAction(service.name, "restart"))}
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        title={actionTitle ?? `Stop ${service.name}`}
                        aria-label={`Stop ${service.name}`}
                        disabled={disabled}
                        onClick={() => runAction(() => onAction(service.name, "stop"))}
                      >
                        <Square className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      title={actionTitle ?? `Start ${service.name}`}
                      aria-label={`Start ${service.name}`}
                      disabled={disabled}
                      onClick={() => runAction(() => onAction(service.name, "start"))}
                    >
                      <CirclePlay className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              {service.error ? <p className="mt-2 text-xs text-failure">{service.error}</p> : null}
              {service.logs.map((log, index) => {
                const label = `Show ${service.name} ${log.stream} log`;

                return (
                  <details key={`${log.stream}-${index}`} className="mt-2 max-w-full">
                    <summary className="text-muted-foreground cursor-pointer text-xs">
                      {label}
                    </summary>
                    <pre
                      role="log"
                      aria-label={`${service.name} ${log.stream} output`}
                      className="bg-canvas mt-2 max-h-48 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap break-all"
                    >
                      {log.output}
                    </pre>
                  </details>
                );
              })}
            </li>
          );
        })}
      </ul>
      {isUpdating ? <p className="text-xs text-active-work">Updating service…</p> : null}
      {errorMessage ? <p className="text-xs text-failure">{errorMessage}</p> : null}
    </ProjectWorkbenchSection>
  );
}
