import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";

export const APP_WINDOW_TITLE = "Polychat";

const PAGE_TITLES: Record<string, string> = {
  apps: "App",
  attention: "Attention",
  canvas: "Canvas",
  catalogue: "Apps",
  chat: "Chat",
  discover: "Discover",
  files: "Files",
  models: "Models",
  "not-found": "Not found",
  pets: "Pets",
  plugins: "Plugins",
  pricing: "Pricing",
  privacy: "Privacy Policy",
  profile: "Profile",
  project: "Project",
  "project-activity": "Project activity",
  "project-chat": "Project conversation",
  "project-settings": "Project settings",
  "project-task": "Task",
  "project-tasks": "Tasks",
  root: "Chat",
  scheduled: "Scheduled",
  skill: "Skill",
  teammate: "Teammate",
  teammates: "Teammates",
  terms: "Terms of Service",
  tools: "Tool",
  work: "Work",
  "work-attention": "Attention",
  "work-invitations": "Workspace invitation",
  workspace: "Workspace",
  "workspace-governance": "Workspace governance",
  "workspace-members": "Workspace people",
  "teammate-context": "Teammate context",
  "teammate-group": "Group",
  "teammate-settings": "Teammate settings",
};

const PROJECT_PLACE_TITLES: Record<string, string> = {
  apps: "Project app",
  files: "Project files",
  skill: "Project skill",
  teammate: "Project teammate",
  "teammate-context": "Project teammate context",
  "teammate-settings": "Project teammate settings",
  teammates: "Project teammates",
  tools: "Project tool",
};

export function describeWindowTitle(page: string | undefined, pathname = ""): string {
  if (!page) {
    return APP_WINDOW_TITLE;
  }

  const inProject = pathname.startsWith(`${MODE_BASE_PATHS.work}/`);
  const place = (inProject ? PROJECT_PLACE_TITLES[page] : undefined) ?? PAGE_TITLES[page];

  return place ? `${place} — ${APP_WINDOW_TITLE}` : APP_WINDOW_TITLE;
}

export function readTitledPages(): readonly string[] {
  return Object.keys(PAGE_TITLES);
}
