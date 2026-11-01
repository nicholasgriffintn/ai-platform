import type { TaskSteps } from "./types.js";

export const inlineTaskSteps: TaskSteps = {
  run: (_name, work) => work(),
  value: (_name, _schema, work) => work(),
};
