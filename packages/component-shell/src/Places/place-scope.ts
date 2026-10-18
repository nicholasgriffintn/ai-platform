import { getPlacePaths, getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export type PlaceScope =
  | { kind: "personal" }
  | { kind: "project"; workspaceId: string; projectId: string };

export interface PlacePaths {
  teammates: string;
  plugins: string;
  files: string;
}

export function usePlaceScope(): PlaceScope {
  const { workspaceId, projectId } = useParams<"workspaceId" | "projectId">();

  return workspaceId && projectId
    ? { kind: "project", workspaceId, projectId }
    : { kind: "personal" };
}

export function getPlaceScopePaths(scope: PlaceScope): PlacePaths {
  if (scope.kind === "personal") {
    const paths = getPlacePaths("chat");

    return { teammates: paths.teammates, plugins: paths.plugins, files: paths.files };
  }

  const base = getProjectBasePath(scope.workspaceId, scope.projectId);

  return { teammates: `${base}/teammates`, plugins: `${base}/plugins`, files: `${base}/files` };
}
