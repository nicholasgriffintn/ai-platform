import { NotebookPage } from "@ngriffin_uk/polychat-component-shell";
import { getProjectSurface } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project notebook - Polychat" }];
}

export default function ProjectNotebookRoute() {
  const { workspaceId = "", projectId = "", notebookId = "", conversationId } = useParams();

  return (
    <NotebookPage
      key={notebookId}
      surface={getProjectSurface(workspaceId, projectId)}
      notebookId={notebookId}
      conversationId={conversationId}
    />
  );
}
