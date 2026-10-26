import type { Source } from "@ngriffin_uk/polychat-schemas";

import { FileDiscussion } from "../FileDiscussion.js";
import { useDocumentDiscussion } from "../useDocumentDiscussion.js";

export function SourceComments({ source }: { source: Source }) {
  const discussion = useDocumentDiscussion({
    subject: { type: "source", id: source.id },
    revision: source.revision,
  });

  return (
    <FileDiscussion
      projectId={source.projectId}
      revision={source.revision}
      documentBody={source.content ?? ""}
      selection={null}
      hasUnsavedChanges={false}
      discussion={discussion}
    />
  );
}
