import { DEFAULT_SITE_THEME, type SiteRecord } from "@ngriffin_uk/polychat-schemas";

export const testSite: SiteRecord = {
  id: "site",
  title: "Tasks",
  projectId: null,
  revision: 1,
  brief: "Tasks",
  plan: {
    kind: "app",
    scope: "page",
    tier: "medium",
    tone: "plain",
    theme: DEFAULT_SITE_THEME,
    interactive: true,
    capabilities: ["content"],
    confidence: 1,
  },
  project: {
    title: "Tasks",
    theme: DEFAULT_SITE_THEME,
    capabilities: ["content"],
    pages: {
      home: {
        path: "/",
        title: "Tasks",
        root: "page",
        elements: { page: { type: "Page", props: {}, children: [] } },
      },
    },
  },
  issues: [],
  quality: null,
  turns: [],
  createdAt: "2026-10-04T00:00:00Z",
  updatedAt: null,
};
