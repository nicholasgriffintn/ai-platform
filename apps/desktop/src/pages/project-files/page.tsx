import { FilesPage, ProjectHomeHeader } from "@ngriffin_uk/polychat-component-shell";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopProjectFilesPage() {
  const { workspaceId = "", projectId = "", "*": subpath = "" } = useParams();

  return (
    <FilesPage
      basePath={`${getProjectBasePath(workspaceId, projectId)}/files`}
      projectId={projectId}
      subpath={subpath}
      header={<ProjectHomeHeader workspaceId={workspaceId} projectId={projectId} />}
    />
  );
}
