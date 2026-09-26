export const MODEL_PLACES = [
  "overview",
  "library",
  "datasets",
  "training",
  "deployments",
  "evaluations",
  "governance",
] as const;

export type ModelPlace = (typeof MODEL_PLACES)[number];

export type ModelObjectKind = "versions" | "datasets" | "runs" | "deployments" | "aliases";

export function isModelPlace(value: string | undefined): value is ModelPlace {
  return MODEL_PLACES.some((place) => place === value);
}

export function modelsPath(
  workspaceId: string,
  projectId?: string,
  place: ModelPlace = "overview",
): string {
  const base = projectId
    ? `/work/${workspaceId}/projects/${projectId}/models`
    : `/work/${workspaceId}/models`;

  return place === "overview" ? base : `${base}/${place}`;
}

export function modelObjectPath(
  workspaceId: string,
  kind: ModelObjectKind,
  id: string,
  projectId?: string,
): string {
  const base = `/work/${workspaceId}/models/${kind}/${encodeURIComponent(id)}`;

  return projectId ? `${base}?projectId=${encodeURIComponent(projectId)}` : base;
}

export function modelVersionPath(
  workspaceId: string,
  versionId: string,
  projectId?: string,
): string {
  return modelObjectPath(workspaceId, "versions", versionId, projectId);
}
