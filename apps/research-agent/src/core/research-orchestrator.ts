import type {
  PluginManifest,
  ResearchQuery,
  ResearchReport,
  SystemStatus,
} from "../types/core.js";
import { ResearchError } from "./errors.js";
import { ExecutionEngine } from "./execution-engine.js";
import { PlanGenerator } from "./plan-generator.js";
import type { BasePlugin } from "./plugin.js";

export class ResearchOrchestrator {
  private executionEngine: ExecutionEngine;
  private planGenerator: PlanGenerator;
  private plugins: Map<string, BasePlugin> = new Map();
  private systemMetrics: SystemMetrics;

  constructor(options: OrchestratorOptions = {}) {
    this.executionEngine = new ExecutionEngine({
      maxConcurrentStages: options.maxConcurrentStages || 5,
      defaultTimeout: options.defaultTimeout || 300000,
    });

    this.planGenerator = new PlanGenerator();

    this.systemMetrics = {
      activeQueries: 0,
      completedQueries: 0,
      totalProcessingTime: 0,
      errorCount: 0,
      throughput: 0,
      startTime: Date.now(),
    };
  }

  async conductResearch(query: ResearchQuery): Promise<ResearchReport> {
    const startTime = performance.now();
    this.systemMetrics.activeQueries++;

    try {
      this.validateQuery(query);

      const executionPlan = await this.planGenerator.generatePlan(query);
      const executionResult =
        await this.executionEngine.executePlan(executionPlan);

      if (!executionResult.success) {
        throw (
          executionResult.error ||
          new Error("Execution failed without specific error")
        );
      }

      const report = await this.generateReport(
        query,
        executionPlan,
        executionResult.results,
        executionResult.artifacts,
      );

      const processingTime = performance.now() - startTime;
      this.updateSuccessMetrics(processingTime);

      return report;
    } catch (error: any) {
      const processingTime = performance.now() - startTime;
      this.updateErrorMetrics(processingTime);

      throw error instanceof ResearchError
        ? error
        : ({
            code: "RESEARCH_FAILED",
            message: `Research failed: ${error.message}`,
            retryable: false,
            cause: error,
          } as ResearchError);
    } finally {
      this.systemMetrics.activeQueries--;
    }
  }

  registerPlugin(plugin: BasePlugin): void {
    const manifest = plugin.getManifest();

    this.plugins.set(manifest.name, plugin);
    this.executionEngine.registerPlugin(plugin);
    this.planGenerator.registerPlugin(manifest);
  }

  unregisterPlugin(pluginName: string): boolean {
    return this.plugins.delete(pluginName);
  }

  getRegisteredPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((plugin) =>
      plugin.getManifest(),
    );
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const uptime = Date.now() - this.systemMetrics.startTime;
    const componentStatuses = await this.checkComponentHealth();

    const overallStatus = componentStatuses.every((c) => c.status === "online")
      ? "healthy"
      : componentStatuses.some((c) => c.status === "error")
        ? "unhealthy"
        : "degraded";

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      uptime,
      components: componentStatuses,
      metrics: {
        activeQueries: this.systemMetrics.activeQueries,
        completedQueries: this.systemMetrics.completedQueries,
        averageProcessingTime:
          this.systemMetrics.completedQueries > 0
            ? this.systemMetrics.totalProcessingTime /
              this.systemMetrics.completedQueries
            : 0,
        errorRate:
          this.systemMetrics.completedQueries > 0
            ? this.systemMetrics.errorCount /
              this.systemMetrics.completedQueries
            : 0,
        throughput: this.calculateThroughput(),
        resourceUsage: {
          cpu: 0, // Would be implemented with actual resource monitoring
          memory: 0,
          storage: 0,
          network: 0,
        },
      },
    };
  }

  getActiveExecutions(): string[] {
    return this.executionEngine.getActiveExecutions();
  }

  async cancelResearch(planId: string): Promise<boolean> {
    return await this.executionEngine.cancelExecution(planId);
  }

  private validateQuery(query: ResearchQuery): void {
    if (!query.query?.trim()) {
      throw {
        code: "INVALID_QUERY",
        message: "Query text is required and cannot be empty",
        retryable: false,
      } as ResearchError;
    }

    if (
      query.parameters.sources.maxSources < 1 ||
      query.parameters.sources.maxSources > 50
    ) {
      throw {
        code: "INVALID_SOURCE_LIMIT",
        message: "Maximum sources must be between 1 and 50",
        retryable: false,
      } as ResearchError;
    }

    if (query.parameters.sources.sourceTypes.length === 0) {
      throw {
        code: "INVALID_SOURCE_TYPES",
        message: "At least one source type must be specified",
        retryable: false,
      } as ResearchError;
    }

    if (query.metadata.timeout < 30000 || query.metadata.timeout > 1800000) {
      // 30s to 30min
      throw {
        code: "INVALID_TIMEOUT",
        message: "Timeout must be between 30 seconds and 30 minutes",
        retryable: false,
      } as ResearchError;
    }
  }

  private async generateReport(
    query: ResearchQuery,
    executionPlan: any,
    stageResults: Record<string, any>,
    artifacts: any[],
  ): Promise<ResearchReport> {
    const findings = this.extractFindings(stageResults, artifacts);
    const sources = this.extractSources(artifacts);
    const analysis = this.aggregateAnalysis(stageResults);
    const summary = this.generateSummary(findings, analysis, query);

    return {
      id: crypto.randomUUID(),
      query,
      executionPlan,
      findings,
      summary,
      sources,
      analysis,
      metadata: {
        generatedAt: new Date().toISOString(),
        processingTime: executionPlan.estimatedDuration || 0,
        totalSources: sources.length,
        stagesExecuted: Object.keys(stageResults),
        errors: [],
        version: "2.0.0",
      },
    };
  }

  private extractFindings(
    stageResults: Record<string, any>,
    artifacts: any[],
  ): any[] {
    const findings: any[] = [];

    for (const [stageId, result] of Object.entries(stageResults)) {
      if (result.success && result.output) {
        if (Array.isArray(result.output)) {
          findings.push(
            ...result.output.map((item: any, index: number) => ({
              id: `${stageId}_${index}`,
              title: item.title || `Finding from ${stageId}`,
              content: item.content || item.text || JSON.stringify(item),
              confidence: item.confidence || 0.8,
              sources: item.sources || [],
              type: this.inferFindingType(stageId, item),
              significance: item.significance || "medium",
            })),
          );
        } else if (typeof result.output === "object") {
          findings.push({
            id: `${stageId}_primary`,
            title: result.output.title || `Primary finding from ${stageId}`,
            content:
              result.output.content ||
              result.output.summary ||
              JSON.stringify(result.output),
            confidence: result.output.confidence || 0.8,
            sources: result.output.sources || [],
            type: this.inferFindingType(stageId, result.output),
            significance: result.output.significance || "medium",
          });
        }
      }
    }

    return findings;
  }

  private inferFindingType(stageId: string, item: any): string {
    if (stageId.includes("sentiment") || item.sentiment) return "opinion";
    if (stageId.includes("trend") || item.trend) return "trend";
    if (stageId.includes("fact") || item.verified) return "fact";
    if (stageId.includes("entity") || item.entities) return "fact";
    if (item.contradiction || item.conflicting) return "contradiction";
    return "insight";
  }

  private extractSources(artifacts: any[]): any[] {
    const sources: any[] = [];

    for (const artifact of artifacts) {
      if (artifact.type === "raw_data" && artifact.content?.sources) {
        sources.push(
          ...artifact.content.sources.map((source: any) => ({
            id: source.id || crypto.randomUUID(),
            url: source.url,
            title: source.title,
            author: source.author,
            publishedAt: source.publishedAt || source.date,
            credibilityScore: source.credibilityScore || 0.7,
            relevanceScore: source.relevanceScore || 0.8,
            extractedContent: source.content || source.excerpt,
            metadata: {
              type: source.type || "web",
              domain: this.extractDomain(source.url),
              language: source.language || "en",
              wordCount: source.content?.length || 0,
              accessedAt: new Date().toISOString(),
              lastModified: source.lastModified,
            },
          })),
        );
      }
    }

    return this.deduplicateSources(sources);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "unknown";
    }
  }

  private deduplicateSources(sources: any[]): any[] {
    const seen = new Set<string>();
    return sources.filter((source) => {
      const key = source.url || source.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private aggregateAnalysis(stageResults: Record<string, any>): any {
    const analysis: any = {};

    for (const [stageId, result] of Object.entries(stageResults)) {
      if (!result.success || !result.output) continue;

      if (stageId.includes("sentiment") && result.output.sentiment) {
        analysis.sentiment = result.output.sentiment;
      }

      if (stageId.includes("entity") && result.output.entities) {
        analysis.entities = result.output.entities;
      }

      if (stageId.includes("trend") && result.output.trends) {
        analysis.trends = result.output.trends;
      }

      if (stageId.includes("fact") && result.output.factCheck) {
        analysis.factCheck = result.output.factCheck;
      }
    }

    return analysis;
  }

  private generateSummary(
    findings: any[],
    analysis: any,
    query: ResearchQuery,
  ): any {
    const keyFindings = findings
      .filter((f) => f.significance === "high" || f.significance === "critical")
      .slice(0, 5)
      .map((f) => f.title);

    const confidenceScore =
      findings.length > 0
        ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
        : 0;

    return {
      executiveSummary: this.generateExecutiveSummary(
        query,
        findings,
        analysis,
      ),
      keyFindings,
      recommendations: this.generateRecommendations(findings, analysis),
      limitations: this.identifyLimitations(query, findings),
      confidenceScore,
    };
  }

  private generateExecutiveSummary(
    query: ResearchQuery,
    findings: any[],
    analysis: any,
  ): string {
    const sourcesCount = findings.length;
    const hasHighConfidence = findings.some((f) => f.significance === "high");

    let summary = `Research conducted on "${query.query}" yielded ${sourcesCount} significant findings. `;

    if (hasHighConfidence) {
      summary += "High-confidence insights were identified, ";
    }

    if (analysis.sentiment) {
      summary += `with overall sentiment being ${analysis.sentiment.overall?.label || "neutral"}. `;
    }

    if (analysis.trends) {
      summary += "Key trends and patterns were detected in the data. ";
    }

    return summary.trim();
  }

  private generateRecommendations(findings: any[], analysis: any): string[] {
    const recommendations: string[] = [];

    if (findings.some((f) => f.type === "contradiction")) {
      recommendations.push(
        "Further investigation needed to resolve conflicting information",
      );
    }

    if (findings.some((f) => f.confidence < 0.6)) {
      recommendations.push(
        "Additional sources recommended for low-confidence findings",
      );
    }

    if (analysis.trends?.trends?.some((t: any) => t.direction === "rising")) {
      recommendations.push(
        "Monitor emerging trends for potential opportunities",
      );
    }

    return recommendations;
  }

  private identifyLimitations(query: ResearchQuery, findings: any[]): string[] {
    const limitations: string[] = [];

    if (query.parameters.sources.maxSources < 10) {
      limitations.push("Limited source count may affect comprehensiveness");
    }

    if (findings.length === 0) {
      limitations.push("No significant findings identified");
    }

    if (!query.parameters.analysis.enableFactChecking) {
      limitations.push("Fact-checking was not performed");
    }

    return limitations;
  }

  private async checkComponentHealth(): Promise<any[]> {
    const components = [];

    components.push({
      name: "Execution Engine",
      status: "online",
      lastCheck: new Date().toISOString(),
      responseTime: 0,
    });

    components.push({
      name: "Plan Generator",
      status: "online",
      lastCheck: new Date().toISOString(),
      responseTime: 0,
    });

    for (const [name, plugin] of this.plugins) {
      try {
        const startTime = performance.now();
        const status = "online"; // Would ping plugin health endpoint
        const responseTime = performance.now() - startTime;

        components.push({
          name: `Plugin: ${name}`,
          status,
          lastCheck: new Date().toISOString(),
          responseTime,
        });
      } catch (error: any) {
        components.push({
          name: `Plugin: ${name}`,
          status: "error",
          lastCheck: new Date().toISOString(),
          error: error.message,
        });
      }
    }

    return components;
  }

  private updateSuccessMetrics(processingTime: number): void {
    this.systemMetrics.completedQueries++;
    this.systemMetrics.totalProcessingTime += processingTime;
  }

  private updateErrorMetrics(processingTime: number): void {
    this.systemMetrics.completedQueries++;
    this.systemMetrics.totalProcessingTime += processingTime;
    this.systemMetrics.errorCount++;
  }

  private calculateThroughput(): number {
    const uptimeHours =
      (Date.now() - this.systemMetrics.startTime) / (1000 * 60 * 60);
    return uptimeHours > 0
      ? this.systemMetrics.completedQueries / uptimeHours
      : 0;
  }
}

interface OrchestratorOptions {
  maxConcurrentStages?: number;
  defaultTimeout?: number;
}

interface SystemMetrics {
  activeQueries: number;
  completedQueries: number;
  totalProcessingTime: number;
  errorCount: number;
  throughput: number;
  startTime: number;
}
