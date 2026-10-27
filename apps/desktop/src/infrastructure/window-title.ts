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
  plugins: "Plugins",
  pricing: "Pricing",
  privacy: "Privacy Policy",
  profile: "Profile",
  project: "Project",
  "project-activity": "Project activity",
  "project-app": "Project app",
  "project-chat": "Project conversation",
  "project-files": "Project files",
  "project-plugins": "Plugins",
  "project-settings": "Project settings",
  "project-skill": "Project skill",
  "project-task": "Task",
  "project-tasks": "Tasks",
  "project-teammate-context": "Project teammate context",
  "project-teammate-settings": "Project teammate settings",
  "project-tool": "Project tool",
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
  "workspace-members": "Workspace people",
  "teammate-context": "Teammate context",
  "teammate-group": "Group",
  "teammate-settings": "Teammate settings",
};

export function describeWindowTitle(page: string | undefined): string {
  const place = page ? PAGE_TITLES[page] : undefined;

  return place ? `${place} — ${APP_WINDOW_TITLE}` : APP_WINDOW_TITLE;
}

export function readTitledPages(): readonly string[] {
  return Object.keys(PAGE_TITLES);
}
