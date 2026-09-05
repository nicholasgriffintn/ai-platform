import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  SANDBOX_REPOSITORY_ENVIRONMENT_PATH,
  sandboxPackageManagerNameSchema,
  sandboxRuntimeNameSchema,
  type SandboxEnvironmentDefinition,
  type SandboxEnvironmentSetup,
} from "@ngriffin_uk/polychat-schemas";
import { capitaliseFirst } from "@ngriffin_uk/polychat-utility-core";

import { ProjectServiceManifestFields } from "./ProjectServiceManifestFields";

const EMPTY_DEFINITION: SandboxEnvironmentDefinition = {
  version: 1,
  setupCommands: [""],
  resumeCommands: [],
  runtimes: [],
  setupTimeoutSeconds: 600,
  services: [],
};

function EnvironmentCommandFields({
  label,
  commands,
  onChange,
}: {
  label: string;
  commands: string[];
  onChange: (commands: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {commands.map((command, index) => (
        <div key={index} className="flex items-end gap-2">
          <FormInput
            label={`Command ${index + 1}`}
            value={command}
            onChange={(event) =>
              onChange(
                commands.map((existing, commandIndex) =>
                  commandIndex === index ? event.target.value : existing,
                ),
              )
            }
            placeholder={label === "Full setup" ? "pnpm install" : "Optional resume command"}
            maxLength={500}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(commands.filter((_, commandIndex) => commandIndex !== index))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        disabled={commands.length >= (label === "Full setup" ? 20 : 10)}
        onClick={() => onChange([...commands, ""])}
      >
        Add command
      </Button>
    </fieldset>
  );
}

export function ProjectEnvironmentSetupFields({
  value,
  onChange,
}: {
  value?: SandboxEnvironmentSetup;
  onChange: (value: SandboxEnvironmentSetup | undefined) => void;
}) {
  const definition = value?.source === "polychat" ? value.definition : EMPTY_DEFINITION;
  const runtime = definition.runtimes[0];

  const updateDefinition = (next: Partial<SandboxEnvironmentDefinition>) => {
    onChange({
      source: "polychat",
      definition: { ...definition, ...next },
    });
  };

  const updateRuntime = (name: string) => {
    const parsedName = sandboxRuntimeNameSchema.safeParse(name);

    updateDefinition({
      runtimes: parsedName.success ? [{ name: parsedName.data, version: runtime?.version }] : [],
    });
  };

  const updatePackageManager = (name: string) => {
    const parsedName = sandboxPackageManagerNameSchema.safeParse(name);

    updateDefinition({
      packageManager: parsedName.success
        ? {
            name: parsedName.data,
            version: definition.packageManager?.version,
          }
        : undefined,
    });
  };

  return (
    <div className="space-y-4 rounded-lg bg-surface-elevated p-4">
      <FormSelect
        label="Environment setup"
        value={value?.source ?? "none"}
        onChange={(event) => {
          const source = event.target.value;

          onChange(
            source === "repository"
              ? { source: "repository" }
              : source === "polychat"
                ? { source: "polychat", definition: EMPTY_DEFINITION }
                : undefined,
          );
        }}
        options={[
          { value: "none", label: "No setup commands" },
          { value: "repository", label: "Use repository configuration" },
          { value: "polychat", label: "Configure in Polychat" },
        ]}
      />

      {value?.source === "repository" ? (
        <p className="text-sm text-muted-foreground">
          Reads the versioned configuration at <code>{SANDBOX_REPOSITORY_ENVIRONMENT_PATH}</code>.
          Repository commands remain subject to the run’s command policy and approvals.
        </p>
      ) : null}

      {value?.source === "polychat" ? (
        <div className="space-y-4">
          <EnvironmentCommandFields
            label="Full setup"
            commands={definition.setupCommands}
            onChange={(setupCommands) => updateDefinition({ setupCommands })}
          />
          <EnvironmentCommandFields
            label="Lightweight resume"
            commands={definition.resumeCommands}
            onChange={(resumeCommands) => updateDefinition({ resumeCommands })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormSelect
              label="Runtime"
              value={runtime?.name ?? ""}
              onChange={(event) => updateRuntime(event.target.value)}
              options={[
                { value: "", label: "No runtime requirement" },
                ...["node", "python", "go", "rust", "java", "ruby"].map((name) => ({
                  value: name,
                  label: capitaliseFirst(name),
                })),
              ]}
            />
            <FormInput
              label="Runtime version"
              value={runtime?.version ?? ""}
              onChange={(event) =>
                runtime
                  ? updateDefinition({
                      runtimes: [{ ...runtime, version: event.target.value.trim() || undefined }],
                    })
                  : undefined
              }
              disabled={!runtime}
              placeholder="For example 22"
              maxLength={50}
            />
            <FormSelect
              label="Package manager"
              value={definition.packageManager?.name ?? ""}
              onChange={(event) => updatePackageManager(event.target.value)}
              options={[
                { value: "", label: "No package-manager requirement" },
                ...[
                  "npm",
                  "pnpm",
                  "yarn",
                  "bun",
                  "pip",
                  "poetry",
                  "uv",
                  "cargo",
                  "bundler",
                  "maven",
                  "gradle",
                  "swiftpm",
                ].map((name) => ({ value: name, label: name })),
              ]}
            />
            <FormInput
              label="Package-manager version"
              value={definition.packageManager?.version ?? ""}
              onChange={(event) =>
                definition.packageManager
                  ? updateDefinition({
                      packageManager: {
                        ...definition.packageManager,
                        version: event.target.value.trim() || undefined,
                      },
                    })
                  : undefined
              }
              disabled={!definition.packageManager}
              placeholder="For example 10"
              maxLength={50}
            />
          </div>
          <FormInput
            label="Setup timeout (seconds)"
            type="number"
            min={30}
            max={1800}
            value={definition.setupTimeoutSeconds}
            onChange={(event) =>
              updateDefinition({ setupTimeoutSeconds: Number(event.target.value) })
            }
          />
          <ProjectServiceManifestFields
            services={definition.services ?? []}
            onChange={(services) => updateDefinition({ services })}
          />
          <p className="text-xs text-muted-foreground">
            Store secret values in approved runtime credentials, not in setup commands. Reference
            them by environment variable name when a command needs one.
          </p>
        </div>
      ) : null}
    </div>
  );
}
