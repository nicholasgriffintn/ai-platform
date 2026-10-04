import { siteDataActionSchema, siteRuntimeActorSchema } from "@ngriffin_uk/polychat-schemas";

import { SiteRuntime } from "../../../src/modules/sites/infrastructure/runtime";

export { SiteRuntime };

interface Env {
  SITES_RUNTIME: DurableObjectNamespace<SiteRuntime>;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const runtime = env.SITES_RUNTIME.get(
      env.SITES_RUNTIME.idFromName(url.searchParams.get("site") ?? "first"),
    );
    const revision = Number(url.searchParams.get("revision") ?? "1");

    try {
      switch (url.pathname) {
        case "/activate":
          return Response.json(
            await runtime.activate(revision, {
              tasks: {
                label: "Tasks",
                maxRecords: 2,
                fields: { title: { type: "string", required: true } },
              },
            }),
          );
        case "/read":
          return Response.json(await runtime.read(revision, "tasks"));
        case "/disable":
          await runtime.disable();

          return Response.json(await runtime.status());
        case "/delete":
          await runtime.deleteData();

          return Response.json(await runtime.status());
        case "/action": {
          const input = await request.json();
          const action = siteDataActionSchema.parse(input);
          const actor = siteRuntimeActorSchema.parse({
            userId: Number(url.searchParams.get("user") ?? "1"),
            scope: "project",
            role: url.searchParams.get("role") ?? "member",
          });

          await runtime.operate(revision, action, actor);

          return Response.json(await runtime.read(revision, "tasks"));
        }

        default:
          return new Response(null, { status: 404 });
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 409 },
      );
    }
  },
};
