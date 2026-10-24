import { ArtifactDocumentEditor } from "@ngriffin_uk/polychat-component-content";
import { useFormatDocument, useSaveDocumentRevision } from "@ngriffin_uk/polychat-library-react";
import { readDocumentMetadata, type Output } from "@ngriffin_uk/polychat-schemas";

export function DocumentOutputWorkbench({
  output,
  body,
  canEdit,
}: {
  output: Output;
  body: string;
  canEdit: boolean;
}) {
  const save = useSaveDocumentRevision();
  const format = useFormatDocument();

  return (
    <div className="h-full overflow-hidden">
      <ArtifactDocumentEditor
        artifact={{
          identifier: output.id,
          type: "text/markdown",
          language: "markdown",
          title: output.title,
          content: body,
        }}
        sourceRevision={output.revision}
        embedded
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
                });
              }
            : undefined
        }
        isRewriting={format.isPending}
        rewriteErrorMessage={format.error?.message}
        onRewrite={canEdit ? () => format.mutateAsync({ outputId: output.id }) : undefined}
      />
    </div>
  );
}
