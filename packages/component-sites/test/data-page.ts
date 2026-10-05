import type { SitePage } from "@ngriffin_uk/polychat-schemas";

export const dataPage: SitePage = {
  path: "/",
  title: "Tasks",
  root: "page",
  state: { query: "", tasks: [] },
  elements: {
    page: { type: "Page", props: {}, children: ["query", "list"] },
    query: {
      type: "Input",
      props: { label: "Filter", value: { $bindState: "/query" } },
      children: [],
    },
    list: {
      type: "Table",
      props: {
        columns: [{ key: "title", label: "Task" }],
        rows: { $state: "/tasks" },
      },
      children: [],
    },
  },
};
