import { siteRuntimeRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { DurableObject } from "cloudflare:workers";
import z from "zod/v4";

import type { IEnv } from "~/types";

import { SiteCollectionStore } from "./collection-store";

export class SiteRuntime extends DurableObject<IEnv> {
  private readonly store = new SiteCollectionStore(this.ctx.storage.sql);

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }

    const parsed = siteRuntimeRequestSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid app storage request", type: ErrorType.PARAMS_ERROR },
        { status: 400 },
      );
    }

    const input = parsed.data;

    try {
      const result = this.ctx.storage.transactionSync(() => {
        switch (input.operation) {
          case "status":
            return this.store.status();
          case "read":
            return this.store.read(input.revision, input.collectionId);
          case "activate":
            return this.store.activate(input.revision, input.collections);
          case "operate":
            this.store.operate(input.revision, input.action, input.actor);
            break;
          case "disable":
            this.store.disable(input.revision);
            break;
          case "deleteData":
            this.store.deleteData();
            break;
        }

        return this.store.status();
      });

      return Response.json(result);
    } catch (error) {
      if (error instanceof AssistantError) {
        return Response.json(
          { error: error.message, type: error.type },
          { status: error.statusCode },
        );
      }

      if (error instanceof z.ZodError) {
        return Response.json(
          { error: "Invalid app storage data", type: ErrorType.PARAMS_ERROR },
          { status: 400 },
        );
      }

      throw error;
    }
  }
}
