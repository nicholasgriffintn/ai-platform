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
    general_knowledge: new KeywordFilter(KeywordFilter.getAllGeneralKeywords()),
    creative: new KeywordFilter(KeywordFilter.getAllCreativeKeywords()),
    reasoning: new KeywordFilter(KeywordFilter.getAllReasoningKeywords()),
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
      response_format: { type: "json_object" },
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

    return `You are an AI assistant analyzing a user prompt. Respond ONLY with a valid JSON object matching the following structure:
{
  "expectedComplexity": number, // 1-5 indicating task complexity
  "requiredCapabilities": string[], // array of required model capabilities
  "estimatedInputTokens": number, // estimated number of input tokens
  "estimatedOutputTokens": number, // estimated number of output tokens
  "needsFunctions": boolean, // true if the task requires function calling based on available tools that is not available its capabilities: ${JSON.stringify(availableFunctions)}
  "benefitsFromMultipleModels": boolean, // true if the task would benefit from multiple AI models' perspectives
  "modelComparisonReason": string // brief explanation of why multiple models would be beneficial, if applicable
}

Only choose requiredCapabilities that are available in this list: ${JSON.stringify(availableCapabilities)}.

Base your analysis on the prompt and these categorized keywords: ${JSON.stringify(categorizedKeywords, null, 2)}. 

For the "benefitsFromMultipleModels" field, consider:
1. Does the request ask for multiple perspectives or comparative analysis?
2. Is this a general knowledge question that might benefit from different model strengths?
3. Would creative questions benefit from seeing different model outputs?
4. For complex reasoning tasks, would having a second opinion be valuable?

If you determine multiple models would be beneficial, provide a brief reason in "modelComparisonReason".

Ensure the output is nothing but the JSON object itself.`;
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

    let cleanedContent = content.trim();

    // Remove outer code block markers if present (```json ... ```)
    cleanedContent = cleanedContent
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```$/g, "");

    // Remove any remaining backticks that might be inside the content
    cleanedContent = cleanedContent.replace(/`/g, "");

    let requirementsAnalysis: Partial<PromptRequirements>;

    try {
      // Parse the cleaned content
      requirementsAnalysis = JSON.parse(cleanedContent);
    } catch (error) {
      console.error(
        "Failed to parse JSON response:",
        error,
        "Original Content:",
        content,
        "Cleaned Content:",
        cleanedContent,
      );

      // Try to extract valid JSON using regex as a fallback
      try {
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          requirementsAnalysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not extract valid JSON");
        }
      } catch (fallbackError) {
        // If all attempts fail, throw the original error
        throw new AssistantError(
          "Invalid JSON response from AI analysis",
          ErrorType.PROVIDER_ERROR,
        );
      }
    }

    if (
      typeof requirementsAnalysis.expectedComplexity !== "number" ||
      !Array.isArray(requirementsAnalysis.requiredCapabilities)
    ) {
      console.error(
        "Incomplete or invalid AI analysis structure:",
        requirementsAnalysis,
      );
      throw new AssistantError(
        "Incomplete or invalid AI analysis structure",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return PromptAnalyzer.normalizeRequirements(requirementsAnalysis);
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
      benefitsFromMultipleModels: !!analysis.benefitsFromMultipleModels,
      modelComparisonReason: analysis.modelComparisonReason || "",
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
}
