import { PageShell } from "@ngriffin_uk/polychat-component-shell";
import type { ReactNode } from "react";

import { ProjectHomeTabs } from "./ProjectHomeTabs";
import { useWorkData } from "./WorkDataContext";

export function ProjectHomeHeader({
  workspaceId,
  projectId,
  actions,
}: {
  workspaceId: string;
  projectId: string;
  actions?: ReactNode;
}) {
  const { projectQuery } = useWorkData();
  const project = projectQuery.data;

  return (
    <>
      <PageShell.Header title={project?.name ?? "Project"} actionContent={actions} />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        {project?.description || "No project description"}
      </p>
      <ProjectHomeTabs workspaceId={workspaceId} projectId={projectId} />
    </>
  );
}
