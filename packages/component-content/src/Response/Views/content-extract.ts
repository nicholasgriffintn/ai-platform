import { type YouTubeVideo, youTubeVideoSchema } from "@ngriffin_uk/polychat-schemas";
import {
  getStringProperty,
  isRecord,
  readOptionalString,
} from "@ngriffin_uk/polychat-utility-core";

export interface ContentExtractFailure {
  url: string;
  error: string;
}

export interface ContentExtractData {
  videos: YouTubeVideo[];
  summary?: string;
  failures: ContentExtractFailure[];
}

function readFailures(extracted: unknown): ContentExtractFailure[] {
  const failures = isRecord(extracted) ? extracted.failed_results : undefined;

  if (!Array.isArray(failures)) {
    return [];
  }

  return failures.flatMap((failure) => {
    const url = getStringProperty(failure, "url");
    const error = getStringProperty(failure, "error");

    return url && error ? [{ url, error }] : [];
  });
}

export function readContentExtractData(value: unknown): ContentExtractData | null {
  if (!isRecord(value)) {
    return null;
  }

  const videos = youTubeVideoSchema.array().safeParse(value.videos ?? []);

  return {
    videos: videos.success ? videos.data : [],
    summary: readOptionalString(value.summary),
    failures: readFailures(value.extracted),
  };
}
