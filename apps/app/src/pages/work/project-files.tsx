import { useParams } from "react-router";

import { FilesPage } from "~/components/Files/FilesPage";
import { getProjectBasePath } from "~/lib/conversation-route";

export function meta() {
  return [{ title: "Project files - Polychat" }];
}

export default function ProjectFilesPage() {
  const { workspaceId = "", projectId = "", "*": subpath = "" } = useParams();

  return (
    <FilesPage
      basePath={`${getProjectBasePath(workspaceId, projectId)}/files`}
      projectId={projectId}
      subpath={subpath}
    />
  );
}
