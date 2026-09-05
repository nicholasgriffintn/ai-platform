import {
  SANDBOX_RUN_PROOF_MAX_CHANGED_FILES,
  resolveSandboxDeliveryPolicy,
  type SandboxRunArtifactReference,
  type SandboxRunData,
  type SandboxRunEvent,
  type SandboxRunEnvironmentEvidence,
  type SandboxRunManifest,
  type SandboxRunProofEvidence,
  type SandboxRunServiceEvidence,
  type SandboxRunValidationCheck,
} from "@ngriffin_uk/polychat-schemas";

function lastEventValue(
  events: SandboxRunEvent[] | undefined,
  select: (event: SandboxRunEvent) => string | undefined,
): string | undefined {
  for (let index = (events?.length ?? 0) - 1; index >= 0; index -= 1) {
    const event = events?.[index];

    if (!event) {
      continue;
    }

    const value = select(event)?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.flatMap((value) => (value?.trim() ? [value.trim()] : []))));
}

function changedFilesFromDiff(diff: string | undefined): string[] {
  if (!diff) {
    return [];
  }

  return unique(
    diff.split("\n").flatMap((line) => {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);

      return match ? [match[2]] : [];
    }),
  );
}

function deriveChangedFiles(run: SandboxRunData, proof?: SandboxRunProofEvidence): string[] {
  if (proof?.changedFiles?.length) {
    return unique(proof.changedFiles);
  }

  const eventPaths = (run.events ?? []).flatMap((event) =>
    event.type === "file_changed" && !event.isDirectory ? [event.path] : [],
  );

  return unique([...changedFilesFromDiff(run.result?.diff), ...eventPaths]);
}

function deriveValidation(run: SandboxRunData, proof?: SandboxRunProofEvidence) {
  if (proof?.validation) {
    return proof.validation;
  }

  const checks: SandboxRunValidationCheck[] = (run.events ?? []).flatMap((event) => {
    if (
      (event.type !== "quality_gate_check_passed" && event.type !== "quality_gate_check_failed") ||
      !event.command?.trim()
    ) {
      return [];
    }

    return [
      {
        command: event.command.trim(),
        status: event.type === "quality_gate_check_passed" ? "passed" : "failed",
        exitCode: event.exitCode,
      },
    ];
  });
  const eventTypes = new Set((run.events ?? []).map((event) => event.type));

  if (eventTypes.has("quality_gate_skipped")) {
    return { qualityGate: "skipped" as const, checks };
  }

  if (checks.some((check) => check.status === "failed")) {
    return { qualityGate: "failed" as const, checks };
  }

  if (eventTypes.has("quality_gate_completed")) {
    return { qualityGate: "passed" as const, checks };
  }

  return { qualityGate: "unavailable" as const, checks };
}

function deriveEnvironment(
  run: SandboxRunData,
  proof?: SandboxRunProofEvidence,
): SandboxRunEnvironmentEvidence | undefined {
  if (proof?.environment) {
    return proof.environment;
  }

  const events = run.events ?? [];
  let resolved: SandboxRunEvent | undefined;
  let terminal: SandboxRunEvent | undefined;

  for (let index = events.length - 1; index >= 0 && (!resolved || !terminal); index -= 1) {
    const event = events[index];

    if (!event) {
      continue;
    }

    if (
      !resolved &&
      event.type === "environment_configuration_resolved" &&
      event.configurationSource &&
      event.configurationRevision
    ) {
      resolved = event;
    }

    if (
      !terminal &&
      (event.type === "environment_setup_completed" || event.type === "environment_setup_failed")
    ) {
      terminal = event;
    }
  }

  if (!resolved?.configurationSource || !resolved.configurationRevision) {
    return undefined;
  }

  return {
    source: resolved.configurationSource,
    configurationRevision: resolved.configurationRevision,
    configurationPath: resolved.configurationPath,
    preparationMode: terminal?.preparationMode ?? resolved.preparationMode ?? "setup",
    status: terminal?.type === "environment_setup_failed" ? "failed" : "completed",
    runtimes: resolved.runtimeRequirements ?? [],
    packageManager: resolved.packageManagerRequirement,
    durationSeconds: terminal?.durationSeconds ?? 0,
    commandCount: terminal?.commandCount ?? 0,
    cache:
      terminal?.cacheKey && terminal.cacheStatus
        ? {
            status: terminal.cacheStatus,
            cacheKey: terminal.cacheKey,
            createdAt: terminal.cacheCreatedAt,
            ageSeconds: terminal.cacheAgeSeconds,
            invalidationReason: terminal.cacheInvalidationReason,
          }
        : undefined,
  };
}

function deriveServices(
  run: SandboxRunData,
  proof?: SandboxRunProofEvidence,
): SandboxRunServiceEvidence[] {
  if (proof?.services) {
    return proof.services;
  }

  const services = new Map<
    string,
    {
      name: string;
      workingDirectory?: string;
      status?: SandboxRunServiceEvidence["status"];
      expectedPort?: number;
      healthCheck?: SandboxRunServiceEvidence["healthCheck"];
      restartCount: number;
      startedAt?: string;
      healthyAt?: string;
      stoppedAt?: string;
      error?: string;
    }
  >();

  for (const event of run.events ?? []) {
    if (!event.serviceName) {
      continue;
    }

    const existing = services.get(event.serviceName) ?? {
      name: event.serviceName,
      restartCount: 0,
    };
    const healthCheck =
      event.serviceHealthCheckType === "tcp"
        ? { type: "tcp" as const }
        : event.serviceHealthCheckType === "http" && event.serviceHealthPath
          ? {
              type: "http" as const,
              path: event.serviceHealthPath,
              expectedStatus: { min: 200, max: 399 },
            }
          : existing.healthCheck;

    services.set(event.serviceName, {
      ...existing,
      workingDirectory: event.serviceWorkingDirectory ?? existing.workingDirectory,
      status: event.serviceStatus ?? existing.status,
      expectedPort: event.servicePort ?? existing.expectedPort,
      healthCheck,
      restartCount: event.serviceRestartCount ?? existing.restartCount,
      startedAt:
        event.type === "service_starting"
          ? (event.timestamp ?? existing.startedAt)
          : existing.startedAt,
      healthyAt:
        event.type === "service_healthy"
          ? (event.timestamp ?? existing.healthyAt)
          : existing.healthyAt,
      stoppedAt:
        event.type === "service_stopped"
          ? (event.timestamp ?? existing.stoppedAt)
          : existing.stoppedAt,
      error: event.error ?? existing.error,
    });
  }

  return Array.from(services.values()).flatMap((service) =>
    service.workingDirectory && service.status
      ? [
          {
            name: service.name,
            workingDirectory: service.workingDirectory,
            status: service.status,
            expectedPort: service.expectedPort,
            healthCheck: service.healthCheck,
            restartCount: service.restartCount,
            startedAt: service.startedAt,
            healthyAt: service.healthyAt,
            stoppedAt: service.stoppedAt,
            error: service.error,
          },
        ]
      : [],
  );
}

function terminalOutcome(run: SandboxRunData): SandboxRunManifest["outcome"] {
  const summary = run.result?.summary?.trim() || undefined;

  if (run.status === "completed") {
    return { status: "completed", success: true, summary };
  }

  if (run.status === "failed") {
    return {
      status: "failed",
      success: false,
      summary,
      error:
        run.error?.trim() ||
        run.result?.error?.trim() ||
        "Sandbox run failed without an error message.",
    };
  }

  if (run.status === "cancelled") {
    return {
      status: "cancelled",
      success: false,
      summary,
      cancellationReason: run.cancellationReason?.trim() || undefined,
    };
  }

  throw new Error(`Cannot finalise a ${run.status} sandbox run`);
}

export function buildSandboxRunManifest(params: {
  run: SandboxRunData;
  artifacts?: SandboxRunArtifactReference[];
  infrastructure?: SandboxRunManifest["usage"]["infrastructure"];
}): SandboxRunManifest {
  const { run } = params;
  const proof = run.result?.proof;
  const derivedFiles = deriveChangedFiles(run, proof);
  const fileCount = Math.max(proof?.changedFileCount ?? 0, derivedFiles.length);
  const files = derivedFiles.slice(0, SANDBOX_RUN_PROOF_MAX_CHANGED_FILES);
  const branch =
    proof?.delivery?.branch?.trim() ||
    run.result?.branchName?.trim() ||
    lastEventValue(run.events, (event) => event.branchName);
  const commit =
    proof?.delivery?.commit?.trim() || lastEventValue(run.events, (event) => event.commitSha);
  const pullRequestUrl =
    proof?.delivery?.pullRequestUrl?.trim() ||
    run.result?.pullRequestUrl?.trim() ||
    lastEventValue(run.events, (event) => event.pullRequestUrl);
  const completedAt = run.completedAt?.trim() || run.updatedAt;

  return {
    version: 1,
    runId: run.runId,
    objective: run.task,
    outcome: terminalOutcome(run),
    timestamps: {
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      completedAt,
    },
    repository: {
      name: run.repo,
      baseRevision: proof?.repository?.baseRevision,
      headRevision: proof?.repository?.headRevision,
    },
    changes: {
      fileCount,
      files,
      filesTruncated: fileCount > files.length,
      summary: fileCount === 1 ? "1 file changed" : `${fileCount} files changed`,
    },
    validation: deriveValidation(run, proof),
    environment: deriveEnvironment(run, proof),
    services: deriveServices(run, proof),
    delivery: {
      policy:
        proof?.delivery?.policy ??
        resolveSandboxDeliveryPolicy(run.deliveryPolicy, run.shouldCommit),
      branch,
      commit,
      pullRequestUrl,
    },
    artifacts: params.artifacts ?? run.manifest?.artifacts ?? [],
    usage: {
      model: { id: run.model },
      infrastructure:
        params.infrastructure ?? run.infrastructureUsage ?? run.manifest?.usage.infrastructure,
    },
    residualRisks: unique(proof?.residualRisks ?? run.manifest?.residualRisks ?? []),
    incompleteWork: unique(proof?.incompleteWork ?? run.manifest?.incompleteWork ?? []),
  };
}
