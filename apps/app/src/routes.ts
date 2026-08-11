import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("pages/home.tsx"),
	route("/chat", "pages/chat.tsx"),
	route("/work", "pages/work/layout.tsx", [
		index("pages/work/index.tsx"),
		route("invitations", "pages/work/invitations.tsx"),
		route(":workspaceId", "pages/work/workspace.tsx"),
		route(":workspaceId/members", "pages/work/members.tsx"),
		route(":workspaceId/governance", "pages/work/governance.tsx"),
		route(":workspaceId/projects/:projectId", "pages/work/project.tsx"),
		route(":workspaceId/projects/:projectId/chat", "pages/work/project-chat.tsx"),
		route(":workspaceId/projects/:projectId/experiences", "pages/work/project-experiences.tsx"),
		route(
			":workspaceId/projects/:projectId/experiences/:experienceId/*",
			"pages/work/project-experience.tsx",
		),
		route(":workspaceId/projects/:projectId/library", "pages/work/project-library.tsx"),
		route(":workspaceId/projects/:projectId/sources", "pages/work/project-sources.tsx"),
		route(":workspaceId/projects/:projectId/activity", "pages/work/project-activity.tsx"),
		route(":workspaceId/projects/:projectId/outputs/*", "pages/work/project-outputs.tsx"),
		route(":workspaceId/projects/:projectId/apps/:appId", "pages/work/project-app.tsx"),
	]),
	route("/terms", "pages/terms.tsx"),
	route("/privacy", "pages/privacy.tsx"),
	route("/auth/callback", "pages/auth/callback.tsx"),
	route("/auth/verify-magic-link", "pages/auth/verify-magic-link.tsx"),
	route("/profile", "pages/profile.tsx"),
	route("/s/:share_id", "pages/shared/[share_id].tsx"),
	route("/o/:token", "pages/shared/output.tsx"),
	route("*?", "pages/catchall.tsx"),
] satisfies RouteConfig;
