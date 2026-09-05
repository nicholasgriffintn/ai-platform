import { Button, FormCheckbox, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type {
  SandboxServiceDefinition,
  SandboxServiceHealthCheck,
} from "@ngriffin_uk/polychat-schemas";
import { Network, Trash2 } from "lucide-react";

function newService(services: SandboxServiceDefinition[]): SandboxServiceDefinition {
  const existingNames = new Set(services.map((service) => service.name));
  let index = 1;

  while (existingNames.has(`service-${index}`)) {
    index += 1;
  }

  return {
    name: `service-${index}`,
    workingDirectory: ".",
    command: "pnpm dev",
    dependencies: [],
    startupTimeoutSeconds: 60,
    restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
  };
}

function healthCheckFor(
  type: string,
  existing?: SandboxServiceHealthCheck,
): SandboxServiceHealthCheck | undefined {
  if (type === "tcp") {
    return { type: "tcp" };
  }

  if (type === "http") {
    return existing?.type === "http"
      ? existing
      : { type: "http", path: "/", expectedStatus: { min: 200, max: 399 } };
  }

  return undefined;
}

export function ProjectServiceManifestFields({
  services,
  onChange,
}: {
  services: SandboxServiceDefinition[];
  onChange: (services: SandboxServiceDefinition[]) => void;
}) {
  const updateService = (index: number, next: SandboxServiceDefinition) => {
    onChange(services.map((service, serviceIndex) => (serviceIndex === index ? next : service)));
  };

  const renameService = (index: number, name: string) => {
    const previousName = services[index]?.name;

    onChange(
      services.map((service, serviceIndex) => ({
        ...(serviceIndex === index ? { ...service, name } : service),
        dependencies: service.dependencies.map((dependency) =>
          dependency === previousName ? name : dependency,
        ),
      })),
    );
  };

  const removeService = (index: number) => {
    const removedName = services[index]?.name;

    onChange(
      services
        .filter((_, serviceIndex) => serviceIndex !== index)
        .map((service) => ({
          ...service,
          dependencies: service.dependencies.filter((dependency) => dependency !== removedName),
        })),
    );
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Project services</legend>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Start declared applications, APIs and watchers with bounded health checks and restart
          limits.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={services.length >= 8}
          onClick={() => onChange([...services, newService(services)])}
        >
          Add service
        </Button>
      </div>

      {services.map((service, index) => (
        <section
          key={index}
          aria-label={`Service ${index + 1}`}
          className="space-y-3 rounded-lg border border-border bg-surface p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-creative" aria-hidden="true" />
              <p className="text-sm font-medium">{service.name || `Service ${index + 1}`}</p>
            </div>
            <Button
              type="button"
              variant="icon"
              size="icon"
              title={`Remove ${service.name || `service ${index + 1}`}`}
              aria-label={`Remove ${service.name || `service ${index + 1}`}`}
              onClick={() => removeService(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput
              label="Name"
              value={service.name}
              onChange={(event) => renameService(index, event.target.value)}
              placeholder="web"
              maxLength={50}
            />
            <FormInput
              label="Working directory"
              value={service.workingDirectory}
              onChange={(event) =>
                updateService(index, { ...service, workingDirectory: event.target.value })
              }
              placeholder="apps/web"
              maxLength={200}
            />
          </div>
          <FormInput
            label="Command"
            value={service.command}
            onChange={(event) => updateService(index, { ...service, command: event.target.value })}
            placeholder="pnpm dev"
            maxLength={500}
          />

          {services.length > 1 ? (
            <fieldset className="space-y-2 rounded-md bg-surface-elevated p-3">
              <legend className="text-xs font-medium text-muted-foreground">Dependencies</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.flatMap((candidate, candidateIndex) =>
                  candidateIndex === index
                    ? []
                    : [
                        <FormCheckbox
                          key={candidateIndex}
                          label={candidate.name || `Service ${candidateIndex + 1}`}
                          labelPosition="right"
                          checked={service.dependencies.includes(candidate.name)}
                          onChange={(event) =>
                            updateService(index, {
                              ...service,
                              dependencies: event.target.checked
                                ? [...service.dependencies, candidate.name]
                                : service.dependencies.filter(
                                    (dependency) => dependency !== candidate.name,
                                  ),
                            })
                          }
                        />,
                      ],
                )}
              </div>
            </fieldset>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormSelect
              label="Health check"
              value={service.healthCheck?.type ?? "none"}
              onChange={(event) => {
                const healthCheck = healthCheckFor(event.target.value, service.healthCheck);

                updateService(index, {
                  ...service,
                  healthCheck,
                  expectedPort: healthCheck ? (service.expectedPort ?? 4173) : undefined,
                });
              }}
              options={[
                { value: "none", label: "None — background watcher" },
                { value: "http", label: "HTTP" },
                { value: "tcp", label: "TCP" },
              ]}
            />
            <FormInput
              label="Expected port"
              type="number"
              min={1024}
              max={65535}
              disabled={!service.healthCheck}
              value={service.expectedPort ?? ""}
              onChange={(event) =>
                updateService(index, {
                  ...service,
                  expectedPort: event.target.value ? Number(event.target.value) : undefined,
                })
              }
            />
            {service.healthCheck?.type === "http" ? (
              <FormInput
                label="Health path"
                value={service.healthCheck.path}
                onChange={(event) => {
                  const healthCheck = service.healthCheck;

                  if (healthCheck?.type !== "http") {
                    return;
                  }

                  updateService(index, {
                    ...service,
                    healthCheck: { ...healthCheck, path: event.target.value },
                  });
                }}
                placeholder="/health"
                maxLength={200}
              />
            ) : null}
            <FormInput
              label="Startup timeout (seconds)"
              type="number"
              min={5}
              max={300}
              value={service.startupTimeoutSeconds}
              onChange={(event) =>
                updateService(index, {
                  ...service,
                  startupTimeoutSeconds: Number(event.target.value),
                })
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormSelect
              label="Restart policy"
              value={service.restartPolicy.mode}
              onChange={(event) => {
                const mode = event.target.value;

                updateService(index, {
                  ...service,
                  restartPolicy:
                    mode === "always" || mode === "on_failure"
                      ? { mode, maxRestarts: 1, backoffSeconds: 2 }
                      : { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
                });
              }}
              options={[
                { value: "never", label: "Never" },
                { value: "on_failure", label: "On failure" },
                { value: "always", label: "Always" },
              ]}
            />
            <FormInput
              label="Maximum restarts"
              type="number"
              min={1}
              max={3}
              disabled={service.restartPolicy.mode === "never"}
              value={service.restartPolicy.maxRestarts}
              onChange={(event) => {
                if (service.restartPolicy.mode === "never") {
                  return;
                }

                updateService(index, {
                  ...service,
                  restartPolicy: {
                    ...service.restartPolicy,
                    maxRestarts: Number(event.target.value),
                  },
                });
              }}
            />
            <FormInput
              label="Restart delay (seconds)"
              type="number"
              min={1}
              max={30}
              disabled={service.restartPolicy.mode === "never"}
              value={service.restartPolicy.backoffSeconds}
              onChange={(event) => {
                if (service.restartPolicy.mode === "never") {
                  return;
                }

                updateService(index, {
                  ...service,
                  restartPolicy: {
                    ...service.restartPolicy,
                    backoffSeconds: Number(event.target.value),
                  },
                });
              }}
            />
          </div>
        </section>
      ))}
    </fieldset>
  );
}
