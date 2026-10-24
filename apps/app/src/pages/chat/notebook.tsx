import { NotebookPage } from "@ngriffin_uk/polychat-component-shell";
import { PERSONAL_SURFACE } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Notebook - Polychat" }];
}

export default function ChatNotebookRoute() {
  const { notebookId = "", conversationId } = useParams();

  return (
    <NotebookPage
      key={notebookId}
      surface={PERSONAL_SURFACE}
      notebookId={notebookId}
      conversationId={conversationId}
    />
  );
}
