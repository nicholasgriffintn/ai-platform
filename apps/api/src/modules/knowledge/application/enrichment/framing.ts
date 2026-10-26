import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  articleFramingDraftSchema,
  readSourceFraming,
  SOURCE_FRAMING_METADATA_KEY,
  type ArticleFramingDraft,
  type ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  gradeEditorialQuality,
  type EditorialQualityResult,
} from "~/modules/documents/application/editorial-quality";
import { verifyQuotes } from "~/modules/knowledge/domain/quotes";
import { generateTierObject } from "~/modules/models/application/tier-object";

import type { KnowledgeEnricher } from "./types";

const FRAMING_TIER: ModelTier = "medium";

export interface ArticleFramingResult {
  framing: ArticleFramingDraft;
  missingQuotes: string[];
  editorial: EditorialQualityResult | null;
}

export async function analyseArticleFraming(
  context: ServiceContext,
  article: string,
): Promise<ArticleFramingResult> {
  const [draft, editorial] = await Promise.all([
    generateTierObject(context, {
      tier: FRAMING_TIER,
      name: "article_framing",
      schema: articleFramingDraftSchema,
      system: getPromptText("knowledge/framing"),
      material: article,
    }),
    gradeEditorialQuality({
      env: context.env,
      user: context.requireUser(),
      completionId: `article_framing_${generateId()}`,
      text: article,
    }),
  ]);
  const { missingQuotes } = verifyQuotes(
    article,
    draft.loadedLanguage.map((item) => item.quote),
  );

  return {
    framing: {
      ...draft,
      loadedLanguage: draft.loadedLanguage.filter((item) => !missingQuotes.includes(item.quote)),
    },
    missingQuotes,
    editorial,
  };
}

export const framingEnricher: KnowledgeEnricher = {
  name: "framing",
  label: "Framing",
  version: 1,
  trigger: "request",
  metadataKey: SOURCE_FRAMING_METADATA_KEY,
  appliesTo: (source) => source.kind === "url" || source.kind === "text",
  run: async (context, { metadata, text, contentHash }) => {
    const previous = readSourceFraming(metadata);

    if (previous?.contentHash === contentHash) {
      return { status: "done", value: previous };
    }

    const { framing, editorial } = await analyseArticleFraming(context, text);

    return {
      status: "done",
      value: {
        ...framing,
        ...(editorial ? { grade: editorial.grade } : {}),
        contentHash,
        generatedAt: new Date().toISOString(),
      },
    };
  },
};
