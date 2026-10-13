import { Hono } from "hono";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { handleGithubWebhook } from "~/modules/webhooks/application/github-webhook";
import type { IEnv } from "~/types";

const github = new Hono<{ Bindings: IEnv }>();

addRoute(github, "post", "/", {
  tags: ["webhooks"],
  handler: async ({ raw }) => {
    const result = await handleGithubWebhook({
      context: getServiceContext(raw),
      payload: await raw.req.text(),
      signature: raw.req.header("x-hub-signature-256"),
      eventType: raw.req.header("x-github-event"),
    });

    return raw.json(result.body, result.status);
  },
});

export default github;
