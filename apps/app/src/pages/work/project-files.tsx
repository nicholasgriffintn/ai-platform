import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

import { FilesPage } from "~/components/Files/FilesPage";
import { ProjectHomeHeader } from "~/components/Work/ProjectHomeHeader";

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
      header={<ProjectHomeHeader workspaceId={workspaceId} projectId={projectId} />}
    />
  );
}
