import type {
  ExecutionPlan,
  ExecutionStage,
  PlanTemplate,
  PluginManifest,
  ResearchQuery,
  RetryPolicy,
  StageConditions,
  StageTemplate,
  StageType,
} from "../types/index.js";

export class PlanGenerator {
  private plugins: Map<string, PluginManifest> = new Map();
  private templates: Map<string, PlanTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  registerPlugin(manifest: PluginManifest): void {
    this.plugins.set(manifest.name, manifest);
  }

  async generatePlan(query: ResearchQuery): Promise<ExecutionPlan> {
    const planId = crypto.randomUUID();

    const template = this.selectTemplate(query);
    const stages = await this.generateStages(query, template);
    const dependencies = this.calculateDependencies(stages, template);
    const estimatedDuration = this.estimateDuration(stages);

    return {
      id: planId,
      query,
      stages,
      dependencies,
      estimatedDuration,
      createdAt: new Date().toISOString(),
    };
  }

  private selectTemplate(query: ResearchQuery): PlanTemplate {
    const depth = query.parameters.depth;
    const analysisConfig = query.parameters.analysis;

    if (depth === "deep" && analysisConfig.enableFactChecking) {
      return this.templates.get("comprehensive")!;
    }
    if (depth === "medium" && analysisConfig.enableTrends) {
      return this.templates.get("analytical")!;
    }
    if (depth === "shallow") {
      return this.templates.get("basic")!;
    }

    return this.templates.get("standard")!;
  }

  private async generateStages(
    query: ResearchQuery,
    template: PlanTemplate,
  ): Promise<ExecutionStage[]> {
    const stages: ExecutionStage[] = [];

    for (const stageTemplate of template.stageTemplates) {
      const stage = await this.createStage(stageTemplate, query, template);
      if (stage) {
        stages.push(stage);
      }
    }

    return stages;
  }

  private async createStage(
    stageTemplate: StageTemplate,
    query: ResearchQuery,
    planTemplate: PlanTemplate,
  ): Promise<ExecutionStage | null> {
    if (!this.shouldIncludeStage(stageTemplate, query)) {
      return null;
    }

    const plugin = this.selectPlugin(
      stageTemplate.type,
      stageTemplate.pluginHints,
    );
    if (!plugin) {
      return null;
    }

    const config = this.generateStageConfig(stageTemplate, query);

    return {
      id: `${stageTemplate.type}_${crypto.randomUUID().slice(0, 8)}`,
      name: stageTemplate.name,
      type: stageTemplate.type,
      plugin: plugin.name,
      config,
      dependencies: [], // Will be calculated later
      timeout: stageTemplate.timeout || 60000,
      retryPolicy: stageTemplate.retryPolicy || this.getDefaultRetryPolicy(),
    };
  }

  private shouldIncludeStage(
    stageTemplate: StageTemplate,
    query: ResearchQuery,
  ): boolean {
    const conditions = stageTemplate.conditions;
    if (!conditions) return true;

    const analysisConfig = query.parameters.analysis;
    const sourceConfig = query.parameters.sources;

    if (conditions.requiresSentiment && !analysisConfig.enableSentiment) {
      return false;
    }

    if (conditions.requiresEntities && !analysisConfig.enableEntities) {
      return false;
    }

    if (conditions.requiresFactCheck && !analysisConfig.enableFactChecking) {
      return false;
    }

    if (conditions.requiresTrends && !analysisConfig.enableTrends) {
      return false;
    }

    if (
      conditions.minSources &&
      sourceConfig.maxSources < conditions.minSources
    ) {
      return false;
    }

    if (conditions.requiredSourceTypes) {
      const hasRequiredTypes = conditions.requiredSourceTypes.some((type) =>
        sourceConfig.sourceTypes.includes(type),
      );
      if (!hasRequiredTypes) {
        return false;
      }
    }

    return true;
  }

  private selectPlugin(
    stageType: StageType,
    hints: string[] = [],
  ): PluginManifest | null {
    const candidates = Array.from(this.plugins.values()).filter(
      (plugin) => plugin.type === this.mapStageTypeToPluginType(stageType),
    );

    if (candidates.length === 0) {
      return null;
    }

    if (hints.length > 0) {
      const hintedPlugin = candidates.find((plugin) =>
        hints.some((hint) =>
          plugin.name.toLowerCase().includes(hint.toLowerCase()),
        ),
      );
      if (hintedPlugin) {
        return hintedPlugin;
      }
    }

    return candidates[0];
  }

  private mapStageTypeToPluginType(
    stageType: StageType,
  ): PluginManifest["type"] {
    switch (stageType) {
      case "data_collection":
        return "data_collector";
      case "data_processing":
        return "analyzer";
      case "analysis":
        return "analyzer";
      case "synthesis":
        return "synthesizer";
      case "validation":
        return "validator";
      case "formatting":
        return "formatter";
      default:
        return "utility";
    }
  }

  private generateStageConfig(
    stageTemplate: StageTemplate,
    query: ResearchQuery,
  ): Record<string, any> {
    const baseConfig = { ...stageTemplate.defaultConfig };

    if (stageTemplate.type === "data_collection") {
      baseConfig.maxSources = query.parameters.sources.maxSources;
      baseConfig.sourceTypes = query.parameters.sources.sourceTypes;
      baseConfig.query = query.query;

      if (query.parameters.sources.languages) {
        baseConfig.languages = query.parameters.sources.languages;
      }

      if (query.parameters.sources.domains) {
        baseConfig.domains = query.parameters.sources.domains;
      }
    }

    if (stageTemplate.type === "analysis") {
      baseConfig.enableSentiment = query.parameters.analysis.enableSentiment;
      baseConfig.enableEntities = query.parameters.analysis.enableEntities;
      baseConfig.enableSummarization =
        query.parameters.analysis.enableSummarization;
    }

    if (stageTemplate.type === "synthesis") {
      baseConfig.format = query.parameters.output.format;
      baseConfig.includeSourceMaterial =
        query.parameters.output.includeSourceMaterial;
      baseConfig.confidenceThreshold =
        query.parameters.output.confidenceThreshold;

      if (query.parameters.output.maxLength) {
        baseConfig.maxLength = query.parameters.output.maxLength;
      }
    }

    return baseConfig;
  }

  private calculateDependencies(
    stages: ExecutionStage[],
    template: PlanTemplate,
  ): Record<string, string[]> {
    const dependencies: Record<string, string[]> = {};
    const stagesByType = new Map<StageType, ExecutionStage[]>();

    for (const stage of stages) {
      if (!stagesByType.has(stage.type)) {
        stagesByType.set(stage.type, []);
      }
      stagesByType.get(stage.type)!.push(stage);
    }

    for (const stage of stages) {
      const stageDeps: string[] = [];
      const stageTemplate = template.stageTemplates.find(
        (t) => t.type === stage.type,
      );

      if (stageTemplate?.dependsOn) {
        for (const depType of stageTemplate.dependsOn) {
          const depStages = stagesByType.get(depType) || [];
          stageDeps.push(...depStages.map((s) => s.id));
        }
      }

      dependencies[stage.id] = stageDeps;
      stage.dependencies = stageDeps;
    }

    return dependencies;
  }

  private estimateDuration(stages: ExecutionStage[]): number {
    const stageGroups = this.groupStagesByLevel(stages);
    let totalDuration = 0;

    for (const group of stageGroups) {
      const maxGroupDuration = Math.max(...group.map((stage) => stage.timeout));
      totalDuration += maxGroupDuration;
    }

    return totalDuration;
  }

  private groupStagesByLevel(stages: ExecutionStage[]): ExecutionStage[][] {
    const levels: ExecutionStage[][] = [];
    const processed = new Set<string>();

    const addToLevel = (stage: ExecutionStage, level: number): void => {
      if (!levels[level]) {
        levels[level] = [];
      }
      levels[level].push(stage);
      processed.add(stage.id);
    };

    const processStage = (stage: ExecutionStage, level = 0): void => {
      if (processed.has(stage.id)) return;

      const maxDepLevel =
        stage.dependencies.length > 0
          ? Math.max(
              ...stage.dependencies.map((depId) => {
                const depStage = stages.find((s) => s.id === depId);
                return depStage ? this.getStageLevel(depStage, stages) : -1;
              }),
            )
          : -1;

      addToLevel(stage, maxDepLevel + 1);
    };

    for (const stage of stages) {
      processStage(stage);
    }

    return levels.filter((level) => level.length > 0);
  }

  private getStageLevel(
    stage: ExecutionStage,
    allStages: ExecutionStage[],
  ): number {
    if (stage.dependencies.length === 0) {
      return 0;
    }

    return Math.max(
      ...stage.dependencies.map((depId) => {
        const depStage = allStages.find((s) => s.id === depId);
        return depStage ? this.getStageLevel(depStage, allStages) + 1 : 0;
      }),
    );
  }

  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      maxAttempts: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
      retryableErrors: ["TIMEOUT_ERROR", "NETWORK_ERROR", "RATE_LIMIT_ERROR"],
    };
  }

  private initializeDefaultTemplates(): void {
    this.templates.set("basic", {
      name: "Basic Research",
      description: "Simple web search and basic analysis",
      stageTemplates: [
        {
          type: "data_collection",
          name: "Web Search",
          pluginHints: ["web", "search"],
          timeout: 30000,
          defaultConfig: {
            extractContent: true,
          },
        },
        {
          type: "analysis",
          name: "Basic Analysis",
          pluginHints: ["nlp", "text"],
          dependsOn: ["data_collection"],
          timeout: 60000,
          defaultConfig: {},
        },
        {
          type: "synthesis",
          name: "Report Generation",
          pluginHints: ["report", "format"],
          dependsOn: ["analysis"],
          timeout: 30000,
          defaultConfig: {},
        },
      ],
    });

    this.templates.set("standard", {
      name: "Standard Research",
      description: "Comprehensive research with sentiment analysis",
      stageTemplates: [
        {
          type: "data_collection",
          name: "Multi-Source Collection",
          pluginHints: ["web", "search", "news"],
          timeout: 60000,
          defaultConfig: {
            extractContent: true,
            includeMetadata: true,
          },
        },
        {
          type: "data_processing",
          name: "Content Processing",
          pluginHints: ["clean", "process"],
          dependsOn: ["data_collection"],
          timeout: 30000,
          defaultConfig: {},
        },
        {
          type: "analysis",
          name: "NLP Analysis",
          pluginHints: ["nlp", "sentiment"],
          dependsOn: ["data_processing"],
          timeout: 90000,
          defaultConfig: {},
        },
        {
          type: "synthesis",
          name: "Report Synthesis",
          pluginHints: ["report", "synthesis"],
          dependsOn: ["analysis"],
          timeout: 60000,
          defaultConfig: {},
        },
      ],
    });

    this.templates.set("analytical", {
      name: "Analytical Research",
      description: "Deep analysis with trend detection and entity extraction",
      stageTemplates: [
        {
          type: "data_collection",
          name: "Comprehensive Collection",
          pluginHints: ["web", "academic", "news"],
          timeout: 120000,
          defaultConfig: {
            extractContent: true,
            includeMetadata: true,
            historicalData: true,
          },
        },
        {
          type: "data_processing",
          name: "Advanced Processing",
          pluginHints: ["clean", "dedupe", "enhance"],
          dependsOn: ["data_collection"],
          timeout: 60000,
          defaultConfig: {},
        },
        {
          type: "analysis",
          name: "Sentiment Analysis",
          pluginHints: ["sentiment", "emotion"],
          dependsOn: ["data_processing"],
          timeout: 90000,
          conditions: { requiresSentiment: true },
          defaultConfig: {},
        },
        {
          type: "analysis",
          name: "Entity Extraction",
          pluginHints: ["entity", "ner"],
          dependsOn: ["data_processing"],
          timeout: 90000,
          conditions: { requiresEntities: true },
          defaultConfig: {},
        },
        {
          type: "analysis",
          name: "Trend Analysis",
          pluginHints: ["trend", "temporal"],
          dependsOn: ["data_processing"],
          timeout: 120000,
          conditions: { requiresTrends: true },
          defaultConfig: {},
        },
        {
          type: "synthesis",
          name: "Advanced Synthesis",
          pluginHints: ["synthesis", "insight"],
          dependsOn: ["analysis"],
          timeout: 90000,
          defaultConfig: {},
        },
      ],
    });

    this.templates.set("comprehensive", {
      name: "Comprehensive Research",
      description: "Full-scale research with fact-checking and validation",
      stageTemplates: [
        {
          type: "data_collection",
          name: "Multi-Modal Collection",
          pluginHints: ["web", "academic", "patent", "legal"],
          timeout: 180000,
          defaultConfig: {
            extractContent: true,
            includeMetadata: true,
            historicalData: true,
            crossReference: true,
          },
        },
        {
          type: "data_processing",
          name: "Comprehensive Processing",
          pluginHints: ["clean", "dedupe", "enhance", "structure"],
          dependsOn: ["data_collection"],
          timeout: 90000,
          defaultConfig: {},
        },
        {
          type: "analysis",
          name: "Multi-Modal Analysis",
          pluginHints: ["nlp", "sentiment", "entity", "trend"],
          dependsOn: ["data_processing"],
          timeout: 180000,
          defaultConfig: {},
        },
        {
          type: "validation",
          name: "Fact Checking",
          pluginHints: ["fact", "verify", "validate"],
          dependsOn: ["analysis"],
          timeout: 120000,
          conditions: { requiresFactCheck: true },
          defaultConfig: {},
        },
        {
          type: "validation",
          name: "Source Credibility",
          pluginHints: ["credibility", "reputation"],
          dependsOn: ["analysis"],
          timeout: 60000,
          defaultConfig: {},
        },
        {
          type: "synthesis",
          name: "Expert Synthesis",
          pluginHints: ["synthesis", "expert", "comprehensive"],
          dependsOn: ["validation"],
          timeout: 120000,
          defaultConfig: {},
        },
      ],
    });
  }
}
