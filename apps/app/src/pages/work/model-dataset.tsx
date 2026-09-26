import { DatasetView } from "@ngriffin_uk/polychat-component-shell";
import { useParams, useSearchParams } from "react-router";

export function meta() {
  return [{ title: "Dataset - Polychat" }];
}

export default function ModelDatasetPage() {
  const { workspaceId = "", versionId = "" } = useParams();
  const [searchParams] = useSearchParams();

  return (
    <DatasetView
      workspaceId={workspaceId}
      versionId={versionId}
      projectId={searchParams.get("projectId") ?? undefined}
    />
  );
}
