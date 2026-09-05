import { ProcessReadyTimeoutError, type Process } from "@cloudflare/sandbox";
import {
  sandboxServiceManifestSchema,
  type SandboxRunServiceEvidence,
  type SandboxServiceAction,
  type SandboxServiceDefinition,
  type SandboxServiceStatus,
  type SandboxTrustLevel,
} from "@ngriffin_uk/polychat-schemas";

import type { TaskEvent } from "../types";
import { SandboxCancellationError } from "./cancellation";
import {
  assertSafeCommand,
  getCommandRiskLevel,
  quoteForShell,
  type SandboxProcessInstance,
} from "./commands";
import { resolveCommandApproval } from "./feature-implementation/command-approval";
import { redactSandboxOutput } from "./output-redaction";
import type { RunControlClient } from "./run-control-client";

const SERVICE_OBSERVATION_INTERVAL_MS = 1_000;
const SERVICE_PORT_RELEASE_TIMEOUT_MS = 5_000;
const MAX_SERVICE_LOG_CHARS = 32_000;
const MAX_SERVICE_LOG_EVENTS = 20;
const MAX_SERVICE_LOG_EVENT_CHARS = 2_000;
const MAX_OBSERVATION_FAILURES = 3;

interface ManagedService {
  definition: SandboxServiceDefinition;
  absoluteWorkingDirectory: string;
  status: SandboxServiceStatus;
  restartCount: number;
  desiredStopped: boolean;
  observationFailures: number;
  logCharacters: number;
  logEvents: number;
  logTruncationReported: boolean;
  process?: Process;
  startedAt?: string;
  healthyAt?: string;
  stoppedAt?: string;
  error?: string;
}

export interface ProjectServiceSupervisorOptions {
  sandbox: SandboxProcessInstance;
  repoTargetDir: string;
  services: unknown;
  trustLevel: SandboxTrustLevel;
  approvalClient?: RunControlClient;
  abortSignal?: AbortSignal;
  checkpoint: (abortMessage: string) => Promise<void>;
  emit: (event: TaskEvent) => Promise<void>;
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", finish);
      resolve();
    };

    const timeout = setTimeout(finish, milliseconds);

    signal?.addEventListener("abort", finish, { once: true });

    if (signal?.aborted) {
      finish();
    }
  });
}

function topologicalServices(services: SandboxServiceDefinition[]): SandboxServiceDefinition[] {
  const byName = new Map(services.map((service) => [service.name, service]));
  const visited = new Set<string>();
  const ordered: SandboxServiceDefinition[] = [];
  const visit = (service: SandboxServiceDefinition): void => {
    if (visited.has(service.name)) {
      return;
    }

    visited.add(service.name);

    for (const dependency of service.dependencies) {
      const dependencyService = byName.get(dependency);

      if (dependencyService) {
        visit(dependencyService);
      }
    }

    ordered.push(service);
  };

  for (const service of services) {
    visit(service);
  }

  return ordered;
}

function serviceIsActive(service: ManagedService): boolean {
  return (
    Boolean(service.process) ||
    service.status === "starting" ||
    service.status === "running" ||
    service.status === "healthy" ||
    service.status === "restarting" ||
    service.status === "unhealthy"
  );
}

function serviceErrorMessage(error: unknown): string {
  return redactSandboxOutput(error instanceof Error ? error.message : "Service operation failed");
}

export class ProjectServiceSupervisor {
  private readonly options: ProjectServiceSupervisorOptions;
  private readonly abortController = new AbortController();
  private readonly managed = new Map<string, ManagedService>();
  private readonly failureWaiters = new Set<(error: Error) => void>();
  private ordered: ManagedService[] = [];
  private lastInstructionIndex = 0;
  private monitorPromise?: Promise<void>;
  private logEmission = Promise.resolve();
  private logEmissionError?: unknown;
  private fatalError?: Error;
  private stopping = false;

  public constructor(options: ProjectServiceSupervisorOptions) {
    this.options = options;
  }

  public get signal(): AbortSignal {
    return this.abortController.signal;
  }

  public async start(): Promise<void> {
    const parsed = sandboxServiceManifestSchema.safeParse(this.options.services);

    if (!parsed.success) {
      throw new Error(`Project service manifest is invalid: ${parsed.error.message}`);
    }

    if (parsed.data.length === 0) {
      return;
    }

    const definitions = topologicalServices(parsed.data);

    for (const definition of definitions) {
      await this.options.checkpoint(`Sandbox run cancelled before starting ${definition.name}`);
      assertSafeCommand(definition.command, { trustLevel: "trusted" });
      const approval = await resolveCommandApproval({
        command: definition.command,
        riskLevel: getCommandRiskLevel(definition.command),
        trustLevel: this.options.trustLevel,
        agentStep: 0,
        emit: this.options.emit,
        approvalClient: this.options.approvalClient,
        abortSignal: this.options.abortSignal,
        guardExecution: this.options.checkpoint,
      });

      if (approval.rejected) {
        throw new Error(approval.rejectedMessage ?? `Service ${definition.name} was not approved`);
      }

      assertSafeCommand(definition.command, {
        trustLevel: this.options.trustLevel,
        allowNetwork: approval.allowNetwork,
        allowRisky: approval.allowRisky,
      });

      const absoluteWorkingDirectory = await this.resolveWorkingDirectory(definition);
      const managed: ManagedService = {
        definition,
        absoluteWorkingDirectory,
        status: "stopped",
        restartCount: 0,
        desiredStopped: false,
        observationFailures: 0,
        logCharacters: 0,
        logEvents: 0,
        logTruncationReported: false,
      };

      this.managed.set(definition.name, managed);
      this.ordered.push(managed);
    }

    await this.emit({
      type: "service_manifest_validated",
      message: `${this.ordered.length} declared ${this.ordered.length === 1 ? "service" : "services"} validated`,
    });

    for (const service of this.ordered) {
      await this.emit({
        type: "service_declared",
        serviceName: service.definition.name,
        serviceWorkingDirectory: service.definition.workingDirectory,
        serviceStatus: service.status,
        servicePort: service.definition.expectedPort,
        serviceRestartCount: service.restartCount,
        serviceHealthPath:
          service.definition.healthCheck?.type === "http"
            ? service.definition.healthCheck.path
            : undefined,
        serviceHealthCheckType: service.definition.healthCheck?.type,
      });
    }

    for (const service of this.ordered) {
      await this.startWithRetries(service);
    }

    this.monitorPromise = this.monitor();
  }

  public getEvidence(): SandboxRunServiceEvidence[] {
    return this.ordered.map((service) => ({
      name: service.definition.name,
      workingDirectory: service.definition.workingDirectory,
      status: service.status,
      expectedPort: service.definition.expectedPort,
      healthCheck: service.definition.healthCheck,
      restartCount: service.restartCount,
      startedAt: service.startedAt,
      healthyAt: service.healthyAt,
      stoppedAt: service.stoppedAt,
      error: service.error,
    }));
  }

  public throwIfFailed(): void {
    if (this.fatalError) {
      throw this.fatalError;
    }
  }

  public waitForFailure(): Promise<never> {
    if (this.fatalError) {
      return Promise.reject(this.fatalError);
    }

    return new Promise((_, reject) => {
      this.failureWaiters.add(reject);
    });
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    this.abortController.abort();

    if (this.monitorPromise) {
      await this.monitorPromise.catch(() => undefined);
    }

    for (const service of this.ordered.slice().reverse()) {
      await this.stopManagedService(service, "Run finished");
    }

    await this.flushLogEvents();
  }

  private async resolveWorkingDirectory(definition: SandboxServiceDefinition): Promise<string> {
    const requested =
      definition.workingDirectory === "."
        ? this.options.repoTargetDir
        : `${this.options.repoTargetDir}/${definition.workingDirectory}`;
    const result = await this.options.sandbox.exec(`realpath ${quoteForShell(requested)}`);
    const resolved = result.stdout.trim().split("\n").at(-1);

    if (!result.success || !resolved) {
      throw new Error(`Working directory for service ${definition.name} does not exist`);
    }

    if (
      resolved !== this.options.repoTargetDir &&
      !resolved.startsWith(`${this.options.repoTargetDir}/`)
    ) {
      throw new Error(`Working directory for service ${definition.name} leaves the repository`);
    }

    return resolved;
  }

  private async listeningPorts(): Promise<Set<number>> {
    const result = await this.options.sandbox.exec("ss -ltnH");

    if (!result.success) {
      throw new Error("Declared service ports could not be checked for collisions");
    }

    const ports = new Set<number>();

    for (const line of result.stdout.split("\n")) {
      const localAddress = line.trim().split(/\s+/)[3];
      const port = localAddress ? /:(\d+)$/.exec(localAddress)?.[1] : undefined;

      if (port) {
        ports.add(Number(port));
      }
    }

    return ports;
  }

  private async waitForPortRelease(port: number): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < SERVICE_PORT_RELEASE_TIMEOUT_MS) {
      const ports = await this.listeningPorts();

      if (!ports.has(port)) {
        return;
      }

      await delay(250, this.abortController.signal);

      if (this.stopping) {
        return;
      }
    }

    throw new Error(`Declared port ${port} is already in use`);
  }

  private queueLogEvent(service: ManagedService, stream: "stdout" | "stderr", data: string): void {
    if (!data || service.logTruncationReported) {
      return;
    }

    const safeOutput = redactSandboxOutput(data);
    const remaining = MAX_SERVICE_LOG_CHARS - service.logCharacters;

    if (remaining <= 0 || service.logEvents >= MAX_SERVICE_LOG_EVENTS) {
      service.logTruncationReported = true;
      this.queueEmission({
        type: "service_log_truncated",
        serviceName: service.definition.name,
        serviceStatus: service.status,
        message: "Additional service output was omitted",
      });

      return;
    }

    const output = safeOutput.slice(0, Math.min(remaining, MAX_SERVICE_LOG_EVENT_CHARS));

    if (!output) {
      return;
    }

    service.logCharacters += output.length;
    service.logEvents += 1;
    this.queueEmission({
      type: "service_log",
      serviceName: service.definition.name,
      serviceStatus: service.status,
      stream,
      output,
      truncated: output.length < safeOutput.length,
    });

    if (
      output.length < safeOutput.length ||
      service.logCharacters >= MAX_SERVICE_LOG_CHARS ||
      service.logEvents >= MAX_SERVICE_LOG_EVENTS
    ) {
      service.logTruncationReported = true;
      this.queueEmission({
        type: "service_log_truncated",
        serviceName: service.definition.name,
        serviceStatus: service.status,
        message: "Additional service output was omitted",
      });
    }
  }

  private queueEmission(event: TaskEvent): void {
    this.logEmission = this.logEmission
      .then(() => this.options.emit(event))
      .catch((error) => {
        this.logEmissionError = error;
      });
  }

  private async flushLogEvents(): Promise<void> {
    await this.logEmission;

    if (this.logEmissionError) {
      const error = this.logEmissionError;

      this.logEmissionError = undefined;
      throw error;
    }
  }

  private async emit(event: TaskEvent): Promise<void> {
    await this.flushLogEvents();
    await this.options.emit(event);
  }

  private async startManagedService(service: ManagedService): Promise<void> {
    const definition = service.definition;

    await this.options.checkpoint(`Sandbox run cancelled before starting ${definition.name}`);

    if (definition.expectedPort !== undefined) {
      await this.waitForPortRelease(definition.expectedPort);
    }

    service.desiredStopped = false;
    service.status = "starting";
    service.error = undefined;
    service.stoppedAt = undefined;
    service.startedAt = new Date().toISOString();

    await this.emit({
      type: "service_starting",
      serviceName: definition.name,
      serviceWorkingDirectory: definition.workingDirectory,
      serviceStatus: service.status,
      servicePort: definition.expectedPort,
      serviceRestartCount: service.restartCount,
      serviceHealthPath:
        definition.healthCheck?.type === "http" ? definition.healthCheck.path : undefined,
      serviceHealthCheckType: definition.healthCheck?.type,
      timeoutSeconds: definition.startupTimeoutSeconds,
    });

    let process: Process | undefined;

    try {
      process = await this.options.sandbox.startProcess(definition.command, {
        cwd: service.absoluteWorkingDirectory,
        autoCleanup: false,
        processId: `polychat-${definition.name}-${crypto.randomUUID().slice(0, 8)}`,
        onOutput: (stream, data) => this.queueLogEvent(service, stream, data),
      });
      service.process = process;
      const processStatus = await process.getStatus();

      if (
        processStatus === "completed" ||
        processStatus === "failed" ||
        processStatus === "killed" ||
        processStatus === "error"
      ) {
        throw new Error(`Service exited before becoming ready with status ${processStatus}`);
      }

      if (definition.expectedPort !== undefined && definition.healthCheck) {
        await this.waitForServiceHealth(
          process,
          definition,
          definition.startupTimeoutSeconds * 1000,
          true,
        );
        service.status = "healthy";
        service.healthyAt = new Date().toISOString();

        await this.emit({
          type: "service_healthy",
          serviceName: definition.name,
          serviceStatus: service.status,
          servicePort: definition.expectedPort,
          serviceRestartCount: service.restartCount,
          serviceHealthPath:
            definition.healthCheck.type === "http" ? definition.healthCheck.path : undefined,
        });
      } else {
        service.status = "running";

        await this.emit({
          type: "service_running",
          serviceName: definition.name,
          serviceStatus: service.status,
          serviceRestartCount: service.restartCount,
        });
      }
    } catch (error) {
      await process?.kill().catch(() => undefined);
      service.process = undefined;

      if (error instanceof SandboxCancellationError) {
        service.status = "stopped";
        service.stoppedAt = new Date().toISOString();

        await this.emit({
          type: "service_stopped",
          serviceName: definition.name,
          serviceStatus: service.status,
          servicePort: definition.expectedPort,
          serviceRestartCount: service.restartCount,
          message: error.message,
        });
        throw error;
      }

      const timedOut = error instanceof ProcessReadyTimeoutError;
      const message = serviceErrorMessage(error);

      service.status = timedOut ? "timed_out" : "failed";
      service.error = message;

      await this.emit({
        type: timedOut ? "service_start_timed_out" : "service_failed",
        serviceName: definition.name,
        serviceStatus: service.status,
        servicePort: definition.expectedPort,
        serviceRestartCount: service.restartCount,
        serviceHealthPath:
          definition.healthCheck?.type === "http" ? definition.healthCheck.path : undefined,
        error: message,
      });

      throw new Error(`Service ${definition.name} failed to start: ${message}`, { cause: error });
    }
  }

  private async startWithRetries(service: ManagedService): Promise<void> {
    try {
      await this.startManagedService(service);

      return;
    } catch (error) {
      if (error instanceof SandboxCancellationError) {
        throw error;
      }

      await this.restartWithBudget(service, error);
    }
  }

  private async restartWithBudget(service: ManagedService, initialError: unknown): Promise<void> {
    let lastError = initialError;

    while (
      !this.stopping &&
      service.definition.restartPolicy.mode !== "never" &&
      service.restartCount < service.definition.restartPolicy.maxRestarts
    ) {
      service.restartCount += 1;
      service.status = "restarting";

      await this.emit({
        type: "service_restarting",
        serviceName: service.definition.name,
        serviceStatus: service.status,
        servicePort: service.definition.expectedPort,
        serviceRestartCount: service.restartCount,
        message: `Restarting after ${service.definition.restartPolicy.backoffSeconds} seconds`,
      });
      await delay(
        service.definition.restartPolicy.backoffSeconds * 1000,
        this.abortController.signal,
      );

      if (this.stopping || service.desiredStopped) {
        return;
      }

      try {
        await this.startManagedService(service);

        return;
      } catch (error) {
        if (error instanceof SandboxCancellationError) {
          throw error;
        }

        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Service ${service.definition.name} could not be started`);
  }

  private async stopManagedService(service: ManagedService, reason: string): Promise<void> {
    service.desiredStopped = true;
    const process = service.process;

    if (
      !process &&
      (service.status === "stopped" ||
        service.status === "failed" ||
        service.status === "timed_out")
    ) {
      return;
    }

    await process?.kill().catch(() => undefined);

    if (service.definition.expectedPort !== undefined) {
      await this.options.sandbox
        .unexposePort(service.definition.expectedPort)
        .catch(() => undefined);
    }

    service.process = undefined;
    service.status = "stopped";
    service.error = undefined;
    service.stoppedAt = new Date().toISOString();

    await this.emit({
      type: "service_stopped",
      serviceName: service.definition.name,
      serviceStatus: service.status,
      servicePort: service.definition.expectedPort,
      serviceRestartCount: service.restartCount,
      message: reason,
    });
  }

  private async observeService(service: ManagedService): Promise<void> {
    const process = service.process;

    if (!process || service.desiredStopped || this.stopping) {
      return;
    }

    let status: Awaited<ReturnType<Process["getStatus"]>>;

    try {
      status = await process.getStatus();
    } catch (error) {
      service.observationFailures += 1;
      service.status = "unhealthy";
      service.error = serviceErrorMessage(error);

      await this.emit({
        type: "service_observation_failed",
        serviceName: service.definition.name,
        serviceStatus: service.status,
        servicePort: service.definition.expectedPort,
        serviceRestartCount: service.restartCount,
        error: service.error,
      });

      if (service.observationFailures >= MAX_OBSERVATION_FAILURES) {
        await process.kill().catch(() => undefined);
        await this.handleUnexpectedStop(
          service,
          `Service health could not be observed after ${MAX_OBSERVATION_FAILURES} attempts`,
          undefined,
          true,
        );
      }

      return;
    }

    if (status === "starting" || status === "running") {
      if (service.definition.expectedPort !== undefined && service.definition.healthCheck) {
        try {
          await this.waitForServiceHealth(process, service.definition, 1_000, false);

          if (service.status === "unhealthy") {
            service.status = "healthy";
            service.error = undefined;
            service.healthyAt = new Date().toISOString();

            await this.emit({
              type: "service_healthy",
              serviceName: service.definition.name,
              serviceStatus: service.status,
              servicePort: service.definition.expectedPort,
              serviceRestartCount: service.restartCount,
              serviceHealthPath:
                service.definition.healthCheck.type === "http"
                  ? service.definition.healthCheck.path
                  : undefined,
              message: "Service health check recovered",
            });
          }

          service.observationFailures = 0;
        } catch (error) {
          if (error instanceof SandboxCancellationError) {
            return;
          }

          service.observationFailures += 1;
          service.status = "unhealthy";
          service.error = serviceErrorMessage(error);

          await this.emit({
            type: "service_unhealthy",
            serviceName: service.definition.name,
            serviceStatus: service.status,
            servicePort: service.definition.expectedPort,
            serviceRestartCount: service.restartCount,
            serviceHealthPath:
              service.definition.healthCheck.type === "http"
                ? service.definition.healthCheck.path
                : undefined,
            error: service.error,
          });

          if (service.observationFailures >= MAX_OBSERVATION_FAILURES) {
            await process.kill().catch(() => undefined);
            await this.handleUnexpectedStop(
              service,
              `Service health check failed ${MAX_OBSERVATION_FAILURES} times`,
              undefined,
              true,
            );
          }
        }
      } else {
        service.observationFailures = 0;
      }

      return;
    }

    const exitCode = process.exitCode;
    const message = `Service exited unexpectedly${exitCode === undefined ? "" : ` with code ${exitCode}`}`;

    await this.handleUnexpectedStop(
      service,
      message,
      exitCode,
      exitCode === undefined || exitCode !== 0,
    );
  }

  private async waitForServiceHealth(
    process: Process,
    definition: SandboxServiceDefinition,
    timeout: number,
    observeCancellation: boolean,
  ): Promise<void> {
    if (definition.expectedPort === undefined || !definition.healthCheck) {
      return;
    }

    const readiness = process.waitForPort(definition.expectedPort, {
      mode: definition.healthCheck.type,
      path: definition.healthCheck.type === "http" ? definition.healthCheck.path : undefined,
      status:
        definition.healthCheck.type === "http" ? definition.healthCheck.expectedStatus : undefined,
      timeout,
      interval: 250,
    });

    if (!observeCancellation) {
      await readiness;

      return;
    }

    let monitoring = true;
    const cancellation = (async (): Promise<never> => {
      for (;;) {
        if (!monitoring) {
          return new Promise<never>(() => undefined);
        }

        if (this.options.abortSignal?.aborted) {
          throw new SandboxCancellationError("Sandbox run cancelled during service startup");
        }

        const control = await this.options.approvalClient?.fetchControlState(
          this.options.abortSignal,
        );

        if (control?.state === "cancelled") {
          throw new SandboxCancellationError(
            control.cancellationReason || "Sandbox run cancelled during service startup",
          );
        }

        await delay(SERVICE_OBSERVATION_INTERVAL_MS, this.options.abortSignal);
      }
    })();

    try {
      await Promise.race([readiness, cancellation]);
    } finally {
      monitoring = false;
    }
  }

  private async handleUnexpectedStop(
    service: ManagedService,
    message: string,
    exitCode: number | undefined,
    failed: boolean,
  ): Promise<void> {
    service.process = undefined;
    service.status = "unhealthy";
    service.error = message;

    await this.emit({
      type: "service_unhealthy",
      serviceName: service.definition.name,
      serviceStatus: service.status,
      servicePort: service.definition.expectedPort,
      serviceRestartCount: service.restartCount,
      exitCode,
      error: message,
    });

    const restartPolicy = service.definition.restartPolicy;
    const shouldRestart =
      restartPolicy.mode === "always" || (restartPolicy.mode === "on_failure" && failed);

    if (shouldRestart) {
      try {
        await this.restartWithBudget(service, new Error(message));

        return;
      } catch (error) {
        this.recordFatalFailure(
          error instanceof Error ? error : new Error(`Service ${service.definition.name} failed`),
        );

        return;
      }
    }

    service.status = "failed";
    await this.emit({
      type: "service_failed",
      serviceName: service.definition.name,
      serviceStatus: service.status,
      servicePort: service.definition.expectedPort,
      serviceRestartCount: service.restartCount,
      exitCode,
      error: message,
    });
    this.recordFatalFailure(new Error(`Service ${service.definition.name} stopped unexpectedly`));
  }

  private affectedDependants(serviceName: string): Set<string> {
    const affected = new Set([serviceName]);
    let changed = true;

    while (changed) {
      changed = false;

      for (const service of this.ordered) {
        if (
          !affected.has(service.definition.name) &&
          service.definition.dependencies.some((dependency) => affected.has(dependency))
        ) {
          affected.add(service.definition.name);
          changed = true;
        }
      }
    }

    return affected;
  }

  private async ensureServiceStarted(service: ManagedService): Promise<void> {
    for (const dependencyName of service.definition.dependencies) {
      const dependency = this.managed.get(dependencyName);

      if (dependency && !serviceIsActive(dependency)) {
        await this.ensureServiceStarted(dependency);
        dependency.restartCount = 0;
        await this.startWithRetries(dependency);
      }
    }

    if (!serviceIsActive(service)) {
      service.restartCount = 0;
      await this.startWithRetries(service);
    }
  }

  private async applyAction(serviceName: string, action: SandboxServiceAction): Promise<void> {
    const service = this.managed.get(serviceName);

    if (!service) {
      throw new Error(`Service ${serviceName} is not declared for this run`);
    }

    if (action === "start") {
      await this.ensureServiceStarted(service);

      return;
    }

    const affected = this.affectedDependants(serviceName);
    const activeBefore = new Set(
      this.ordered
        .filter(
          (candidate) => affected.has(candidate.definition.name) && serviceIsActive(candidate),
        )
        .map((candidate) => candidate.definition.name),
    );

    for (const candidate of this.ordered.slice().reverse()) {
      if (affected.has(candidate.definition.name)) {
        await this.stopManagedService(
          candidate,
          `${action === "stop" ? "Stopped" : "Restarted"} by run owner`,
        );
      }
    }

    if (action === "stop") {
      return;
    }

    for (const candidate of this.ordered) {
      if (
        candidate.definition.name === serviceName ||
        activeBefore.has(candidate.definition.name)
      ) {
        candidate.restartCount = 0;
        await this.ensureServiceStarted(candidate);
      }
    }
  }

  private async handleServiceActions(): Promise<void> {
    if (!this.options.approvalClient) {
      return;
    }

    const instructions = await this.options.approvalClient.listInstructions(
      this.lastInstructionIndex,
      this.abortController.signal,
    );

    for (const envelope of instructions) {
      this.lastInstructionIndex = Math.max(this.lastInstructionIndex, envelope.index);
      const instruction = envelope.instruction;

      if (
        instruction.kind !== "service_action" ||
        !instruction.serviceName ||
        !instruction.serviceAction
      ) {
        continue;
      }

      const service = this.managed.get(instruction.serviceName);

      await this.emit({
        type: "service_action_received",
        instructionId: instruction.id,
        instructionKind: instruction.kind,
        serviceName: instruction.serviceName,
        serviceAction: instruction.serviceAction,
        serviceStatus: service?.status,
      });

      try {
        await this.applyAction(instruction.serviceName, instruction.serviceAction);
        const updated = this.managed.get(instruction.serviceName);

        await this.emit({
          type: "service_action_completed",
          instructionId: instruction.id,
          instructionKind: instruction.kind,
          serviceName: instruction.serviceName,
          serviceAction: instruction.serviceAction,
          serviceStatus: updated?.status,
          servicePort: updated?.definition.expectedPort,
          serviceRestartCount: updated?.restartCount,
        });
      } catch (error) {
        await this.emit({
          type: "service_action_rejected",
          instructionId: instruction.id,
          instructionKind: instruction.kind,
          serviceName: instruction.serviceName,
          serviceAction: instruction.serviceAction,
          serviceStatus: service?.status,
          servicePort: service?.definition.expectedPort,
          error: serviceErrorMessage(error),
        });
      }
    }
  }

  private recordFatalFailure(error: Error): void {
    if (this.fatalError || this.stopping) {
      return;
    }

    this.fatalError = error;

    for (const reject of this.failureWaiters) {
      reject(error);
    }

    this.failureWaiters.clear();
    this.abortController.abort();
  }

  private async monitor(): Promise<void> {
    while (!this.stopping) {
      await this.handleServiceActions();

      for (const service of this.ordered) {
        await this.observeService(service);

        if (this.fatalError || this.stopping) {
          return;
        }
      }

      await delay(SERVICE_OBSERVATION_INTERVAL_MS, this.abortController.signal);
    }
  }
}
