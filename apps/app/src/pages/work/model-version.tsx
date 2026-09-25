import { ModelVersionView } from "@ngriffin_uk/polychat-component-shell";
import { useParams, useSearchParams } from "react-router";

export function meta() {
  return [{ title: "Model version - Polychat" }];
}

export default function ModelVersionPage() {
  const { workspaceId = "", versionId = "" } = useParams();
  const [searchParams] = useSearchParams();

  return (
    <ModelVersionView
      workspaceId={workspaceId}
      versionId={versionId}
      projectId={searchParams.get("projectId") ?? undefined}
    />
  );
}
