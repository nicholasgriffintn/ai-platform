import { readTaskView, type TaskView } from "@ngriffin_uk/polychat-component-workspaces";
import { useSearchParams } from "react-router";

export function useTaskViewParam(): [TaskView, (view: TaskView) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const setView = (next: TaskView) => {
    const params = new URLSearchParams(searchParams);

    if (next === "list") {
      params.delete("view");
    } else {
      params.set("view", next);
    }

    setSearchParams(params, { replace: true });
  };

  return [readTaskView(searchParams.get("view")), setView];
}
