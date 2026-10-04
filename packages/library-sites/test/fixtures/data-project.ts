import { DEFAULT_SITE_THEME, type SiteProject } from "@ngriffin_uk/polychat-schemas";

export const dataProject: SiteProject = {
  title: "Team checklist",
  theme: DEFAULT_SITE_THEME,
  capabilities: ["content", "forms", "crud"],
  collections: {
    tasks: {
      label: "Tasks",
      fields: {
        title: { type: "string", required: true },
        done: { type: "boolean", required: false },
      },
      maxRecords: 10,
    },
  },
  dataBindings: {
    tasks: { kind: "collection", collectionId: "tasks", pageId: "home", statePath: "/tasks" },
  },
  pages: {
    home: {
      path: "/",
      title: "Tasks",
      root: "page",
      state: { query: "keep me", tasks: [] },
      elements: {
        page: { type: "Page", props: {}, children: ["form", "list"] },
        form: {
          type: "Form",
          props: {
            submitLabel: "Save",
            fields: [{ name: "title", label: "Title", type: "text", required: true }],
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
    },
  },
};
