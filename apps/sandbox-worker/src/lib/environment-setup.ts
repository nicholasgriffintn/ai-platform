import {
  SANDBOX_ENVIRONMENT_CACHE_PLATFORM_VERSION,
  SANDBOX_REPOSITORY_ENVIRONMENT_PATH,
  sandboxEnvironmentDefinitionSchema,
  type SandboxEnvironmentCacheRecord,
  type SandboxEnvironmentDefinition,
  type SandboxEnvironmentPreparationMode,
  type SandboxEnvironmentSetup,
  type SandboxPackageManagerRequirement,
  type SandboxRunEnvironmentEvidence,
  type SandboxRuntimeRequirement,
  type SandboxServiceDefinition,
  type SandboxTrustLevel,
} from "@ngriffin_uk/polychat-schemas";

import type { TaskEvent } from "../types";
import {
  assertSafeCommand,
  formatCommandResult,
  getCommandRiskLevel,
  quoteForShell,
  runSandboxCommand,
  type SandboxExecInstance,
} from "./commands";
import { resolveCommandApproval } from "./feature-implementation/command-approval";
import { redactSandboxOutput } from "./output-redaction";
import type { RunControlClient } from "./run-control-client";

const MAX_REPOSITORY_CONFIGURATION_BYTES = 32_000;
const MAX_SETUP_EVENT_OUTPUT_CHARS = 4_000;
const ENVIRONMENT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

const RUNTIME_VERSION_COMMANDS: Record<SandboxRuntimeRequirement["name"], string> = {
  node: "node --version",
  python: "python3 --version",
  go: "go version",
  rust: "rustc --version",
  java: "java -version",
  ruby: "ruby --version",
};

const PACKAGE_MANAGER_VERSION_COMMANDS: Record<SandboxPackageManagerRequirement["name"], string> = {
  npm: "npm --version",
  pnpm: "pnpm --version",
  yarn: "yarn --version",
  bun: "bun --version",
  pip: "pip --version",
  poetry: "poetry --version",
  uv: "uv --version",
  cargo: "cargo --version",
  bundler: "bundle --version",
  maven: "mvn --version",
  gradle: "gradle --version",
  swiftpm: "swift package --version",
};

interface ResolvedEnvironmentSetup {
  source: SandboxEnvironmentSetup["source"];
  definition: SandboxEnvironmentDefinition;
  configurationRevision: string;
  configurationPath?: string;
}

export interface SandboxEnvironmentPreparationResult {
  evidence?: SandboxRunEnvironmentEvidence;
  cacheRecord?: SandboxEnvironmentCacheRecord;
  services?: SandboxServiceDefinition[];
}

async function hashConfiguration(definition: SandboxEnvironmentDefinition): Promise<string> {
  return hashValue(definition);
}

async function hashValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildEnvironmentCacheKey(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  userId: number;
  projectId?: string;
  installationId?: number;
  repo: string;
  generation: number;
  resolved: ResolvedEnvironmentSetup;
}): Promise<{ cacheKey: string; repositoryRevision: string }> {
  const revisionResult = await params.sandbox.exec(
    `git -C ${quoteForShell(params.repoTargetDir)} rev-parse HEAD`,
  );

  if (!revisionResult.success || !revisionResult.stdout.trim()) {
    throw new Error("Repository revision could not be resolved for environment caching");
  }

  const repositoryRevision = revisionResult.stdout.trim();
  const lockfilesResult = await params.sandbox.exec(
    `git -C ${quoteForShell(params.repoTargetDir)} ls-tree -r HEAD -- package-lock.json pnpm-lock.yaml yarn.lock bun.lock bun.lockb poetry.lock uv.lock Cargo.lock Gemfile.lock go.sum`,
  );
  const cacheKey = await hashValue({
    scope: params.projectId ? `project:${params.projectId}` : `user:${params.userId}`,
    userId: params.userId,
    installationId: params.installationId,
    repo: params.repo.toLowerCase(),
    generation: params.generation,
    repositoryRevision,
    lockfiles: lockfilesResult.success ? lockfilesResult.stdout.trim() : "unavailable",
    configurationRevision: params.resolved.configurationRevision,
    runtimes: params.resolved.definition.runtimes,
    packageManager: params.resolved.definition.packageManager,
    platformVersion: SANDBOX_ENVIRONMENT_CACHE_PLATFORM_VERSION,
  });

  return { cacheKey, repositoryRevision };
}

async function cleanAfterFailedRestore(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
}): Promise<void> {
  const reset = await params.sandbox.exec(
    `git -C ${quoteForShell(params.repoTargetDir)} reset --hard HEAD`,
  );
  const clean = await params.sandbox.exec(
    `git -C ${quoteForShell(params.repoTargetDir)} clean -fdx`,
  );

  if (!reset.success || !clean.success) {
    throw new Error("Cache restore failed and the clean setup fallback could not be prepared");
  }
}

async function resolveRepositoryEnvironmentSetup(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
}): Promise<ResolvedEnvironmentSetup> {
  const fileResult = await params.sandbox.exec(
    `git -C ${quoteForShell(params.repoTargetDir)} show HEAD:${SANDBOX_REPOSITORY_ENVIRONMENT_PATH}`,
  );

  if (!fileResult.success) {
    throw new Error(
      `Repository environment configuration is missing at ${SANDBOX_REPOSITORY_ENVIRONMENT_PATH}`,
    );
  }

  if (new TextEncoder().encode(fileResult.stdout).byteLength > MAX_REPOSITORY_CONFIGURATION_BYTES) {
    throw new Error("Repository environment configuration is too large");
  }

  let value: unknown;

  try {
    value = JSON.parse(fileResult.stdout);
  } catch {
    throw new Error("Repository environment configuration is not valid JSON");
  }

  const parsed = sandboxEnvironmentDefinitionSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(`Repository environment configuration is invalid: ${parsed.error.message}`);
  }

  const revisionResult = await params.sandbox.exec(
    `git -C ${quoteForShell(params.repoTargetDir)} rev-parse HEAD:${SANDBOX_REPOSITORY_ENVIRONMENT_PATH}`,
  );

  if (!revisionResult.success || !revisionResult.stdout.trim()) {
    throw new Error("Repository environment configuration revision could not be resolved");
  }

  return {
    source: "repository",
    definition: parsed.data,
    configurationRevision: revisionResult.stdout.trim(),
    configurationPath: SANDBOX_REPOSITORY_ENVIRONMENT_PATH,
  };
}

async function resolveEnvironmentSetup(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  setup: SandboxEnvironmentSetup;
}): Promise<ResolvedEnvironmentSetup> {
  if (params.setup.source === "repository") {
    return resolveRepositoryEnvironmentSetup(params);
  }

  return {
    source: "polychat",
    definition: params.setup.definition,
    configurationRevision: await hashConfiguration(params.setup.definition),
  };
}

async function assertRequirement(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  label: string;
  command: string;
  version?: string;
}): Promise<void> {
  const result = await params.sandbox.exec(
    `cd ${quoteForShell(params.repoTargetDir)} && ${params.command}`,
  );
  const observed = [result.stdout, result.stderr].join(" ").trim();

  if (!result.success) {
    throw new Error(`${params.label} is required but is not available`);
  }

  if (params.version) {
    const requiredVersion = params.version.replace(/^[vV]/, "");
    const observedVersion = /[vV]?(\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9.-]+)?)/.exec(observed)?.[1];

    if (!observedVersion?.startsWith(requiredVersion)) {
      throw new Error(`${params.label} does not satisfy version ${params.version}`);
    }
  }
}

async function assertEnvironmentRequirements(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  definition: SandboxEnvironmentDefinition;
}): Promise<void> {
  const checks = params.definition.runtimes.map((runtime) =>
    assertRequirement({
      sandbox: params.sandbox,
      repoTargetDir: params.repoTargetDir,
      label: runtime.name,
      command: RUNTIME_VERSION_COMMANDS[runtime.name],
      version: runtime.version,
    }),
  );

  const packageManager = params.definition.packageManager;

  if (packageManager) {
    checks.push(
      assertRequirement({
        sandbox: params.sandbox,
        repoTargetDir: params.repoTargetDir,
        label: packageManager.name,
        command: PACKAGE_MANAGER_VERSION_COMMANDS[packageManager.name],
        version: packageManager.version,
      }),
    );
  }

  await Promise.all(checks);
}

async function restoreEnvironmentCache(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  cache?: SandboxEnvironmentCacheRecord;
  cacheKey: string;
  generation: number;
  emit: (event: TaskEvent) => Promise<void>;
}): Promise<{ reused: boolean; invalidationReason?: string }> {
  const cache = params.cache;

  if (
    !cache ||
    cache.status !== "ready" ||
    cache.cacheKey !== params.cacheKey ||
    cache.generation !== params.generation
  ) {
    const invalidationReason =
      cache?.invalidationReason ??
      (cache?.cacheKey && cache.cacheKey !== params.cacheKey ? "cache_key_changed" : "not_found");

    await params.emit({
      type: "environment_cache_miss",
      cacheKey: params.cacheKey,
      cacheStatus: "miss",
      cacheInvalidationReason: invalidationReason,
    });

    return { reused: false, invalidationReason };
  }

  if (!params.sandbox.restoreBackup) {
    await params.emit({
      type: "environment_cache_restore_failed",
      cacheKey: params.cacheKey,
      cacheStatus: "failed",
      cacheInvalidationReason: "backup_runtime_unavailable",
    });

    return { reused: false, invalidationReason: "backup_runtime_unavailable" };
  }

  try {
    const restored = await params.sandbox.restoreBackup({
      id: cache.backupId,
      dir: params.repoTargetDir,
      localBucket: true,
    });

    if (!restored.success) {
      throw new Error("Environment snapshot restore did not complete");
    }

    const ageSeconds = Math.max(0, Date.now() - Date.parse(cache.createdAt)) / 1000;

    await params.emit({
      type: "environment_cache_restored",
      cacheKey: params.cacheKey,
      cacheStatus: "reused",
      cacheCreatedAt: cache.createdAt,
      cacheAgeSeconds: ageSeconds,
    });

    return { reused: true };
  } catch (error) {
    await cleanAfterFailedRestore(params);
    const message = error instanceof Error ? error.message : "Cache restore failed";

    await params.emit({
      type: "environment_cache_restore_failed",
      cacheKey: params.cacheKey,
      cacheStatus: "failed",
      cacheInvalidationReason: redactSandboxOutput(message),
    });

    return { reused: false, invalidationReason: "restore_failed" };
  }
}

async function createEnvironmentCache(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  cacheKey: string;
  generation: number;
  repositoryRevision: string;
  configurationRevision: string;
  emit: (event: TaskEvent) => Promise<void>;
}): Promise<SandboxEnvironmentCacheRecord | undefined> {
  if (!params.sandbox.createBackup) {
    return undefined;
  }

  try {
    const backup = await params.sandbox.createBackup({
      dir: params.repoTargetDir,
      name: `polychat-${params.cacheKey.slice(0, 24)}`,
      ttl: ENVIRONMENT_CACHE_TTL_SECONDS,
      gitignore: false,
      excludes: [
        ".git",
        ".env",
        ".env.*",
        ".npmrc",
        ".pypirc",
        ".netrc",
        ".git-credentials",
        ".secrets",
        ".secrets.*",
        "*.pem",
        "*.key",
        "*.token",
        "*.credentials",
        "*.log",
      ],
      localBucket: true,
    });
    const createdAt = new Date().toISOString();
    const record: SandboxEnvironmentCacheRecord = {
      cacheKey: params.cacheKey,
      backupId: backup.id,
      restoreDirectory: params.repoTargetDir,
      generation: params.generation,
      repositoryRevision: params.repositoryRevision,
      configurationRevision: params.configurationRevision,
      platformVersion: SANDBOX_ENVIRONMENT_CACHE_PLATFORM_VERSION,
      status: "ready",
      createdAt,
    };

    await params.emit({
      type: "environment_cache_created",
      cacheKey: params.cacheKey,
      cacheStatus: "created",
      cacheCreatedAt: createdAt,
    });

    return record;
  } catch (error) {
    await params.emit({
      type: "environment_cache_creation_failed",
      cacheKey: params.cacheKey,
      cacheStatus: "failed",
      cacheInvalidationReason:
        error instanceof Error ? redactSandboxOutput(error.message) : "Cache creation failed",
    });

    return undefined;
  }
}

function evidenceFor(params: {
  resolved: ResolvedEnvironmentSetup;
  preparationMode: SandboxEnvironmentPreparationMode;
  status: SandboxRunEnvironmentEvidence["status"];
  startedAt: number;
  commandCount: number;
  cache?: SandboxRunEnvironmentEvidence["cache"];
}): SandboxRunEnvironmentEvidence {
  return {
    source: params.resolved.source,
    configurationRevision: params.resolved.configurationRevision,
    configurationPath: params.resolved.configurationPath,
    preparationMode: params.preparationMode,
    status: params.status,
    runtimes: params.resolved.definition.runtimes,
    packageManager: params.resolved.definition.packageManager,
    durationSeconds: Math.max(0, Date.now() - params.startedAt) / 1000,
    commandCount: params.commandCount,
    cache: params.cache,
  };
}

export async function prepareSandboxEnvironment(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  userId: number;
  projectId?: string;
  installationId?: number;
  repo: string;
  setup?: SandboxEnvironmentSetup;
  requestedMode?: SandboxEnvironmentPreparationMode;
  environmentCache?: SandboxEnvironmentCacheRecord;
  environmentCacheGeneration?: number;
  trustLevel: SandboxTrustLevel;
  executionLogs: string[];
  approvalClient?: RunControlClient;
  abortSignal?: AbortSignal;
  checkpoint: (abortMessage: string) => Promise<void>;
  emit: (event: TaskEvent) => Promise<void>;
}): Promise<SandboxEnvironmentPreparationResult> {
  if (!params.setup) {
    return {};
  }

  const setup = params.setup;
  const startedAt = Date.now();
  let resolved: ResolvedEnvironmentSetup;

  try {
    resolved = await resolveEnvironmentSetup({
      sandbox: params.sandbox,
      repoTargetDir: params.repoTargetDir,
      setup,
    });
  } catch (error) {
    await params.emit({
      type: "environment_setup_failed",
      configurationSource: setup.source,
      configurationPath:
        setup.source === "repository" ? SANDBOX_REPOSITORY_ENVIRONMENT_PATH : undefined,
      preparationMode: params.requestedMode ?? "setup",
      preparationStatus: "failed",
      error: error instanceof Error ? error.message : "Environment configuration failed",
    });

    throw error;
  }

  const generation = params.environmentCacheGeneration ?? 0;
  let cacheIdentity: { cacheKey: string; repositoryRevision: string } | undefined;

  if (params.projectId) {
    try {
      cacheIdentity = await buildEnvironmentCacheKey({
        sandbox: params.sandbox,
        repoTargetDir: params.repoTargetDir,
        userId: params.userId,
        projectId: params.projectId,
        installationId: params.installationId,
        repo: params.repo,
        generation,
        resolved,
      });
    } catch (error) {
      await params.emit({
        type: "environment_cache_key_failed",
        cacheStatus: "failed",
        cacheInvalidationReason:
          error instanceof Error ? redactSandboxOutput(error.message) : "Cache key failed",
      });
    }
  }

  const cacheRestore = cacheIdentity
    ? await restoreEnvironmentCache({
        sandbox: params.sandbox,
        repoTargetDir: params.repoTargetDir,
        cache: params.environmentCache,
        cacheKey: cacheIdentity.cacheKey,
        generation,
        emit: params.emit,
      })
    : { reused: false };
  const preparationMode =
    (cacheRestore.reused || params.requestedMode === "resume") &&
    resolved.definition.resumeCommands.length > 0
      ? "resume"
      : "setup";
  const commands =
    preparationMode === "resume"
      ? resolved.definition.resumeCommands
      : resolved.definition.setupCommands;
  const timeoutSignal = AbortSignal.timeout(resolved.definition.setupTimeoutSeconds * 1000);
  const commandSignal = params.abortSignal
    ? AbortSignal.any([params.abortSignal, timeoutSignal])
    : timeoutSignal;

  await params.emit({
    type: "environment_configuration_resolved",
    configurationSource: resolved.source,
    configurationRevision: resolved.configurationRevision,
    configurationPath: resolved.configurationPath,
    preparationMode,
    runtimeRequirements: resolved.definition.runtimes,
    packageManagerRequirement: resolved.definition.packageManager,
    timeoutSeconds: resolved.definition.setupTimeoutSeconds,
    cacheKey: cacheIdentity?.cacheKey,
    cacheStatus: cacheIdentity ? (cacheRestore.reused ? "reused" : "miss") : undefined,
    cacheCreatedAt: cacheRestore.reused ? params.environmentCache?.createdAt : undefined,
    cacheAgeSeconds:
      cacheRestore.reused && params.environmentCache
        ? Math.max(0, Date.now() - Date.parse(params.environmentCache.createdAt)) / 1000
        : undefined,
    cacheInvalidationReason: cacheRestore.invalidationReason,
  });
  await params.emit({
    type: "environment_setup_started",
    configurationSource: resolved.source,
    configurationRevision: resolved.configurationRevision,
    configurationPath: resolved.configurationPath,
    preparationMode,
    commandTotal: commands.length,
  });

  try {
    await assertEnvironmentRequirements({
      sandbox: params.sandbox,
      repoTargetDir: params.repoTargetDir,
      definition: resolved.definition,
    });

    for (const [index, command] of commands.entries()) {
      await params.checkpoint("Sandbox run cancelled during environment setup");
      assertSafeCommand(command, { trustLevel: "trusted" });
      const riskLevel = getCommandRiskLevel(command);
      const approval = await resolveCommandApproval({
        command,
        riskLevel,
        trustLevel: params.trustLevel,
        agentStep: 0,
        emit: params.emit,
        approvalClient: params.approvalClient,
        abortSignal: commandSignal,
        guardExecution: params.checkpoint,
      });

      if (approval.rejected) {
        throw new Error(approval.rejectedMessage ?? "Environment setup command was not approved");
      }

      assertSafeCommand(command, {
        trustLevel: params.trustLevel,
        allowNetwork: approval.allowNetwork,
        allowRisky: approval.allowRisky,
      });

      const safeCommand = redactSandboxOutput(command);

      await params.emit({
        type: "environment_setup_command_started",
        command: safeCommand,
        commandIndex: index + 1,
        commandTotal: commands.length,
        preparationMode,
      });
      const result = await runSandboxCommand(
        params.sandbox,
        `cd ${quoteForShell(params.repoTargetDir)} && ${command}`,
        {
          abortSignal: commandSignal,
          onOutput: async ({ stream, data }) => {
            await params.emit({
              type: "environment_setup_command_output",
              command: safeCommand,
              commandIndex: index + 1,
              commandTotal: commands.length,
              preparationMode,
              stream,
              output: redactSandboxOutput(data).slice(0, MAX_SETUP_EVENT_OUTPUT_CHARS),
              truncated: data.length > MAX_SETUP_EVENT_OUTPUT_CHARS,
            });
          },
        },
      );
      const safeResult = {
        ...result,
        stdout: redactSandboxOutput(result.stdout),
        stderr: redactSandboxOutput(result.stderr),
      };

      params.executionLogs.push(formatCommandResult(safeCommand, safeResult));

      if (!result.success) {
        throw new Error(
          safeResult.stderr || safeResult.stdout || `Setup command ${index + 1} failed`,
        );
      }

      await params.emit({
        type: "environment_setup_command_completed",
        command: safeCommand,
        commandIndex: index + 1,
        commandTotal: commands.length,
        preparationMode,
        exitCode: result.exitCode,
      });
    }

    const cacheRecord = !cacheIdentity
      ? undefined
      : cacheRestore.reused
        ? params.environmentCache
          ? { ...params.environmentCache, lastUsedAt: new Date().toISOString() }
          : undefined
        : await createEnvironmentCache({
            sandbox: params.sandbox,
            repoTargetDir: params.repoTargetDir,
            cacheKey: cacheIdentity.cacheKey,
            generation,
            repositoryRevision: cacheIdentity.repositoryRevision,
            configurationRevision: resolved.configurationRevision,
            emit: params.emit,
          });
    const cacheEvidence: SandboxRunEnvironmentEvidence["cache"] = !cacheIdentity
      ? undefined
      : cacheRestore.reused
        ? {
            status: "reused",
            cacheKey: cacheIdentity.cacheKey,
            createdAt: params.environmentCache?.createdAt,
            ageSeconds: params.environmentCache
              ? Math.max(0, Date.now() - Date.parse(params.environmentCache.createdAt)) / 1000
              : undefined,
          }
        : cacheRecord
          ? {
              status: "created",
              cacheKey: cacheIdentity.cacheKey,
              createdAt: cacheRecord.createdAt,
              ageSeconds: 0,
            }
          : {
              status: params.sandbox.createBackup ? "failed" : "miss",
              cacheKey: cacheIdentity.cacheKey,
              invalidationReason: params.sandbox.createBackup
                ? "snapshot_creation_failed"
                : "backup_runtime_unavailable",
            };
    const evidence = evidenceFor({
      resolved,
      preparationMode,
      status: "completed",
      startedAt,
      commandCount: commands.length,
      cache: cacheEvidence,
    });

    await params.emit({
      type: "environment_setup_completed",
      configurationSource: evidence.source,
      configurationRevision: evidence.configurationRevision,
      configurationPath: evidence.configurationPath,
      preparationMode: evidence.preparationMode,
      preparationStatus: evidence.status,
      durationSeconds: evidence.durationSeconds,
      commandCount: evidence.commandCount,
      cacheKey: cacheEvidence?.cacheKey,
      cacheStatus: cacheEvidence?.status,
      cacheCreatedAt: cacheEvidence?.createdAt,
      cacheAgeSeconds: cacheEvidence?.ageSeconds,
      cacheInvalidationReason: cacheEvidence?.invalidationReason,
    });

    return { evidence, cacheRecord, services: resolved.definition.services ?? [] };
  } catch (error) {
    const message = timeoutSignal.aborted
      ? `Environment ${preparationMode} timed out after ${resolved.definition.setupTimeoutSeconds} seconds`
      : error instanceof Error
        ? redactSandboxOutput(error.message)
        : `Environment ${preparationMode} failed`;
    const evidence = evidenceFor({
      resolved,
      preparationMode,
      status: "failed",
      startedAt,
      commandCount: commands.length,
      cache: cacheIdentity
        ? {
            status: cacheRestore.reused ? "reused" : "failed",
            cacheKey: cacheIdentity.cacheKey,
            createdAt: cacheRestore.reused ? params.environmentCache?.createdAt : undefined,
            ageSeconds:
              cacheRestore.reused && params.environmentCache
                ? Math.max(0, Date.now() - Date.parse(params.environmentCache.createdAt)) / 1000
                : undefined,
            invalidationReason: cacheRestore.reused ? undefined : cacheRestore.invalidationReason,
          }
        : undefined,
    });

    await params.emit({
      type: "environment_setup_failed",
      configurationSource: evidence.source,
      configurationRevision: evidence.configurationRevision,
      configurationPath: evidence.configurationPath,
      preparationMode: evidence.preparationMode,
      preparationStatus: evidence.status,
      durationSeconds: evidence.durationSeconds,
      commandCount: evidence.commandCount,
      error: message,
      cacheKey: cacheIdentity?.cacheKey,
      cacheStatus: evidence.cache?.status,
      cacheCreatedAt: evidence.cache?.createdAt,
      cacheAgeSeconds: evidence.cache?.ageSeconds,
      cacheInvalidationReason: evidence.cache?.invalidationReason,
    });

    throw new Error(message, { cause: error });
  }
}
