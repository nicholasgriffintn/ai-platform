import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("pages/home.tsx"),
	route("/chat", "pages/chat.tsx"),
	route("/work", "pages/work/index.tsx"),
	route("/work/invitations", "pages/work/invitations.tsx"),
	route("/work/:workspaceId", "pages/work/workspace.tsx"),
	route("/work/:workspaceId/members", "pages/work/members.tsx"),
	route("/work/:workspaceId/projects/:projectId", "pages/work/project.tsx"),
	route("/work/:workspaceId/projects/:projectId/chat", "pages/work/project-chat.tsx"),
	route("/work/:workspaceId/projects/:projectId/experiences", "pages/work/project-experiences.tsx"),
	route(
		"/work/:workspaceId/projects/:projectId/experiences/:experienceId/*",
		"pages/work/project-experience.tsx",
	),
	route("/work/:workspaceId/projects/:projectId/library", "pages/work/project-library.tsx"),
	route("/work/:workspaceId/projects/:projectId/apps/:appId", "pages/work/project-app.tsx"),
	route("/terms", "pages/terms.tsx"),
	route("/privacy", "pages/privacy.tsx"),
	route("/auth/callback", "pages/auth/callback.tsx"),
	route("/auth/verify-magic-link", "pages/auth/verify-magic-link.tsx"),
	route("/profile", "pages/profile.tsx"),
	route("/s/:share_id", "pages/shared/[share_id].tsx"),
	route("*?", "pages/catchall.tsx"),
] satisfies RouteConfig;
