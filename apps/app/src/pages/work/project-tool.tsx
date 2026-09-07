import { ToolRunner } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Run a tool - Polychat" }];
}

export default function ProjectToolPage() {
  const { workspaceId = "", projectId = "", toolId = "" } = useParams();

  return (
    <ToolRunner
      backPath={`/work/${workspaceId}/projects/${projectId}/teammates`}
      projectId={projectId}
      toolId={toolId}
    />
  );
}
