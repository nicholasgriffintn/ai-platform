import { DEFAULT_SITE_THEME, type SiteRecord } from "@ngriffin_uk/polychat-schemas";

import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

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

export const testSiteOutput: OutputRecord = {
  id: "site",
  created_by_user_id: 1,
  project_id: null,
  conversation_id: null,
  parent_output_id: null,
  capability_id: "featured-sites",
  group_id: null,
  kind: "site",
  title: "Tasks",
  status: "ready",
  sensitivity: "internal",
  content: JSON.stringify({
    brief: testSite.brief,
    plan: testSite.plan,
    project: testSite.project,
    turns: [],
    issues: [],
  }),
  storage_key: null,
  mime_type: null,
  filename: null,
  byte_size: null,
  revision: 1,
  created_at: testSite.createdAt,
  updated_at: null,
};
