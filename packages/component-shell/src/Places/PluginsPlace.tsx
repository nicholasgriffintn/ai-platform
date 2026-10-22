import { PluginsPage } from "../Plugins/PluginsPage.js";
import { ProjectPluginsPage } from "../Plugins/ProjectPluginsPage.js";
import { usePlaceScope } from "./place-scope.js";

export function PluginsPlace() {
  const scope = usePlaceScope();

  return scope.kind === "project" ? (
    <ProjectPluginsPage workspaceId={scope.workspaceId} projectId={scope.projectId} />
  ) : (
    <PluginsPage />
  );
}
