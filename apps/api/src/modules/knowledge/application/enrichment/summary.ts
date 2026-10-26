import { SOURCE_SUMMARY_METADATA_KEY } from "@ngriffin_uk/polychat-schemas";

import { digestDocument } from "~/modules/documents/application/digest";
import { readSourceSummary } from "~/modules/sources/domain/summary";

import type { KnowledgeEnricher } from "./types";

export const summaryEnricher: KnowledgeEnricher = {
  name: "summary",
  label: "Summary",
  version: 1,
  trigger: "commit",
  setting: "summary",
  metadataKey: SOURCE_SUMMARY_METADATA_KEY,
  appliesTo: (source) => source.kind !== "memory",
  run: async (context, { metadata, text, contentHash }) => {
    const previous = readSourceSummary(metadata);

    if (previous?.contentHash === contentHash) {
      return { status: "done", value: previous };
    }

    const { summary } = await digestDocument({
      env: context.env,
      user: context.requireUser(),
      markdown: text,
    });

    return {
      status: "done",
      value: { ...summary, contentHash, generatedAt: new Date().toISOString() },
    };
  },
};
