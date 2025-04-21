import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("pages/home.tsx"),
  route("/apps", "pages/apps/index.tsx"),
  route("/apps/podcasts", "pages/apps/podcasts/index.tsx"),
  route("/apps/podcasts/new", "pages/apps/podcasts/new.tsx"),
  route("/apps/podcasts/:id", "pages/apps/podcasts/[id].tsx"),
  route("/auth/callback", "pages/auth/callback.tsx"),
  route("/profile", "pages/profile.tsx"),
  route("/terms", "pages/terms.tsx"),
  route("/privacy", "pages/privacy.tsx"),
  route("/s/:share_id", "pages/shared/[share_id].tsx"),
  route("/auth/verify-magic-link", "pages/auth/verify-magic-link.tsx"),
  route("*?", "pages/catchall.tsx"),
] satisfies RouteConfig;
