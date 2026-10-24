import {
  isWorkOutputKind,
  MemoizedMarkdown,
  Viewer,
  WorkOutputView,
} from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useRunnableTool } from "@ngriffin_uk/polychat-library-react";
import {
  DOCUMENT_OUTPUT_KIND,
  readDocumentBody,
  type SharedOutput,
} from "@ngriffin_uk/polychat-schemas";
import { Download, FileText } from "lucide-react";

import { ResponseRenderer } from "../../Content/ResponseRenderer.js";
import { FileNoPreview } from "./FileNoPreview.js";

function SharedOutputStage({ output, fileUrl }: { output: SharedOutput; fileUrl?: string }) {
  const { data: producingTool } = useRunnableTool(output.capabilityId);
  const documentBody =
    output.kind === DOCUMENT_OUTPUT_KIND ? readDocumentBody(output.content) : null;

  if (documentBody !== null) {
    return (
      <div className="mx-auto prose max-w-3xl p-6 dark:prose-invert">
        <MemoizedMarkdown>{documentBody}</MemoizedMarkdown>
      </div>
    );
  }

  if (isWorkOutputKind(output.kind)) {
    return (
      <div className="p-5">
        <WorkOutputView kind={output.kind} content={output.content} />
      </div>
    );
  }

  if (Object.keys(output.content).length > 0) {
    return (
      <div className="p-5">
        <ResponseRenderer app={producingTool ?? undefined} result={output.content} />
      </div>
    );
  }

  return (
    <FileNoPreview
      name={output.file?.filename ?? output.title}
      detail={output.file?.mimeType}
      downloadUrl={fileUrl}
    />
  );
}

export function SharedOutputViewer({
  output,
  fileUrl,
}: {
  output: SharedOutput;
  fileUrl?: string;
}) {
  return (
    <Viewer
      title={output.title}
      icon={<FileText size={16} />}
      stage={<SharedOutputStage output={output} fileUrl={fileUrl} />}
      actions={
        fileUrl ? (
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={15} />}
            onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}
          >
            {output.file?.filename || "Download"}
          </Button>
        ) : undefined
      }
    />
  );
}
