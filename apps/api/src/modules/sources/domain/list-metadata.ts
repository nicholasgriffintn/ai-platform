import {
  DISCOVER_COVERAGE_METADATA_KEY,
  KNOWLEDGE_CLASSIFICATION_METADATA_KEY,
  KNOWLEDGE_ENRICHMENTS_METADATA_KEY,
  SOURCE_FRAMING_METADATA_KEY,
  SOURCE_LISTEN_METADATA_KEY,
  SOURCE_SUMMARY_METADATA_KEY,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

const DETAIL_ONLY_KEYS = [
  SOURCE_SUMMARY_METADATA_KEY,
  KNOWLEDGE_ENRICHMENTS_METADATA_KEY,
  KNOWLEDGE_CLASSIFICATION_METADATA_KEY,
  SOURCE_FRAMING_METADATA_KEY,
  DISCOVER_COVERAGE_METADATA_KEY,
];

function listMedia(media: Record<string, unknown>): Record<string, unknown> {
  const { notes: _notes, transcript, ...listed } = media;

  if (!isRecord(transcript)) {
    return listed;
  }

  return {
    ...listed,
    transcript: {
      status: transcript.status,
      ...(transcript.error === undefined ? {} : { error: transcript.error }),
    },
  };
}

export function listSourceMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const listed = { ...metadata };

  for (const key of DETAIL_ONLY_KEYS) {
    delete listed[key];
  }

  if (isRecord(listed.media)) {
    listed.media = listMedia(listed.media);
  }

  const listen = listed[SOURCE_LISTEN_METADATA_KEY];

  if (isRecord(listen)) {
    listed[SOURCE_LISTEN_METADATA_KEY] = { ...listen, passages: [] };
  }

  return listed;
}
