import type { ProjectKnowledgeSearchResponse } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { searchProjectKnowledge } from "~/modules/sources/application/knowledge/search";

const OWN_SOURCE_PASSAGES = 5;
const OWN_SOURCE_QUERY_CHARS = 1_000;
const OWN_SOURCE_EXCERPT_CHARS = 600;

export type OwnSourcePassage = ProjectKnowledgeSearchResponse["data"][number];

export interface OwnSourceGrounding {
  query: string;
  documents: OwnSourcePassage[];
  error?: string;
}

export async function findOwnSources(
  context: ServiceContext,
  brief: string,
  projectId: string | undefined,
): Promise<OwnSourceGrounding> {
  const query = brief.trim().slice(0, OWN_SOURCE_QUERY_CHARS);

  try {
    const response = await searchProjectKnowledge(context, {
      query,
      top_k: OWN_SOURCE_PASSAGES,
      ...(projectId ? { projectId } : {}),
    });

    return { query, documents: response.data };
  } catch (error) {
    return {
      query,
      documents: [],
      error: getErrorMessage(error, "Your Sources could not be searched"),
    };
  }
}

export function describeOwnSources(grounding: OwnSourceGrounding): string {
  if (grounding.error) {
    return `Your Sources could not be searched: ${grounding.error}`;
  }

  if (grounding.documents.length === 0) {
    return "Nothing in your Sources matched this brief.";
  }

  return [
    "From your Sources (cite these by title alongside the web findings):",
    ...grounding.documents.map(
      (document, index) =>
        `[S${index + 1}] ${document.title}: ${document.content.replace(/\s+/g, " ").slice(0, OWN_SOURCE_EXCERPT_CHARS)}`,
    ),
  ].join("\n");
}
