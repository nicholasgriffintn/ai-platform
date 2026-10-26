import {
  READING_FORMS,
  readSourceReadAs,
  readSourceReading,
  SOURCE_READING_METADATA_KEY,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { extractValues } from "~/modules/extractions/application/extract";
import { buildReadingRequest } from "~/modules/knowledge/domain/reading";
import {
  isSourceImage,
  isSourcePdf,
  readSourceImageDataUrl,
  readSourcePdfText,
} from "~/modules/sources/application/media/file-material";

import type { KnowledgeEnricher } from "./types";

export const readingEnricher: KnowledgeEnricher = {
  name: "reading",
  label: "Reading",
  version: 1,
  trigger: "request",
  metadataKey: SOURCE_READING_METADATA_KEY,
  readsFile: true,
  appliesTo: (source) =>
    source.kind !== "memory" && source.kind !== "podcast" && source.kind !== "repository",
  variant: (source, metadata) => `${readSourceReadAs(metadata) ?? ""}:${source.storage_key ?? ""}`,
  run: async (context, { source, metadata, text, contentHash }) => {
    const formId = readSourceReadAs(metadata);

    if (!formId) {
      return { status: "skipped" };
    }

    const previous = readSourceReading(metadata);

    if (previous?.contentHash === contentHash) {
      return { status: "done", value: previous };
    }

    const image = isSourceImage(source) ? await readSourceImageDataUrl(context, source) : null;
    const material =
      image || text.trim() || !isSourcePdf(source)
        ? text
        : await readSourcePdfText(context, source);

    if (!image && !material.trim()) {
      throw new AssistantError(
        "There is no text in this file to read",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const response = await extractValues({
      env: context.env,
      user: context.requireUser(),
      request: buildReadingRequest(
        READING_FORMS[formId],
        image ? { image } : { text: material },
        source.created_at.slice(0, 10),
      ),
    });

    return {
      status: "done",
      value: {
        form: formId,
        answers: response.answers,
        text: image || material !== text ? (response.state_text ?? null) : null,
        model: response.model,
        contentHash,
        generatedAt: new Date().toISOString(),
      },
    };
  },
};
