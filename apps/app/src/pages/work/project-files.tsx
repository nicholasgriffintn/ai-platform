import { useParams } from "react-router";

import { FilesPage } from "~/components/Files/FilesPage";
import { ProjectHomeTabs } from "~/components/Work/ProjectHomeTabs";
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
      header={<ProjectHomeTabs workspaceId={workspaceId} projectId={projectId} />}
    />
  );
}
