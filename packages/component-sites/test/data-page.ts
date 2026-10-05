import type { SitePage } from "@ngriffin_uk/polychat-schemas";

export const dataPage: SitePage = {
  path: "/",
  title: "Tasks",
  root: "page",
  state: { query: "", tasks: [] },
  elements: {
    page: { type: "Page", props: {}, children: ["query", "form", "list"] },
    query: {
      type: "Input",
      props: { label: "Filter", value: { $bindState: "/query" } },
      children: [],
    },
    form: {
      type: "Form",
      props: {
        submitLabel: "Save",
        fields: [
          { name: "title", label: "Title", type: "text" },
          { name: "count", label: "Count", type: "number" },
        ],
      },
      children: [],
      on: {
        submit: {
          action: "createRecord",
          params: { collectionId: "tasks", values: { $form: true } },
        },
      },
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
