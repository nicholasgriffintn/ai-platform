import { resolveSitePlan } from "@ngriffin_uk/polychat-library-sites";
import { siteRecordSchema } from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function savedSite(id: string) {
  const plan = resolveSitePlan({ prompt: "Build a records dashboard" });

  return siteRecordSchema.parse({
    id,
    title: id,
    brief: "Build a records dashboard",
    projectId: "project",
    revision: 1,
    plan,
    project: {
      title: id,
      theme: plan.theme,
      capabilities: ["content"],
      pages: {
        home: {
          path: "/",
          title: id,
          root: "page",
          elements: { page: { type: "Page", props: {}, children: [] } },
        },
      },
    },
    issues: [],
    quality: null,
    turns: [],
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: null,
  });
}

export function siteEditorWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
