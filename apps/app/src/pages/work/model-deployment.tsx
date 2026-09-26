import { DeploymentView } from "@ngriffin_uk/polychat-component-shell";
import { useParams, useSearchParams } from "react-router";

export function meta() {
  return [{ title: "Deployment - Polychat" }];
}

export default function ModelDeploymentPage() {
  const { workspaceId = "", deploymentId = "" } = useParams();
  const [searchParams] = useSearchParams();

  return (
    <DeploymentView
      workspaceId={workspaceId}
      deploymentId={deploymentId}
      projectId={searchParams.get("projectId") ?? undefined}
    />
  );
}
