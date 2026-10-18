import { useParams } from "react-router";

import { ToolRunner } from "../Capabilities/ToolRunner.js";
import { getPlaceScopePaths, usePlaceScope } from "./place-scope.js";

export function ToolPlace() {
  const scope = usePlaceScope();
  const { toolId = "" } = useParams();
  const { plugins } = getPlaceScopePaths(scope);

  return (
    <ToolRunner
      backPath={plugins}
      toolId={toolId}
      {...(scope.kind === "project" ? { projectId: scope.projectId } : {})}
    />
  );
}
