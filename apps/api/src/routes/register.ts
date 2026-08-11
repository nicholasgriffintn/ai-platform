import type { Hono } from "hono";

import type { IEnv } from "~/types";
import activity from "./activity";
import admin from "./admin";
import agents from "./agents";
import apps from "./apps";
import audio from "./audio";
import auth from "./auth";
import chat from "./chat";
import dynamicApps from "./dynamic-apps";
import models from "./models";
import outputs from "./outputs";
import plans from "./plans";
import projects from "./projects";
import realtime from "./realtime";
import sources from "./sources";
import stripe from "./stripe";
import tasks from "./tasks";
import templates from "./templates";
import tools from "./tools";
import training from "./training";
import uploads from "./uploads";
import user from "./user";
import webhook from "./webhooks";
import workspaceInvitations from "./workspace-invitations";
import workspaces from "./workspaces";

type ApiApp = Hono<{ Bindings: IEnv }>;

export function registerApiRoutes(app: ApiApp): void {
	app.route("/auth", auth);
	app.route("/activity", activity);
	app.route("/chat", chat);
	app.route("/apps", apps);
	app.route("/models", models);
	app.route("/outputs", outputs);
	app.route("/tasks", tasks);
	app.route("/templates", templates);
	app.route("/tools", tools);
	app.route("/audio", audio);
	app.route("/dynamic-apps", dynamicApps);
	app.route("/uploads", uploads);
	app.route("/user", user);
	app.route("/plans", plans);
	app.route("/stripe", stripe);
	app.route("/sources", sources);
	app.route("/realtime", realtime);
	app.route("/agents", agents);
	app.route("/admin", admin);
	app.route("/webhooks", webhook);
	app.route("/training", training);
	app.route("/workspaces", workspaces);
	app.route("/projects", projects);
	app.route("/workspace-invitations", workspaceInvitations);
}
