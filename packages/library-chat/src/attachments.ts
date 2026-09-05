interface AttachmentReference {
  sourceId?: string;
}

export type AttachmentData =
  | ({ type: "image"; data: string; name?: string } & AttachmentReference)
  | ({ type: "document"; data: string; name?: string } & AttachmentReference)
  | ({ type: "audio"; data: string; name?: string } & AttachmentReference)
  | ({
      type: "markdown_document";
      data: string;
      name?: string;
      markdown: string;
    } & AttachmentReference)
  | {
      type: "artifact_selection";
      name: string;
      artifact: { identifier: string; type: string; title?: string };
      selectedText: string;
      selectionStart: number;
      selectionEnd: number;
    };
