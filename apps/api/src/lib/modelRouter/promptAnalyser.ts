import type { AIProvider } from "../../providers/base";
import { AIProviderFactory } from "../../providers/factory";
import { availableFunctions } from "../../services/functions";
import type {
  Attachment,
  ChatRole,
  IEnv,
  IUser,
  PromptRequirements,
} from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import { KeywordFilter } from "../keywords";
import { availableCapabilities } from "../models";

// biome-ignore lint/complexity/noStaticOnlyClass: I don't care
export class PromptAnalyzer {
  private static readonly DEFAULT_PROVIDER = "groq";
  private static readonly DEFAULT_MODEL = "llama-3.3-70b-versatile";

  private static readonly FILTERS = {
    coding: new KeywordFilter(KeywordFilter.getAllCodingKeywords()),
    math: new KeywordFilter(KeywordFilter.getAllMathKeywords()),
  };

  private static async analyzeWithAI(
    env: IEnv,
    prompt: string,
    keywords: string[],
    user: IUser,
  ): Promise<PromptRequirements> {
    try {
      const provider = AIProviderFactory.getProvider(
        PromptAnalyzer.DEFAULT_PROVIDER,
      );
      const analysisResponse = await PromptAnalyzer.performAIAnalysis(
        provider,
        env,
        prompt,
        keywords,
        user,
      );
      return PromptAnalyzer.validateAndParseAnalysis(analysisResponse);
    } catch (error) {
      throw new AssistantError(
        `Prompt analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorType.UNKNOWN_ERROR,
      );
    }
  }

  private static performAIAnalysis(
    provider: AIProvider,
    env: IEnv,
    prompt: string,
    keywords: string[],
    user: IUser,
  ) {
    return provider.getResponse({
      env,
      model: PromptAnalyzer.DEFAULT_MODEL,
      disable_functions: true,
      messages: [
        {
          role: "system" as ChatRole,
          content: PromptAnalyzer.constructsystem_prompt(keywords),
        },
        { role: "user", content: prompt },
      ],
      user,
    });
  }

  private static constructsystem_prompt(keywords: string[]): string {
    const categorizedKeywords = keywords.reduce(
      (acc, keyword) => {
        for (const [domain, filter] of Object.entries(PromptAnalyzer.FILTERS)) {
          const categories = filter.getCategorizedMatches(keyword);
          if (Object.keys(categories).length > 0) {
            acc[domain] = acc[domain] || {};
            for (const [category, words] of Object.entries(categories)) {
              acc[domain][category] = [
                ...(acc[domain][category] || []),
                ...words,
              ];
            }
          }
        }
        return acc;
      },
      {} as Record<string, Record<string, string[]>>,
    );

    return `Analyze the given prompt and return a JSON object with the following properties:
      - expectedComplexity: number 1-5 indicating task complexity
      - requiredCapabilities: array of required model capabilities from ${JSON.stringify(availableCapabilities, null, 2)}
      - estimatedInputTokens: estimated number of input tokens
      - estimatedOutputTokens: estimated number of output tokens
      - needsFunctions: boolean indicating if the task requires function calling based on the available tools: ${JSON.stringify(
        availableFunctions,
        null,
        2,
      )}
      
      Base the analysis on these categorized keywords: ${JSON.stringify(categorizedKeywords, null, 2)}`;
  }

  private static validateAndParseAnalysis(analysisResponse: {
    choices: {
      message: {
        content: string;
      };
    }[];
  }): PromptRequirements {
    if (!analysisResponse?.choices?.length) {
      throw new AssistantError(
        "No valid AI response received",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const content = analysisResponse.choices[0].message.content;
    const requirementsAnalysis = PromptAnalyzer.parseAnalysisContent(content);

    if (
      !requirementsAnalysis.expectedComplexity ||
      !requirementsAnalysis.requiredCapabilities
    ) {
      throw new AssistantError(
        "Incomplete or invalid AI analysis",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return PromptAnalyzer.normalizeRequirements(requirementsAnalysis);
  }

  private static parseAnalysisContent(
    content: string,
  ): Partial<PromptRequirements> {
    let jsonString: string | null = null;

    const markdownMatch = content.match(/```json\\s*(\\{[\\s\\S]+?\\})\\s*```/);
    if (markdownMatch?.[1]) {
      jsonString = markdownMatch[1];
    } else {
      const firstBraceIndex = content.indexOf("{");
      if (firstBraceIndex !== -1) {
        let braceCount = 0;
        let lastBraceIndex = -1;
        for (let i = firstBraceIndex; i < content.length; i++) {
          if (content[i] === "{") {
            braceCount++;
          } else if (content[i] === "}") {
            braceCount--;
            if (braceCount === 0) {
              lastBraceIndex = i;
              break;
            }
          }
        }

        if (lastBraceIndex !== -1) {
          const potentialJson = content.substring(
            firstBraceIndex,
            lastBraceIndex + 1,
          );
          try {
            JSON.parse(potentialJson);
            jsonString = potentialJson;
          } catch (e) {
            console.warn(
              "Potential JSON block failed validation:",
              potentialJson,
              e,
            );
          }
        }
      }
    }

    if (jsonString) {
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        console.error(
          "Failed to parse extracted JSON:",
          error,
          "JSON String:",
          jsonString,
          "Original content:",
          content,
        );
      }
    }

    console.warn("Falling back to markdown parsing for content:", content);
    return PromptAnalyzer.parseMarkdownResponse(content);
  }

  private static normalizeRequirements(
    analysis: Partial<PromptRequirements>,
  ): PromptRequirements {
    return {
      expectedComplexity: Math.max(
        1,
        Math.min(5, analysis.expectedComplexity || 1),
      ) as 1 | 2 | 3 | 4 | 5,
      requiredCapabilities: analysis.requiredCapabilities || [],
      estimatedInputTokens: Math.max(0, analysis.estimatedInputTokens || 0),
      estimatedOutputTokens: Math.max(0, analysis.estimatedOutputTokens || 0),
      needsFunctions: !!analysis.needsFunctions,
      hasImages: false,
      hasDocuments: false,
    };
  }

  private static extractKeywords(prompt: string): string[] {
    const categorizedMatches = Object.entries(PromptAnalyzer.FILTERS).reduce(
      (acc, [domain, filter]) => {
        const matches = filter.getCategorizedMatches(prompt);
        for (const [key, value] of Object.entries(matches)) {
          acc[key] = [...(acc[key] || []), ...value];
        }
        return acc;
      },
      {} as Record<string, string[]>,
    );

    const allMatches = Object.values(categorizedMatches).flat();
    if (allMatches.length > 0) {
      return [...new Set(allMatches)];
    }

    return PromptAnalyzer.fallbackKeywordExtraction(prompt);
  }

  private static fallbackKeywordExtraction(prompt: string): string[] {
    const words = prompt
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter((word) => word.length > 2);

    const matches = words.filter(
      (word) =>
        PromptAnalyzer.FILTERS.coding.hasKeywords(word) ||
        PromptAnalyzer.FILTERS.math.hasKeywords(word),
    );

    return [...new Set(matches)].slice(0, 5);
  }

  public static async analyzePrompt(
    env: IEnv,
    prompt: string,
    attachments?: Attachment[],
    budget_constraint?: number,
    user?: IUser,
  ): Promise<PromptRequirements> {
    const keywords = PromptAnalyzer.extractKeywords(prompt);
    const aiAnalysis = await PromptAnalyzer.analyzeWithAI(
      env,
      prompt,
      keywords,
      user,
    );

    return {
      ...aiAnalysis,
      budget_constraint,
      hasImages: !!attachments?.some((a) => a.type === "image"),
      hasDocuments: !!attachments?.some((a) => a.type === "document"),
    };
  }

  private static parseMarkdownResponse(
    content: string,
  ): Partial<PromptRequirements> {
    const requirements: Partial<PromptRequirements> = {};

    const complexityMatch = content.match(
      /\*\*expectedComplexity\*\*:\s*(\d+)/i,
    );
    if (complexityMatch) {
      const complexity = Number.parseInt(complexityMatch[1]);
      if (complexity >= 1 && complexity <= 5) {
        requirements.expectedComplexity = complexity as 1 | 2 | 3 | 4 | 5;
      }
    }

    const capabilitiesMatch = content.match(
      /\*\*requiredCapabilities\*\*:\s*\[(.*?)\]/i,
    );
    if (capabilitiesMatch) {
      type Capability = (typeof availableCapabilities)[number];

      const capabilities = capabilitiesMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/["\s]/g, ""))
        .filter((cap): cap is Capability =>
          availableCapabilities.includes(cap as Capability),
        );
      requirements.requiredCapabilities = capabilities;
    }

    const inputTokensMatch = content.match(
      /\*\*estimatedInputTokens\*\*:\s*(\d+)/i,
    );
    if (inputTokensMatch) {
      requirements.estimatedInputTokens = Number.parseInt(inputTokensMatch[1]);
    }

    const outputTokensMatch = content.match(
      /\*\*estimatedOutputTokens\*\*:\s*(\d+)/i,
    );
    if (outputTokensMatch) {
      requirements.estimatedOutputTokens = Number.parseInt(
        outputTokensMatch[1],
      );
    }

    const needsFunctionsMatch = content.match(
      /\*\*needsFunctions\*\*:\s*(true|false)/i,
    );
    if (needsFunctionsMatch) {
      requirements.needsFunctions =
        needsFunctionsMatch[1].toLowerCase() === "true";
    }

    return requirements;
  }
}
