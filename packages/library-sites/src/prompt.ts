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
  commerce:
    "Build a commerce journey rather than a brochure: useful product discovery, filters where relevant, product detail, trust information and a clear cart or checkout route. Use realistic products and prices without inventing claims.",
  booking:
    "Build the complete booking journey: service choice, availability, date or time selection, customer details and a clear confirmation state. Make constraints and next steps visible.",
  event:
    "Build around programme discovery and attendance: strong event identity, dates and venue, speakers, filterable schedule, tickets, travel and accessibility information.",
  publication:
    "Use an editorial information architecture with a strong lead story, useful sections, article cards, author and date metadata, and readable long-form article layouts.",
  community:
    "Build a community product with clear navigation between activity, people, groups or discussions. Show believable member and activity states without fabricating impact claims.",
  education:
    "Build a learning journey with course orientation, curriculum, lesson progress, useful exercises and clear next actions. Prioritise legibility and progress awareness.",
  "ai-tool":
    "Build a focused AI workflow with an input workspace, examples or presets, output states, history and clear controls. Include empty, working and completed states in the experience.",
  game: "Build a genuinely playable interaction using page state, visible rules, feedback, score or progress and a restart path. Keep the mechanic focused enough to work in the structured runtime.",
};

const DIRECTION_GUIDANCE: Record<SitePlan["theme"]["direction"], string> = {
  minimal:
    "Minimal direction: remove decoration that does not improve hierarchy; use scale and whitespace deliberately.",
  editorial:
    "Editorial direction: use asymmetric composition, expressive headings, varied image ratios and deliberate text measure. Avoid a repeated card grid.",
  utilitarian:
    "Utilitarian direction: favour dense hierarchy, visible structure, compact controls and direct labels over decorative marketing patterns.",
  brutalist:
    "Brutalist direction: use hard contrast, strong borders, oversized type, flat surfaces and unexpected but legible composition.",
  playful:
    "Playful direction: use bold scale changes, rounded surfaces, energetic colour and varied composition while keeping controls obvious.",
  luxury:
    "Luxury direction: use restrained colour, large type, long whitespace, fine borders and image-led composition. Avoid dense grids and badges.",
  organic:
    "Organic direction: use warm surfaces, softer rhythm, tactile imagery and less rigid alignment while preserving accessible structure.",
  retro:
    "Retro direction: use period-aware type scale, graphic borders and colour blocks without turning the copy into parody.",
  futuristic:
    "Futuristic direction: use dark spatial depth, precise grids, luminous accents and technical hierarchy without defaulting to generic purple gradients.",
  maximalist:
    "Maximalist direction: layer colour, type scale and dense composition, but keep one unmistakable reading order and accessible contrast.",
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
  const lines = [
    KIND_GUIDANCE[plan.kind],
    TONE_GUIDANCE[plan.tone],
    DIRECTION_GUIDANCE[plan.theme.direction],
    `Use ${plan.theme.density} information density, ${plan.theme.texture} surface texture and ${plan.theme.motion} motion.`,
    `Required capabilities: ${plan.capabilities.join(", ")}.`,
  ];

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
  return `Brief:\n${prompt.trim()}\n\nStart streaming the first page shell and its first visible element now.`;
}

export function buildSiteRefineUserPrompt(prompt: string): string {
  return `Change request:\n${prompt.trim()}\n\nOutput the patch operations now.`;
}

export function serialiseSiteProjectForPrompt(project: SiteProject): string {
  return JSON.stringify(project);
}
