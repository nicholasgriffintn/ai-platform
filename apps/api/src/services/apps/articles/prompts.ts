import {
  buildArticleAnalysisPrompt,
  buildArticleReportPrompt,
  buildArticleSummaryPrompt,
  buildAssistantMetadataSection,
} from "@ngriffin_uk/polychat-ai-prompts";

import { APP_DESCRIPTION, APP_NAME } from "~/constants/app";
import {
  toAssistantModelMetadata,
  type PromptModelMetadata,
} from "~/services/chat/prompts/model-metadata";

function buildArticlePromptMetadata(metadata: PromptModelMetadata | undefined): string {
  return buildAssistantMetadataSection({
    assistantName: APP_NAME,
    assistantDescription: APP_DESCRIPTION,
    model: toAssistantModelMetadata({
      modelId: metadata?.modelId,
      modelConfig: metadata?.modelConfig,
      fallbackModelId: metadata?.modelId,
    }),
  });
}

export function analyseArticlePrompt(article: string, metadata?: PromptModelMetadata): string {
  return buildArticleAnalysisPrompt({
    metadataSection: buildArticlePromptMetadata(metadata),
    article,
  });
}

export function summariseArticlePrompt(article: string, metadata?: PromptModelMetadata): string {
  return buildArticleSummaryPrompt({
    metadataSection: buildArticlePromptMetadata(metadata),
    article,
  });
}

export function generateArticleReportPrompt(
  articles: string,
  metadata?: PromptModelMetadata,
): string {
  return buildArticleReportPrompt({
    metadataSection: buildArticlePromptMetadata(metadata),
    articles,
  });
}
