import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type {
  SandboxDeliveryPolicy,
  SandboxRunData,
  SandboxRunEvent,
  SandboxRunManifest,
} from "@ngriffin_uk/polychat-schemas";
import { formatDate, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Activity, FileDiff, Files, MonitorPlay, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import type { ProjectWorkbenchPane } from "./ProjectWorkbenchShell";

export interface ProjectWorkbenchRunPanelProps {
  pane: ProjectWorkbenchPane;
  run?: SandboxRunData;
  isLoading?: boolean;
  errorMessage?: string;
}

function eventLabel(event: SandboxRunEvent): string {
  return event.message?.trim() || event.type.replaceAll("_", " ");
}

function deliveryPolicyLabel(policy?: SandboxDeliveryPolicy): string | undefined {
  if (!policy) {
    return undefined;
  }

  if (policy.mode === "leave_uncommitted") {
    return "Leave changes uncommitted";
  }

  if (policy.mode === "custom") {
    return "Custom instructions";
  }

  if (policy.mode === "commit_to_branch") {
    return `Commit to ${policy.targetBranch}`;
  }

  return policy.destination === "pull_request"
    ? "Prepare branch and pull request"
    : "Prepare review branch";
}

function PanelMessage({
  pane,
  title,
  message,
}: {
  pane: ProjectWorkbenchPane;
  title: string;
  message: string;
}) {
  const Icon = {
    activity: Activity,
    preview: MonitorPlay,
    changes: FileDiff,
    files: Files,
    proof: ShieldCheck,
  }[pane];

  return (
    <EmptyState
      icon={<Icon className="text-muted-foreground size-5" />}
      title={title}
      message={message}
      className="min-h-52 border-0 bg-transparent"
    />
  );
}

function ActivityPanel({ run }: { run: SandboxRunData }) {
  const events = (run.events ?? []).slice(-30);

  if (events.length === 0) {
    return (
      <PanelMessage
        pane="activity"
        title="No recorded activity yet"
        message="Run events will appear here as the coding environment reports them."
      />
    );
  }

  return (
    <ol aria-label="Run activity" className="space-y-1">
      {events.map((event) => (
        <li
          key={`${event.timestamp ?? "untimed"}-${event.type}-${event.instructionId ?? ""}-${event.commandIndex ?? ""}-${event.agentStep ?? ""}`}
          className="border-border flex gap-3 border-b py-3 last:border-0"
        >
          <span className="bg-active-work mt-1.5 size-1.5 shrink-0 rounded-full" />
          <div className="min-w-0">
            <p className="text-sm capitalize">{eventLabel(event)}</p>
            {event.timestamp ? (
              <p className="text-muted-foreground mt-0.5 text-xs">{formatDate(event.timestamp)}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChangesPanel({ run }: { run: SandboxRunData }) {
  const diff = run.result?.diff?.trim();

  if (!diff) {
    return (
      <PanelMessage
        pane="changes"
        title="No changes recorded"
        message="A reviewable change set will appear when the run returns a diff."
      />
    );
  }

  const changedFiles = new Set(
    (run.events ?? []).flatMap((event) => (event.path?.trim() ? [event.path] : [])),
  );

  return (
    <div className="space-y-4">
      <div className="bg-surface-elevated rounded-lg p-4">
        <p className="text-sm font-medium">Changes are ready to review</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {changedFiles.size > 0 ? `${changedFiles.size} changed files · ` : ""}
          {diff.split("\n").length.toLocaleString()} diff lines
        </p>
      </div>
      <p className="text-muted-foreground text-sm">
        Detailed file navigation and bounded diff rendering will extend this panel.
      </p>
    </div>
  );
}

function FilesPanel({ run }: { run: SandboxRunData }) {
  const paths = Array.from(
    new Set((run.events ?? []).flatMap((event) => (event.path?.trim() ? [event.path] : []))),
  );

  if (paths.length === 0) {
    return (
      <PanelMessage
        pane="files"
        title="No file evidence available"
        message="Files reported by this run will appear here. Project Sources remain separate."
      />
    );
  }

  return (
    <ul aria-label="Files reported by the run" className="space-y-1">
      {paths.map((path) => (
        <li key={path} className="bg-surface-elevated rounded-md px-3 py-2 font-mono text-xs">
          {path}
        </li>
      ))}
    </ul>
  );
}

function ProofPanel({ run }: { run: SandboxRunData }) {
  const manifest = run.manifest;

  if (!manifest) {
    return (
      <PanelMessage
        pane="proof"
        title="Proof is unavailable"
        message={
          run.status === "completed" || run.status === "failed" || run.status === "cancelled"
            ? "This run finished before structured Proof was recorded. Its outcome has not been inferred from incomplete evidence."
            : "Terminal outcome, validation and delivery evidence will appear here."
        }
      />
    );
  }

  const revision = manifest.repository.headRevision ?? manifest.repository.baseRevision;

  return (
    <section className="space-y-6" aria-label="Run proof">
      <ProofSection title="Outcome">
        <p className="text-sm font-medium capitalize">{manifest.outcome.status}</p>
        {manifest.outcome.summary ? (
          <p className="text-muted-foreground mt-1 text-sm leading-6">{manifest.outcome.summary}</p>
        ) : null}
        {manifest.outcome.status === "failed" ? (
          <p className="bg-failure/10 text-failure mt-2 rounded-lg p-3 text-sm">
            {manifest.outcome.error}
          </p>
        ) : null}
        {manifest.outcome.status === "cancelled" && manifest.outcome.cancellationReason ? (
          <p className="text-muted-foreground mt-1 text-sm">
            {manifest.outcome.cancellationReason}
          </p>
        ) : null}
      </ProofSection>

      <ProofSection title="Objective">
        <p className="text-sm leading-6">{manifest.objective}</p>
      </ProofSection>

      <ProofSection title="Repository">
        <p className="text-sm">{manifest.repository.name}</p>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {revision ?? "Revision not recorded"}
        </p>
      </ProofSection>

      <ProofSection title="Changes">
        <p className="text-sm">
          {manifest.changes.summary ??
            `${manifest.changes.fileCount} ${manifest.changes.fileCount === 1 ? "file" : "files"} changed`}
        </p>
        {manifest.changes.files.length > 0 ? (
          <ul className="mt-2 space-y-1" aria-label="Changed files">
            {manifest.changes.files.map((file) => (
              <li key={file} className="bg-surface-elevated rounded px-2 py-1 font-mono text-xs">
                {file}
              </li>
            ))}
          </ul>
        ) : null}
        {manifest.changes.filesTruncated ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Showing {manifest.changes.files.length} of {manifest.changes.fileCount} files
          </p>
        ) : null}
      </ProofSection>

      <ProofSection title="Validation">
        <p className="text-sm capitalize">Quality gate {manifest.validation.qualityGate}</p>
        {manifest.validation.checks.length > 0 ? (
          <ul className="mt-2 space-y-2" aria-label="Validation results">
            {manifest.validation.checks.map((check) => (
              <li key={check.command} className="bg-surface-elevated rounded-lg p-2">
                <p className="font-mono text-xs">{check.command}</p>
                <p
                  className={`mt-1 text-xs capitalize ${check.status === "failed" ? "text-failure" : "text-success"}`}
                >
                  {check.status}
                  {check.exitCode === undefined ? "" : ` · exit ${check.exitCode}`}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </ProofSection>

      {manifest.environment ? (
        <ProofSection title="Environment">
          <ProofValue
            label="Configuration"
            value={
              manifest.environment.source === "repository"
                ? (manifest.environment.configurationPath ?? "Repository configuration")
                : "Project configuration"
            }
          />
          <ProofValue
            label="Revision"
            value={manifest.environment.configurationRevision.slice(0, 12)}
          />
          <ProofValue label="Preparation" value={manifest.environment.preparationMode} />
          <ProofValue label="Status" value={manifest.environment.status} />
          <ProofValue
            label="Runtimes"
            value={
              manifest.environment.runtimes.length > 0
                ? manifest.environment.runtimes
                    .map((runtime) =>
                      runtime.version ? `${runtime.name} ${runtime.version}` : runtime.name,
                    )
                    .join(", ")
                : undefined
            }
          />
          <ProofValue
            label="Package manager"
            value={
              manifest.environment.packageManager
                ? [
                    manifest.environment.packageManager.name,
                    manifest.environment.packageManager.version,
                  ]
                    .filter(Boolean)
                    .join(" ")
                : undefined
            }
          />
          <ProofValue
            label="Duration"
            value={`${manifest.environment.durationSeconds.toFixed(1)}s`}
          />
          <ProofValue
            label="Cache"
            value={
              manifest.environment.cache
                ? manifest.environment.cache.status === "reused"
                  ? "Reused snapshot"
                  : manifest.environment.cache.status === "created"
                    ? "Created snapshot"
                    : manifest.environment.cache.status === "failed"
                      ? "Snapshot unavailable; used clean setup"
                      : "Cache miss; used clean setup"
                : undefined
            }
          />
          <ProofValue
            label="Snapshot age"
            value={
              manifest.environment.cache?.createdAt
                ? formatRelativeTime(manifest.environment.cache.createdAt)
                : undefined
            }
          />
          <ProofValue label="Cache key" value={manifest.environment.cache?.cacheKey.slice(0, 12)} />
          <ProofValue
            label="Cache fallback"
            value={manifest.environment.cache?.invalidationReason}
          />
        </ProofSection>
      ) : null}

      {manifest.services && manifest.services.length > 0 ? (
        <ProofSection title="Services">
          <ul className="space-y-2" aria-label="Declared service outcomes">
            {manifest.services.map((service) => (
              <li key={service.name} className="rounded-lg bg-surface-elevated p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-medium">{service.name}</p>
                  <span
                    className={
                      service.status === "healthy" || service.status === "running"
                        ? "text-xs text-success"
                        : service.status === "failed" || service.status === "timed_out"
                          ? "text-xs text-failure"
                          : "text-xs text-muted-foreground"
                    }
                  >
                    {service.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {service.workingDirectory}
                  {service.expectedPort ? ` · Port ${service.expectedPort}` : " · No network port"}
                  {service.restartCount > 0
                    ? ` · ${service.restartCount} ${service.restartCount === 1 ? "restart" : "restarts"}`
                    : ""}
                </p>
                {service.healthCheck ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {service.healthCheck.type === "http"
                      ? `HTTP health ${service.healthCheck.path}`
                      : "TCP health check"}
                  </p>
                ) : null}
                {service.error ? (
                  <p className="mt-2 text-xs text-failure">{service.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </ProofSection>
      ) : null}

      <ProofSection title="Delivery">
        <ProofValue label="Policy" value={deliveryPolicyLabel(manifest.delivery.policy)} />
        <ProofValue label="Branch" value={manifest.delivery.branch} />
        <ProofValue label="Commit" value={manifest.delivery.commit} />
        <ProofValue label="Pull request" value={manifest.delivery.pullRequestUrl} />
      </ProofSection>

      <ProofSection title="Artifacts">
        {manifest.artifacts.length > 0 ? (
          <ul className="space-y-1">
            {manifest.artifacts.map((artifact) => (
              <li key={artifact.outputId}>
                <a
                  className="text-active-work text-sm underline-offset-4 hover:underline"
                  href={artifact.url}
                >
                  {artifact.name}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No artifacts recorded</p>
        )}
      </ProofSection>

      <ProofSection title="Usage">
        <ProofValue label="Model" value={manifest.usage.model.id} />
        <ProofValue
          label="Infrastructure"
          value={
            manifest.usage.infrastructure
              ? `${manifest.usage.infrastructure.instanceType} · ${manifest.usage.infrastructure.durationSeconds}s`
              : undefined
          }
        />
      </ProofSection>

      <ProofList title="Residual risks" values={manifest.residualRisks} />
      <ProofList title="Incomplete work" values={manifest.incompleteWork} />

      <ProofSection title="Recorded">
        <p className="text-muted-foreground text-xs">
          Started {formatDate(manifest.timestamps.startedAt)} · Finished{" "}
          {formatDate(manifest.timestamps.completedAt)}
        </p>
      </ProofSection>
    </section>
  );
}

function ProofSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function ProofValue({ label, value }: { label: string; value?: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className={value ? "font-mono text-xs" : "text-muted-foreground"}>
        {value ?? "Not recorded"}
      </span>
    </p>
  );
}

function ProofList({
  title,
  values,
}: {
  title: string;
  values: SandboxRunManifest["residualRisks"];
}) {
  return (
    <ProofSection title={title}>
      {values.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">None recorded</p>
      )}
    </ProofSection>
  );
}

export function ProjectWorkbenchRunPanel({
  pane,
  run,
  isLoading = false,
  errorMessage,
}: ProjectWorkbenchRunPanelProps) {
  if (errorMessage) {
    return <PanelMessage pane={pane} title="Run unavailable" message={errorMessage} />;
  }

  if (isLoading) {
    return <PanelMessage pane={pane} title="Loading run" message="Restoring current run state…" />;
  }

  if (!run) {
    return (
      <PanelMessage
        pane={pane}
        title="Ready for coding work"
        message="Start in the conversation. Run evidence will stay attached here."
      />
    );
  }

  if (pane === "activity") {
    return <ActivityPanel run={run} />;
  }

  if (pane === "preview") {
    return (
      <PanelMessage
        pane="preview"
        title="Preview unavailable"
        message="A healthy declared service is required before a preview can be opened."
      />
    );
  }

  if (pane === "changes") {
    return <ChangesPanel run={run} />;
  }

  if (pane === "files") {
    return <FilesPanel run={run} />;
  }

  return <ProofPanel run={run} />;
}
