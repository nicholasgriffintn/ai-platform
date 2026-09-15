import { getProjectSurface } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

import { PageShell } from "../../Shell/PageShell.js";
import { useWorkData } from "../../Work/WorkDataContext.js";
import { AppRoute } from "../AppRoute.js";
import { CanvasStudio } from "./CanvasStudio.js";

const CANVAS_APP_ID = "image-studio";
const CANVAS_TITLE = "Canvas";

export function CanvasPage() {
  return (
    <PageShell.Content className="max-w-7xl">
      <PageShell.Header title={CANVAS_TITLE} />
      <CanvasStudio />
    </PageShell.Content>
  );
}

export function ProjectCanvasPage() {
  const { workspaceId = "", projectId = "" } = useParams<"workspaceId" | "projectId">();
  const { projectQuery } = useWorkData();

  return (
    <AppRoute
      appId={CANVAS_APP_ID}
      surface={getProjectSurface(workspaceId, projectId)}
      title={CANVAS_TITLE}
      project={{
        name: projectQuery.data?.name,
        capabilities: projectQuery.data?.capabilities,
        isLoading: projectQuery.isLoading,
        error: projectQuery.error,
      }}
    />
  );
}
