import type {
  Artifact,
  ExecutionContext,
  ExecutionMetrics,
  ExecutionPlan,
  ExecutionStage,
  StageResult,
} from "../types/index.js";
import { ResearchError } from "./errors.js";
import type { BasePlugin } from "./plugin.js";

export class ExecutionEngine {
  private plugins: Map<string, BasePlugin> = new Map();
  private activeExecutions: Map<string, ExecutionState> = new Map();
  private maxConcurrentStages = 5;
  private defaultTimeout = 300000; // 5 minutes

  constructor(options: ExecutionEngineOptions = {}) {
    this.maxConcurrentStages = options.maxConcurrentStages || 5;
    this.defaultTimeout = options.defaultTimeout || 300000;
  }

  registerPlugin(plugin: BasePlugin): void {
    const manifest = plugin.getManifest();
    this.plugins.set(manifest.name, plugin);
  }

  async executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
    const executionId = plan.id;
    const startTime = performance.now();

    try {
      const state = this.initializeExecution(plan);
      this.activeExecutions.set(executionId, state);

      const context = this.createBaseContext(plan);
      const result = await this.executeStages(plan, context);

      const totalDuration = performance.now() - startTime;

      return {
        success: true,
        planId: plan.id,
        results: result.stageResults,
        artifacts: result.artifacts,
        metrics: {
          ...this.aggregateMetrics(result.stageResults),
          duration: totalDuration,
        },
      };
    } catch (error: any) {
      const totalDuration = performance.now() - startTime;

      return {
        success: false,
        planId: plan.id,
        error:
          error instanceof ResearchError
            ? error
            : {
                name: "ResearchError",
                code: "EXECUTION_FAILED",
                message: `Plan execution failed: ${error.message}`,
                retryable: false,
                cause: error,
              },
        results: this.activeExecutions.get(executionId)?.completedStages || {},
        artifacts: this.activeExecutions.get(executionId)?.artifacts || [],
        metrics: {
          duration: totalDuration,
          memoryUsage: 0,
          apiCalls: 0,
          errorCount: 1,
          retryCount: 0,
          customMetrics: {},
        },
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  private initializeExecution(plan: ExecutionPlan): ExecutionState {
    return {
      plan,
      completedStages: {},
      failedStages: new Set(),
      runningStages: new Set(),
      artifacts: [],
      context: new Map(),
    };
  }

  private createBaseContext(plan: ExecutionPlan): ExecutionContext {
    return {
      planId: plan.id,
      stageId: "",
      attempt: 1,
      startTime: performance.now(),
      data: {
        artifacts: [],
        intermediateResults: {},
      },
      metrics: {
        duration: 0,
        memoryUsage: 0,
        apiCalls: 0,
        errorCount: 0,
        retryCount: 0,
        customMetrics: {},
      },
    };
  }

  private async executeStages(
    plan: ExecutionPlan,
    baseContext: ExecutionContext,
  ): Promise<StageExecutionResult> {
    const state = this.activeExecutions.get(plan.id)!;
    const stageResults: Record<string, StageResult> = {};
    const allArtifacts: Artifact[] = [];

    const dependencyGraph = this.buildDependencyGraph(plan.stages);
    const executionOrder = this.topologicalSort(dependencyGraph);

    for (const stageGroup of executionOrder) {
      const groupResults = await this.executeStageGroup(
        stageGroup,
        plan,
        baseContext,
        state,
      );

      for (const [stageId, result] of Object.entries(groupResults)) {
        stageResults[stageId] = result;
        allArtifacts.push(...result.artifacts);

        if (result.success) {
          state.completedStages[stageId] = result;
          baseContext.data.intermediateResults[stageId] = result.output;
        } else {
          state.failedStages.add(stageId);

          if (!result.error?.retryable) {
            throw result.error || new Error(`Stage ${stageId} failed`);
          }
        }
      }
    }

    return {
      stageResults,
      artifacts: allArtifacts,
    };
  }

  private async executeStageGroup(
    stageIds: string[],
    plan: ExecutionPlan,
    baseContext: ExecutionContext,
    state: ExecutionState,
  ): Promise<Record<string, StageResult>> {
    const stages = stageIds.map((id) => plan.stages.find((s) => s.id === id)!);
    const promises = stages.map((stage) =>
      this.executeStage(stage, baseContext, state),
    );

    const results = await Promise.allSettled(promises);
    const stageResults: Record<string, StageResult> = {};

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const result = results[i];

      if (result.status === "fulfilled") {
        stageResults[stage.id] = result.value;
      } else {
        stageResults[stage.id] = {
          success: false,
          error: {
            name: "ResearchError",
            code: "STAGE_EXECUTION_ERROR",
            message: `Stage execution failed: ${result.reason}`,
            retryable: true,
            cause: result.reason,
          },
          metrics: baseContext.metrics,
          artifacts: [],
        };
      }
    }

    return stageResults;
  }

  private async executeStage(
    stage: ExecutionStage,
    baseContext: ExecutionContext,
    state: ExecutionState,
  ): Promise<StageResult> {
    const plugin = this.plugins.get(stage.plugin);
    if (!plugin) {
      throw new ResearchError({
        code: "PLUGIN_NOT_FOUND",
        message: `Plugin '${stage.plugin}' not found`,
        retryable: false,
      });
    }

    const context: ExecutionContext = {
      ...baseContext,
      stageId: stage.id,
      data: {
        ...baseContext.data,
        artifacts: this.getInputArtifacts(stage, state),
      },
    };

    state.runningStages.add(stage.id);

    try {
      const result = await this.executeWithTimeout(
        () => plugin.execute(context),
        stage.timeout || this.defaultTimeout,
      );

      state.runningStages.delete(stage.id);
      return result;
    } catch (error) {
      state.runningStages.delete(stage.id);

      if (this.shouldRetry(error, context.attempt, stage.retryPolicy)) {
        context.attempt++;
        context.metrics.retryCount++;
        return await this.executeStage(stage, baseContext, state);
      }

      throw error;
    }
  }

  private getInputArtifacts(
    stage: ExecutionStage,
    state: ExecutionState,
  ): Artifact[] {
    const artifacts: Artifact[] = [];

    for (const depStageId of stage.dependencies) {
      const depResult = state.completedStages[depStageId];
      if (depResult?.artifacts) {
        artifacts.push(...depResult.artifacts);
      }
    }

    return artifacts;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new ResearchError({
            code: "EXECUTION_TIMEOUT",
            message: `Operation timed out after ${timeoutMs}ms`,
            retryable: true,
          }),
        );
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private shouldRetry(
    error: any,
    attempt: number,
    retryPolicy: ExecutionStage["retryPolicy"],
  ): boolean {
    if (attempt >= retryPolicy.maxAttempts) {
      return false;
    }

    if (error instanceof ResearchError && !error.retryable) {
      return false;
    }

    const errorCode = error?.code || error?.name || "UNKNOWN_ERROR";
    return (
      retryPolicy.retryableErrors.includes(errorCode) ||
      retryPolicy.retryableErrors.includes("*")
    );
  }

  private buildDependencyGraph(
    stages: ExecutionStage[],
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const stage of stages) {
      graph.set(stage.id, stage.dependencies);
    }

    return graph;
  }

  private topologicalSort(dependencyGraph: Map<string, string[]>): string[][] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[][] = [];
    const currentLevel: string[] = [];

    const visit = (nodeId: string, level = 0): void => {
      if (visiting.has(nodeId)) {
        throw new ResearchError({
          code: "CIRCULAR_DEPENDENCY",
          message: `Circular dependency detected involving stage: ${nodeId}`,
          retryable: false,
        });
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);

      const dependencies = dependencyGraph.get(nodeId) || [];
      for (const dep of dependencies) {
        visit(dep, level + 1);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);

      if (!result[level]) {
        result[level] = [];
      }
      result[level].push(nodeId);
    };

    for (const nodeId of dependencyGraph.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    return result.filter((level) => level.length > 0);
  }

  private aggregateMetrics(
    stageResults: Record<string, StageResult>,
  ): ExecutionMetrics {
    const metrics = {
      duration: 0,
      memoryUsage: 0,
      apiCalls: 0,
      errorCount: 0,
      retryCount: 0,
      customMetrics: {} as Record<string, number>,
    };

    for (const result of Object.values(stageResults)) {
      metrics.duration = Math.max(metrics.duration, result.metrics.duration);
      metrics.memoryUsage += result.metrics.memoryUsage;
      metrics.apiCalls += result.metrics.apiCalls;
      metrics.errorCount += result.metrics.errorCount;
      metrics.retryCount += result.metrics.retryCount;

      for (const [key, value] of Object.entries(result.metrics.customMetrics)) {
        metrics.customMetrics[key] = (metrics.customMetrics[key] || 0) + value;
      }
    }

    return metrics;
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  getExecutionStatus(planId: string): ExecutionStatus | null {
    const state = this.activeExecutions.get(planId);
    if (!state) return null;

    return {
      planId,
      totalStages: state.plan.stages.length,
      completedStages: Object.keys(state.completedStages).length,
      failedStages: state.failedStages.size,
      runningStages: state.runningStages.size,
      artifacts: state.artifacts.length,
    };
  }

  async cancelExecution(planId: string): Promise<boolean> {
    const state = this.activeExecutions.get(planId);
    if (!state) return false;

    this.activeExecutions.delete(planId);
    return true;
  }
}

interface ExecutionEngineOptions {
  maxConcurrentStages?: number;
  defaultTimeout?: number;
}

interface ExecutionState {
  plan: ExecutionPlan;
  completedStages: Record<string, StageResult>;
  failedStages: Set<string>;
  runningStages: Set<string>;
  artifacts: Artifact[];
  context: Map<string, any>;
}

interface StageExecutionResult {
  stageResults: Record<string, StageResult>;
  artifacts: Artifact[];
}

interface ExecutionResult {
  success: boolean;
  planId: string;
  results: Record<string, StageResult>;
  artifacts: Artifact[];
  metrics: ExecutionMetrics;
  error?: ResearchError;
}

interface ExecutionStatus {
  planId: string;
  totalStages: number;
  completedStages: number;
  failedStages: number;
  runningStages: number;
  artifacts: number;
}
