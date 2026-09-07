export const APP_WINDOW_TITLE = "Polychat";

const PAGE_TITLES: Record<string, string> = {
  apps: "App",
  attention: "Attention",
  catalogue: "Apps",
  chat: "Chat",
  discover: "Discover",
  files: "Files",
  models: "Models",
  "not-found": "Not found",
  pets: "Pets",
  pricing: "Pricing",
  privacy: "Privacy Policy",
  profile: "Profile",
  project: "Project",
  "project-activity": "Project activity",
  "project-app": "Project app",
  "project-chat": "Project conversation",
  "project-files": "Project files",
  "project-settings": "Project settings",
  "project-task": "Task",
  "project-tasks": "Tasks",
  "project-teammate": "Project teammate",
  "project-teammates": "Project teammates",
  "project-tool": "Project tool",
  root: "Chat",
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
};

export function describeWindowTitle(page: string | undefined): string {
  const place = page ? PAGE_TITLES[page] : undefined;

  return place ? `${place} — ${APP_WINDOW_TITLE}` : APP_WINDOW_TITLE;
}

export function readTitledPages(): readonly string[] {
  return Object.keys(PAGE_TITLES);
}
