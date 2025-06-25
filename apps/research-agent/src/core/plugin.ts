import type {
  Artifact,
  ExecutionContext,
  ExecutionMetrics,
  PluginManifest,
  StageResult,
} from "../types/core.js";
import { ResearchError } from "./errors.js";

export abstract class BasePlugin {
  protected manifest: PluginManifest;
  protected config: Record<string, any>;
  protected metrics: ExecutionMetrics;

  constructor(manifest: PluginManifest, config: Record<string, any> = {}) {
    this.manifest = manifest;
    this.config = this.validateConfig(config);
    this.metrics = this.initializeMetrics();
  }

  abstract execute(context: ExecutionContext): Promise<StageResult>;

  protected validateConfig(config: Record<string, any>): Record<string, any> {
    const validatedConfig: Record<string, any> = {};

    for (const [key, schema] of Object.entries(this.manifest.configuration)) {
      if (schema.required && !(key in config)) {
        throw new ResearchError({
          code: "PLUGIN_CONFIG_MISSING",
          message: `Required configuration key '${key}' is missing`,
          retryable: false,
        });
      }

      const value = config[key] ?? schema.default;
      validatedConfig[key] = this.validateValue(value, schema);
    }

    return validatedConfig;
  }

  private validateValue(value: any, schema: any): any {
    if (value === undefined || value === null) {
      return schema.default;
    }

    switch (schema.type) {
      case "string":
        if (typeof value !== "string") {
          throw new ResearchError({
            code: "PLUGIN_CONFIG_TYPE_ERROR",
            message: `Expected string, got ${typeof value}`,
            retryable: false,
          });
        }
        break;
      case "number":
        if (typeof value !== "number") {
          throw new ResearchError({
            code: "PLUGIN_CONFIG_TYPE_ERROR",
            message: `Expected number, got ${typeof value}`,
            retryable: false,
          });
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw new ResearchError({
            code: "PLUGIN_CONFIG_TYPE_ERROR",
            message: `Expected boolean, got ${typeof value}`,
            retryable: false,
          });
        }
        break;
    }

    return value;
  }

  protected initializeMetrics(): ExecutionMetrics {
    return {
      duration: 0,
      memoryUsage: 0,
      apiCalls: 0,
      errorCount: 0,
      retryCount: 0,
      customMetrics: {},
    };
  }

  protected createArtifact(
    type: Artifact["type"],
    name: string,
    content: any,
    metadata: Partial<Artifact["metadata"]> = {},
  ): Artifact {
    return {
      id: crypto.randomUUID(),
      type,
      name,
      content,
      metadata: {
        source: this.manifest.name,
        format: typeof content === "string" ? "text" : "json",
        size: JSON.stringify(content).length,
        ...metadata,
      },
      createdAt: new Date().toISOString(),
    };
  }

  protected createError(
    code: string,
    message: string,
    retryable = false,
    details?: Record<string, any>,
  ): ResearchError {
    return {
      name: this.manifest.name,
      code,
      message,
      details,
      retryable,
      cause: new Error(message),
    };
  }

  protected async executeWithMetrics<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = await operation();

      this.metrics.duration += performance.now() - startTime;
      this.metrics.memoryUsage = Math.max(
        this.metrics.memoryUsage,
        this.getMemoryUsage() - startMemory,
      );

      this.metrics.customMetrics[operationName] =
        (this.metrics.customMetrics[operationName] || 0) + 1;

      return result;
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.duration += performance.now() - startTime;
      throw error;
    }
  }

  protected getMemoryUsage(): number {
    return 0;
  }

  protected log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: any,
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      plugin: this.manifest.name,
      message,
      data,
    };

    console.log(
      `[${timestamp}] [${level.toUpperCase()}] [${this.manifest.name}] ${message}`,
      data,
    );
  }

  getManifest(): PluginManifest {
    return this.manifest;
  }

  getConfig(): Record<string, any> {
    return this.config;
  }

  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }
}

export abstract class DataCollectorPlugin extends BasePlugin {
  abstract collect(context: ExecutionContext): Promise<Artifact[]>;

  async execute(context: ExecutionContext): Promise<StageResult> {
    const startTime = performance.now();

    try {
      this.log("info", "Starting data collection", {
        stageId: context.stageId,
      });

      const artifacts = await this.executeWithMetrics(
        () => this.collect(context),
        "data_collection",
      );

      const metrics = this.getMetrics();
      metrics.duration = performance.now() - startTime;

      this.log("info", "Data collection completed", {
        artifactCount: artifacts.length,
        duration: metrics.duration,
      });

      return {
        success: true,
        output: artifacts,
        metrics,
        artifacts,
      };
    } catch (error: any) {
      const metrics = this.getMetrics();
      metrics.duration = performance.now() - startTime;
      metrics.errorCount++;

      this.log("error", "Data collection failed", { error: error.message });

      return {
        success: false,
        error:
          error instanceof ResearchError
            ? error
            : this.createError(
                "DATA_COLLECTION_ERROR",
                `Data collection failed: ${error.message}`,
                true,
              ),
        metrics,
        artifacts: [],
      };
    }
  }
}

export abstract class AnalyzerPlugin extends BasePlugin {
  abstract analyze(data: Artifact[], context: ExecutionContext): Promise<any>;

  async execute(context: ExecutionContext): Promise<StageResult> {
    const startTime = performance.now();

    try {
      this.log("info", "Starting analysis", { stageId: context.stageId });

      const inputArtifacts = context.data.artifacts || [];
      const analysisResult = await this.executeWithMetrics(
        () => this.analyze(inputArtifacts, context),
        "analysis",
      );

      const resultArtifact = this.createArtifact(
        "analysis_result",
        `${this.manifest.name}_analysis`,
        analysisResult,
      );

      const metrics = this.getMetrics();
      metrics.duration = performance.now() - startTime;

      this.log("info", "Analysis completed", {
        duration: metrics.duration,
        resultSize: resultArtifact.metadata.size,
      });

      return {
        success: true,
        output: analysisResult,
        metrics,
        artifacts: [resultArtifact],
      };
    } catch (error: any) {
      const metrics = this.getMetrics();
      metrics.duration = performance.now() - startTime;
      metrics.errorCount++;

      this.log("error", "Analysis failed", { error: error.message });

      return {
        success: false,
        error:
          error instanceof ResearchError
            ? error
            : this.createError(
                "ANALYSIS_ERROR",
                `Analysis failed: ${error.message}`,
                true,
              ),
        metrics,
        artifacts: [],
      };
    }
  }
}

export abstract class SynthesizerPlugin extends BasePlugin {
  abstract synthesize(analyses: any[], context: ExecutionContext): Promise<any>;

  async execute(context: ExecutionContext): Promise<StageResult> {
    const startTime = performance.now();

    try {
      this.log("info", "Starting synthesis", { stageId: context.stageId });

      const analysisResults = context.data.intermediateResults || {};
      const analyses = Object.values(analysisResults);

      const synthesis = await this.executeWithMetrics(
        () => this.synthesize(analyses, context),
        "synthesis",
      );

      const synthesisArtifact = this.createArtifact(
        "report",
        `${this.manifest.name}_synthesis`,
        synthesis,
      );

      const metrics = this.getMetrics();
      metrics.duration = performance.now() - startTime;

      this.log("info", "Synthesis completed", {
        duration: metrics.duration,
        inputCount: analyses.length,
      });

      return {
        success: true,
        output: synthesis,
        metrics,
        artifacts: [synthesisArtifact],
      };
    } catch (error: any) {
      const metrics = this.getMetrics();
      metrics.duration = performance.now() - startTime;
      metrics.errorCount++;

      this.log("error", "Synthesis failed", { error: error.message });

      return {
        success: false,
        error:
          error instanceof ResearchError
            ? error
            : this.createError(
                "SYNTHESIS_ERROR",
                `Synthesis failed: ${error.message}`,
                true,
              ),
        metrics,
        artifacts: [],
      };
    }
  }
}
