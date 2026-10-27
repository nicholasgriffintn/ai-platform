import { readTaskView, type TaskView } from "@ngriffin_uk/polychat-component-workspaces";

import { useViewParam } from "./useViewParam.js";

export function useTaskViewParam(): [TaskView, (view: TaskView) => void] {
  return useViewParam(readTaskView, "list");
}
