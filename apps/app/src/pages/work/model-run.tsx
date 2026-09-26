import { TrainingRunView } from "@ngriffin_uk/polychat-component-shell";
import { useParams, useSearchParams } from "react-router";

export function meta() {
  return [{ title: "Training run - Polychat" }];
}

export default function ModelRunPage() {
  const { workspaceId = "", runId = "" } = useParams();
  const [searchParams] = useSearchParams();

  return (
    <TrainingRunView
      workspaceId={workspaceId}
      runId={runId}
      projectId={searchParams.get("projectId") ?? undefined}
    />
  );
}
