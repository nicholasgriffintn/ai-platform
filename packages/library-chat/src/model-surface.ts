import type { ModelSurface } from "@ngriffin_uk/polychat-schemas";

let surface: ModelSurface = "web";

export function setModelSurface(next: ModelSurface): void {
  surface = next;
}

export function modelSurface(): ModelSurface {
  return surface;
}
