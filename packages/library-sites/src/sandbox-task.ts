import {
  listSitePages,
  type SiteExportTarget,
  type SiteFile,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";

export const SITE_SANDBOX_TASK_MAX_FILE_CHARACTERS = 60_000;
export const SITE_SANDBOX_TASK_MAX_TOTAL_CHARACTERS = 400_000;

export interface BuildSiteSandboxTaskOptions {
  project: SiteProject;
  brief: string;
  files: readonly SiteFile[];
  target: SiteExportTarget;
  instructions?: string;
}

const TARGET_LABELS: Record<SiteExportTarget, string> = {
  "react-router": "React Router",
  next: "Next.js",
  "tanstack-router": "TanStack Router",
};

function fenceFor(content: string): string {
  let fence = "```";

  while (content.includes(fence)) {
    fence += "`";
  }

  return fence;
}

function renderFile(file: SiteFile): string {
  const fence = fenceFor(file.content);
  const content =
    file.content.length > SITE_SANDBOX_TASK_MAX_FILE_CHARACTERS
      ? `${file.content.slice(0, SITE_SANDBOX_TASK_MAX_FILE_CHARACTERS)}\n[truncated]`
      : file.content;

  return `${file.path}\n${fence}\n${content}\n${fence}`;
}

export function buildSiteSandboxTask({
  project,
  brief,
  files,
  target,
  instructions,
}: BuildSiteSandboxTaskOptions): string {
  const pages = listSitePages(project)
    .map(({ page }) => `- ${page.path}: ${page.title}`)
    .join("\n");
  const rendered: string[] = [];
  let total = 0;

  for (const file of files) {
    const block = renderFile(file);

    if (total + block.length > SITE_SANDBOX_TASK_MAX_TOTAL_CHARACTERS) {
      rendered.push(`${file.path}\n[omitted: task size limit reached]`);
      continue;
    }

    total += block.length;
    rendered.push(block);
  }

  return [
    `Build "${project.title}" in this repository as a production ${TARGET_LABELS[target]} application.`,
    "",
    "Original brief:",
    brief.trim(),
    "",
    "Pages:",
    pages,
    "",
    `The files below capture the generated product direction and starting implementation. Integrate them into the repository using ${TARGET_LABELS[target]} as the routing foundation, adapting the structure where a stronger implementation requires it.`,
    "",
    "Then:",
    "- Install dependencies with the repository's package manager and make `npm run build` (or the equivalent) pass.",
    "- Preserve the product intent, information architecture and visual direction while improving weak copy, hierarchy, interaction, accessibility and responsive behaviour.",
    "- Implement the requested capabilities as working product flows, not decorative placeholders.",
    "- Reuse suitable repository assets and dependencies. Add focused dependencies when they materially improve the result.",
    instructions?.trim() ? `\nAdditional instructions:\n${instructions.trim()}` : "",
    "",
    "Generated files:",
    "",
    rendered.join("\n\n"),
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
