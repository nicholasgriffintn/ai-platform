import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  articleFramingDraftSchema,
  type ArticleFramingDraft,
  type ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  gradeEditorialQuality,
  type EditorialQualityResult,
} from "~/modules/documents/application/editorial-quality";
import { verifyQuotes } from "~/modules/experiences/application/articles/verify";
import { generateTierObject } from "~/modules/models/application/tier-object";

export const ARTICLE_FRAMING_TIER: ModelTier = "medium";

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
      tier: ARTICLE_FRAMING_TIER,
      name: "article_framing",
      schema: articleFramingDraftSchema,
      system: getPromptText("apps/articles/framing"),
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
