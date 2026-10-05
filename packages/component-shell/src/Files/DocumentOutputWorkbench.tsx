import { ArtifactDocumentEditor } from "@ngriffin_uk/polychat-component-content";
import { useFormatDocument, useSaveDocumentRevision } from "@ngriffin_uk/polychat-library-react";
import {
  documentExportFilename,
  readDocumentMetadata,
  readDocumentRecordViews,
  type Output,
} from "@ngriffin_uk/polychat-schemas";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";

import { DocumentOutputDiscussion } from "./DocumentOutputDiscussion.js";
import { DocumentRecordViewEditor } from "./DocumentRecordViewEditor.js";
import { RecordOutputWorkbench } from "./RecordOutputWorkbench.js";
import { useDocumentDiscussion } from "./useDocumentDiscussion.js";

export function DocumentOutputWorkbench({ output, body }: { output: Output; body: string }) {
  const save = useSaveDocumentRevision();
  const format = useFormatDocument();
  const discussion = useDocumentDiscussion(output);
  const canEdit =
    !discussion.comments.isError &&
    (discussion.comments.data?.permissions.canEditDocument ?? false);

  return (
    <div className="space-y-4">
      <div className="h-[640px] overflow-hidden rounded-lg border border-border">
        <ArtifactDocumentEditor
          artifact={{
            identifier: output.id,
            type: "text/markdown",
            language: "markdown",
            title: output.title,
            content: body,
          }}
          sourceRevision={output.revision}
          isSaving={save.isPending}
          saveErrorMessage={save.error?.message}
          onSave={
            canEdit
              ? async (nextBody, expectedRevision) => {
                  await save.mutateAsync({
                    outputId: output.id,
                    body: nextBody,
                    expectedRevision,
                    metadata: readDocumentMetadata(output.content) ?? undefined,
                    recordViews: readDocumentRecordViews(output.content),
                  });
                }
              : undefined
          }
          isRewriting={format.isPending}
          rewriteErrorMessage={format.error?.message}
          onRewrite={canEdit ? () => format.mutateAsync({ outputId: output.id }) : undefined}
          onDownload={() =>
            downloadTextFile(documentExportFilename(output.title), body, "text/markdown")
          }
          renderDiscussion={(selection, hasUnsavedChanges) => (
            <div>
              <DocumentOutputDiscussion
                output={output}
                documentBody={body}
                selection={selection}
                hasUnsavedChanges={hasUnsavedChanges}
                discussion={discussion}
              />
              {canEdit ? (
                <div className="p-3">
                  <DocumentRecordViewEditor output={output} hasUnsavedChanges={hasUnsavedChanges} />
                </div>
              ) : null}
            </div>
          )}
        />
      </div>
      {readDocumentRecordViews(output.content).map((view) => (
        <section key={view.id} className="rounded-lg border border-border p-4">
          <RecordOutputWorkbench tableId={view.tableId} view={view} />
        </section>
      ))}
    </div>
  );
}
