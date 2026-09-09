import {
  getStringProperty,
  isRecord,
  parseStringArrayValue,
  readOptionalString,
} from "@ngriffin_uk/polychat-utility-core";

export interface WebSearchSource {
  url: string;
  title?: string;
}

export interface WebSearchData {
  answer?: string;
  sources: WebSearchSource[];
  similarQuestions: string[];
  completionId?: string;
  provider?: string;
  providerWarning?: string;
}

function readWebSearchSources(value: unknown): WebSearchSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const url = getStringProperty(entry, "url");

    return url ? [{ url, title: getStringProperty(entry, "title") }] : [];
  });
}

export function readWebSearchData(value: unknown): WebSearchData | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    answer: readOptionalString(value.answer),
    sources: readWebSearchSources(value.sources),
    similarQuestions: parseStringArrayValue(value.similarQuestions),
    completionId: readOptionalString(value.completion_id),
    provider: readOptionalString(value.provider),
    providerWarning: readOptionalString(value.providerWarning),
  };
}
