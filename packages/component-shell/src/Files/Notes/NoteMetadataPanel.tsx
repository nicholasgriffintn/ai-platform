import { DocumentMetadataPanel } from "@ngriffin_uk/polychat-component-content";
import { useKnowledgeDocumentActions, useSourceEditing } from "@ngriffin_uk/polychat-library-react";
import {
  readSourceDocumentMetadata,
  SOURCE_SUMMARY_METADATA_KEY,
  sourceContentSummarySchema,
  type Source,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

import {
  buildNoteMetadata,
  toSourceDocumentMetadata,
  withoutGeneratedFields,
} from "./note-metadata.js";

export function NoteMetadataPanel({
  source,
  text,
  isEditable,
}: {
  source: Source;
  text: string;
  isEditable: boolean;
}) {
  const { save } = useSourceEditing(source.id);
  const { reprocess } = useKnowledgeDocumentActions(source.id);
  const generated = sourceContentSummarySchema.safeParse(
    source.metadata[SOURCE_SUMMARY_METADATA_KEY],
  );

  return (
    <DocumentMetadataPanel
      key={`${source.id}:${source.revision}`}
      metadata={buildNoteMetadata(source, text)}
      isEditable={isEditable}
      canRegenerate={isEditable}
      isRegeneratingMetadata={reprocess.isPending}
      onMetadataUpdate={(edited) => {
        const document = toSourceDocumentMetadata(edited);
        const kept = {
          ...withoutGeneratedFields(document),
          ...(document.summary && document.summary !== generated.data?.summary
            ? { summary: document.summary }
            : {}),
          ...(document.keyTopics &&
          canonicalJson(document.keyTopics) !== canonicalJson(generated.data?.topics ?? [])
            ? { keyTopics: document.keyTopics }
            : {}),
        };

        save.mutate(
          { document: kept },
          { onError: (error) => toast.error(getErrorMessage(error, "The details didn't save")) },
        );
      }}
      onRegenerateMetadata={() =>
        save.mutate(
          { document: withoutGeneratedFields(readSourceDocumentMetadata(source.metadata)) },
          {
            onSuccess: () =>
              reprocess.mutate(undefined, {
                onSuccess: () => toast.success("Reading it again. The summary updates shortly."),
              }),
            onError: (error) => toast.error(getErrorMessage(error, "That didn't start")),
          },
        )
      }
    />
  );
}
