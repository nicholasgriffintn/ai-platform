import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("pages/home.tsx"),
	route("/apps", "pages/apps.tsx"),
	route("/auth/callback", "pages/auth/callback.tsx"),
	route("/terms", "pages/terms.tsx"),
	route("/privacy", "pages/privacy.tsx"),
	route("*?", "pages/catchall.tsx"),
] satisfies RouteConfig;
