import { AnalyzerPlugin } from "../core/plugin.js";
import type {
  Artifact,
  EntityAnalysis,
  ExecutionContext,
  PluginManifest,
  SentimentAnalysis,
} from "../types/core.js";
import type { NLPContainerResponse, NLPTask } from "../types/plugins/nlp.js";

export class ContainerizedNLPPlugin extends AnalyzerPlugin {
  private nlpContainer: any;

  constructor(nlpContainer: any, config: Record<string, any> = {}) {
    const manifest: PluginManifest = {
      name: "containerized-nlp-analyzer",
      version: "1.0.0",
      description: "NLP analysis using containerized Python agents",
      author: "Research Agent Team",
      type: "analyzer",
      capabilities: [
        {
          name: "sentiment_analysis",
          description: "Analyze sentiment of text content",
          inputTypes: ["text", "content"],
          outputTypes: ["sentiment_results"],
        },
        {
          name: "entity_extraction",
          description: "Extract named entities from text",
          inputTypes: ["text", "content"],
          outputTypes: ["entity_results"],
        },
        {
          name: "text_summarization",
          description: "Generate summaries of long text",
          inputTypes: ["text", "content"],
          outputTypes: ["summary"],
        },
        {
          name: "language_detection",
          description: "Detect language of text content",
          inputTypes: ["text"],
          outputTypes: ["language_info"],
        },
      ],
      dependencies: [
        {
          name: "@cloudflare/containers",
          version: "0.0.12",
          optional: false,
        },
      ],
      configuration: {
        enableSentiment: {
          type: "boolean",
          required: false,
          default: true,
          description: "Enable sentiment analysis",
        },
        enableEntities: {
          type: "boolean",
          required: false,
          default: true,
          description: "Enable entity extraction",
        },
        enableSummarization: {
          type: "boolean",
          required: false,
          default: true,
          description: "Enable text summarization",
        },
        enableLanguageDetection: {
          type: "boolean",
          required: false,
          default: false,
          description: "Enable language detection",
        },
        timeout: {
          type: "number",
          required: false,
          default: 60000,
          description: "Container request timeout in milliseconds",
        },
      },
      endpoints: [
        {
          path: "/analyze",
          method: "POST",
          description: "Analyze text with multiple NLP operations",
          parameters: [
            {
              name: "text",
              type: "string",
              required: true,
              description: "Text to analyze",
            },
            {
              name: "operations",
              type: "array",
              required: true,
              description: "NLP operations to perform",
            },
          ],
          response: {
            type: "object",
            properties: {
              sentiment: { type: "object" },
              entities: { type: "array" },
              summary: { type: "string" },
              language: { type: "object" },
            },
          },
        },
      ],
    };

    super(manifest, config);
    this.nlpContainer = nlpContainer;
  }

  async analyze(
    artifacts: Artifact[],
    context: ExecutionContext,
  ): Promise<any> {
    this.log("info", "Starting containerized NLP analysis", {
      artifactCount: artifacts.length,
      stageId: context.stageId,
    });

    const results = {
      sentiment: null as any,
      entities: null as any,
      summaries: [] as any[],
      languages: [] as any[],
    };

    // Extract text content from artifacts
    const textContent = this.extractTextFromArtifacts(artifacts);

    if (textContent.length === 0) {
      this.log("warn", "No text content found in artifacts");
      return results;
    }

    // Combine all text for analysis
    const combinedText = textContent.join("\n\n");

    // Determine which operations to perform based on configuration
    const operations = this.getOperationsToPerform();

    if (operations.length === 0) {
      this.log("warn", "No NLP operations enabled in configuration");
      return results;
    }

    try {
      // Call the containerized NLP service
      const nlpResult = await this.callNLPContainer({
        text: combinedText,
        operations,
      });

      // Process and structure the results
      if (nlpResult.success && nlpResult.data) {
        results.sentiment = this.processSentimentResults(
          nlpResult.data.sentiment,
        );
        results.entities = this.processEntityResults(nlpResult.data.entities);

        if (nlpResult.data.summary) {
          results.summaries.push({
            text: nlpResult.data.summary,
            source: "combined_content",
            confidence: 0.8,
          });
        }

        if (nlpResult.data.language) {
          results.languages.push(nlpResult.data.language);
        }
      }

      this.log("info", "NLP analysis completed successfully", {
        operationsPerformed: operations,
        hasSentiment: !!results.sentiment,
        entityCount: results.entities?.entities?.length || 0,
        summaryCount: results.summaries.length,
      });
    } catch (error: any) {
      this.log("error", "NLP container analysis failed", {
        error: error.message,
        operations,
      });
      throw this.createError(
        "NLP_ANALYSIS_FAILED",
        `Containerized NLP analysis failed: ${error.message}`,
        true,
      );
    }

    return results;
  }

  private extractTextFromArtifacts(artifacts: Artifact[]): string[] {
    const textContent: string[] = [];

    for (const artifact of artifacts) {
      if (artifact.type === "raw_data" && artifact.content?.sources) {
        // Extract text from source data
        for (const source of artifact.content.sources) {
          if (source.content || source.snippet) {
            textContent.push(source.content || source.snippet);
          }
        }
      } else if (
        artifact.type === "processed_data" &&
        artifact.content?.content
      ) {
        // Extract from processed content
        textContent.push(artifact.content.content);
      } else if (typeof artifact.content === "string") {
        // Direct text content
        textContent.push(artifact.content);
      }
    }

    return textContent.filter((text) => text && text.trim().length > 0);
  }

  private getOperationsToPerform(): string[] {
    const operations: string[] = [];

    if (this.config.enableSentiment) {
      operations.push("sentiment");
    }

    if (this.config.enableEntities) {
      operations.push("entities");
    }

    if (this.config.enableSummarization) {
      operations.push("summarize");
    }

    if (this.config.enableLanguageDetection) {
      operations.push("language");
    }

    return operations;
  }

  private async callNLPContainer(task: NLPTask): Promise<NLPContainerResponse> {
    const startTime = performance.now();

    try {
      this.log("debug", "Calling NLP container", {
        operations: task.operations,
        textLength: task.text.length,
      });

      // Call the containerized NLP service
      const response = await this.nlpContainer.fetch(
        "http://localhost:8080/process",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
          signal: AbortSignal.timeout(this.config.timeout as number),
        },
      );

      if (!response.ok) {
        throw new Error(
          `NLP container responded with status ${response.status}`,
        );
      }

      const result = (await response.json()) as NLPContainerResponse;

      const duration = performance.now() - startTime;
      this.metrics.apiCalls++;
      this.metrics.customMetrics["nlp_container_calls"] =
        (this.metrics.customMetrics["nlp_container_calls"] || 0) + 1;
      this.metrics.customMetrics["nlp_container_total_time"] =
        (this.metrics.customMetrics["nlp_container_total_time"] || 0) +
        duration;

      this.log("debug", "NLP container call completed", {
        duration,
        success: result.success,
      });

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;
      this.metrics.errorCount++;

      this.log("error", "NLP container call failed", {
        duration,
        error: error.message,
      });

      throw error;
    }
  }

  private processSentimentResults(
    sentimentData: any,
  ): SentimentAnalysis | null {
    if (!sentimentData) return null;

    return {
      overall: {
        polarity: sentimentData.score || 0,
        subjectivity: 0.5, // Default since container doesn't provide this
        confidence: sentimentData.confidence || 0.5,
        label: sentimentData.label || "neutral",
      },
      aspects: [], // Could be enhanced to extract aspect-based sentiment
      trends: [], // Could be enhanced for temporal sentiment analysis
    };
  }

  private processEntityResults(entityData: any): EntityAnalysis | null {
    if (!entityData || !Array.isArray(entityData)) return null;

    const entities = entityData.map((entity) => ({
      text: entity.text || "",
      type: this.mapEntityType(entity.label),
      confidence: entity.confidence || 0.5,
      mentions: 1, // Could be enhanced to count mentions
      context: [entity.text], // Could be enhanced with surrounding context
    }));

    return {
      entities,
      relationships: [], // Could be enhanced to extract relationships
      clusters: [], // Could be enhanced to group related entities
    };
  }

  private mapEntityType(label: string): any {
    const typeMapping: Record<string, string> = {
      PERSON: "person",
      ORG: "organization",
      ORGANIZATION: "organization",
      GPE: "location",
      LOCATION: "location",
      EVENT: "event",
      PRODUCT: "product",
      MONEY: "money",
      DATE: "date",
      TIME: "date",
    };

    return typeMapping[label?.toUpperCase()] || "concept";
  }

  // Health check method for the container
  async checkContainerHealth(): Promise<boolean> {
    try {
      const response = await this.nlpContainer.fetch(
        "http://localhost:8080/health",
        {
          method: "GET",
          signal: AbortSignal.timeout(5000), // 5 second timeout for health check
        },
      );

      return response.ok;
    } catch (error: any) {
      this.log("warn", "NLP container health check failed", {
        error: error.message,
      });
      return false;
    }
  }
}
