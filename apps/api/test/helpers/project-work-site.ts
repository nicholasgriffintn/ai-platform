import { resolveSitePlan } from "@ngriffin_uk/polychat-library-sites";
import { siteProjectSchema, siteTurnSchema } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

export function projectWorkSiteInput() {
  const brief = "Build a project records dashboard";
  const plan = resolveSitePlan({ prompt: brief });
  const project = siteProjectSchema.parse({
    title: "Project records",
    theme: plan.theme,
    capabilities: ["content", "crud"],
    pages: {
      home: {
        path: "/",
        title: "Records",
        root: "page",
        elements: {
          page: { type: "Page", props: {}, children: ["heading"] },
          heading: { type: "Heading", props: { text: "Project records" }, children: [] },
        },
      },
    },
  });
  const turn = siteTurnSchema.parse({
    id: generateId(),
    role: "user",
    prompt: brief,
    createdAt: new Date().toISOString(),
  });

  return { brief, plan, project, issues: [], turn };
}
