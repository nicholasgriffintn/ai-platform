import type { SiteKind, SitePlan, SiteProject, SiteTone } from "@ngriffin_uk/polychat-schemas";

const KIND_GUIDANCE: Record<SiteKind, string> = {
  landing:
    "One page. Open with a Hero, follow with the two or three sections that make the case (FeatureGrid, Steps, Testimonials, Pricing, FAQ), close with a CTA and a Footer.",
  marketing:
    "Several pages that link to each other through the Navbar: a home page plus the destinations the brief implies (pricing, about, contact, features). Each page has a Navbar and Footer with the same links.",
  portfolio:
    "Show the work first. A Hero with the person's name and what they do, a Gallery or Articles of selected work, a short Team or About section, a way to get in touch.",
  dashboard:
    "One screen inside an AppShell. Lead with a Grid of Metrics, then the main Chart and Table, with filters (Input, Select) in a horizontal Stack above the data. Use realistic sample data.",
  app: "Application screens inside an AppShell with navigation. Each page is a working view: lists as Tables with actions, records as Cards with KeyValue detail, creation as Forms.",
  form: "One focused page: a short heading and a Form with exactly the fields the brief needs, sensible types, and a clear submit label. No marketing sections.",
  docs: "A documentation site: a home page that orients the reader and one page per topic. Use Breadcrumbs, Headings, Text, Code and List; keep sections short.",
  component:
    "Build only the component or section asked for, on a single page whose root Page holds just that element. No Navbar, Hero or Footer unless that is the component.",
};

const TONE_GUIDANCE: Record<SiteTone, string> = {
  plain: "Plain voice: short, clear sentences, no hype.",
  friendly: "Friendly voice: warm and direct, second person, no exclamation marks.",
  bold: "Bold voice: confident, punchy headlines, short supporting lines.",
  editorial: "Editorial voice: considered sentences, specific detail, longer supporting copy.",
  technical:
    "Technical voice: precise terms, concrete capabilities, no adjectives without evidence.",
};

export function buildSitePlanGuidance(plan: SitePlan): string {
  const lines = [KIND_GUIDANCE[plan.kind], TONE_GUIDANCE[plan.tone]];

  if (plan.scope === "site") {
    lines.push(
      "Add each page in full before starting the next. Keep page ids short slugs (home, pricing, about).",
    );
  } else if (plan.scope === "page") {
    lines.push('Exactly one page with id "home" and path "/".');
  }

  if (plan.interactive) {
    lines.push(
      "The result needs interaction: seed page state, bind Input, Select, Switch and Tabs with $bindState, gate panels with visible, drive lists with repeat and Table rows from $state, and wire Buttons and Forms with on actions so filters, tabs and additions work.",
    );
  }

  if (plan.theme.mode === "dark") {
    lines.push("The site renders in dark mode; prefer default and muted section backgrounds.");
  }

  return lines.join("\n");
}

export function buildSiteGenerateUserPrompt(prompt: string): string {
  return `Brief:\n${prompt.trim()}\n\nStart streaming the document now, beginning with /title.`;
}

export function buildSiteRefineUserPrompt(prompt: string): string {
  return `Change request:\n${prompt.trim()}\n\nOutput the patch operations now.`;
}

export function serialiseSiteProjectForPrompt(project: SiteProject): string {
  return JSON.stringify(project);
}
