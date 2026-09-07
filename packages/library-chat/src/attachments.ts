import type { ChatMessageSelection } from "@ngriffin_uk/polychat-schemas";

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
      type: "selection";
      name: string;
      selection: ChatMessageSelection;
    };
