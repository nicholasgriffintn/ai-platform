import { CanvasPage, ProjectCanvasPage } from "../Apps/Canvas/CanvasPage.js";
import { usePlaceScope } from "./place-scope.js";

export function CanvasPlace() {
  const scope = usePlaceScope();

  return scope.kind === "project" ? <ProjectCanvasPage /> : <CanvasPage />;
}
