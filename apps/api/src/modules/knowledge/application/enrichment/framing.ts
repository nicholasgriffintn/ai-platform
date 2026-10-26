import { SOURCE_FRAMING_METADATA_KEY, readSourceFraming } from "@ngriffin_uk/polychat-schemas";

import { analyseArticleFraming } from "~/modules/experiences/application/articles/framing";

import type { KnowledgeEnricher } from "./types";

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
