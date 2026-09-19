import { listSitePages, type SiteFile, type SiteProject } from "@ngriffin_uk/polychat-schemas";

export const SITE_SANDBOX_TASK_MAX_FILE_CHARACTERS = 60_000;
export const SITE_SANDBOX_TASK_MAX_TOTAL_CHARACTERS = 400_000;

export interface BuildSiteSandboxTaskOptions {
  project: SiteProject;
  brief: string;
  files: readonly SiteFile[];
  instructions?: string;
}

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
    `Build the website "${project.title}" in this repository as a production Next.js application.`,
    "",
    "Original brief:",
    brief.trim(),
    "",
    "Pages:",
    pages,
    "",
    "The files below were generated from the approved design and are the source of truth for structure, copy and theme. Add them to the repository, adapting paths to the existing project layout if the repository already contains a Next.js or Vite app; otherwise create the app at the repository root from these files.",
    "",
    "Then:",
    "- Install dependencies with the repository's package manager and make `npm run build` (or the equivalent) pass.",
    "- Keep the copy, section order and theme tokens exactly as generated. Improve markup semantics, accessibility and responsive behaviour where the generated components fall short.",
    "- Replace image placeholders only with assets that already exist in the repository.",
    "- Do not add UI libraries beyond Tailwind CSS, lucide-react, clsx and tailwind-merge.",
    instructions?.trim() ? `\nAdditional instructions:\n${instructions.trim()}` : "",
    "",
    "Generated files:",
    "",
    rendered.join("\n\n"),
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
