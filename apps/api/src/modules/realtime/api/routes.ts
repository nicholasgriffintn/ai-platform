import {
  errorResponseSchema,
  NO_STORE,
  listPageOf,
  realtimeLiveProviderCatalogueResponseSchema,
  realtimePipelineSessionCreateSchema,
  realtimeProxyGrantQuerySchema,
  realtimeSessionResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { type Context, Hono } from "hono";
import z from "zod/v4";

import { optionalRepositories, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { defineResource } from "~/infrastructure/http/resource";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { createCartesiaRealtimeProxyResponse } from "~/modules/realtime/application/cartesia";
import { listRealtimeLiveProviders } from "~/modules/realtime/application/catalogue";
import { createElevenLabsRealtimeProxyResponse } from "~/modules/realtime/application/elevenlabs";
import { createGreenPtRealtimeProxyResponse } from "~/modules/realtime/application/greenpt";
import { createMistralRealtimeProxyResponse } from "~/modules/realtime/application/mistral";
import { createOpenAILiveCallResponse } from "~/modules/realtime/application/openaiLive";
import { createRealtimePipelineSession } from "~/modules/realtime/application/pipeline";
import {
  assertRealtimeProxyGrant,
  connectReservedRealtimeProxy,
} from "~/modules/realtime/application/proxy-grant";
import { createRealtimeSession } from "~/modules/realtime/application/session";
import { settleRealtimeSessionUsage } from "~/modules/realtime/application/sessionUsage";
import type {
  RealtimeProxySessionEndHandler,
  RealtimeProxySessionSummary,
} from "~/modules/realtime/application/transcriptionProxy";
import type { IEnv, IUser } from "~/types";

const app = new Hono<{
  Bindings: IEnv;
  Variables: {
    user?: IUser;
  };
}>();
const routeLogger = createRouteLogger("realtime");

function settleProxySession({
  serviceContext,
  user,
  sessionId,
  model,
  provider,
  byok,
}: {
  serviceContext: ServiceContext;
  user: IUser;
  sessionId: string;
  model: string;
  provider: string;
  byok: boolean;
}): (summary: RealtimeProxySessionSummary) => Promise<void> {
  return async (summary) => {
    await settleRealtimeSessionUsage({
      env: serviceContext.env,
      repositories: optionalRepositories(serviceContext),
      userId: user.id,
      sessionId,
      model,
      provider,
      byok,
      audioSeconds: summary.audioSeconds,
    });
  };
}

app.use("/*", async (c, next) => {
  routeLogger.info(`Processing realtime route: ${c.req.path}`);
  c.header("Cache-Control", NO_STORE);

  await next();
  c.res.headers.set("Cache-Control", NO_STORE);
});

const transcriptionProviderSchema = z.enum(["mistral", "elevenlabs", "cartesia", "greenpt"]);
const transcriptionQuerySchema = realtimeProxyGrantQuerySchema.extend({
  provider: transcriptionProviderSchema,
});
const sessionQuerySchema = z.object({
  type: z.enum(["realtime", "translation", "transcription", "pipeline"]),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  target_language: z.string().min(1).optional(),
  voice: z.string().min(1).optional(),
  instructions: z.string().min(1).optional(),
  delay: z.string().min(1).optional(),
  speakers: z.literal("true").optional(),
  transport: z.string().min(1).optional(),
  input_modalities: z.string().min(1).optional(),
  output_modalities: z.string().min(1).optional(),
});

type TranscriptionProvider = z.infer<typeof transcriptionProviderSchema>;
type TranscriptionQuery = z.infer<typeof transcriptionQuerySchema>;

function transcriptionProxy(
  provider: TranscriptionProvider,
  raw: Context,
  serviceContext: ServiceContext,
  user: IUser,
  query: TranscriptionQuery,
) {
  return (onSessionEnd: RealtimeProxySessionEndHandler) => {
    const shared = {
      context: raw,
      env: serviceContext.env,
      user,
      model: query.model,
      onSessionEnd,
    };

    switch (provider) {
      case "mistral":
        return createMistralRealtimeProxyResponse({
          ...shared,
          delay: query.delay,
          speakerLabels: query.speakers === "true",
        });
      case "elevenlabs":
        return createElevenLabsRealtimeProxyResponse({ ...shared, language: query.language });
      case "cartesia":
        return createCartesiaRealtimeProxyResponse({ ...shared, delay: query.delay });
      case "greenpt":
        return createGreenPtRealtimeProxyResponse({
          ...shared,
          delay: query.delay,
          language: query.language,
        });
    }
  };
}

defineResource(
  app,
  { idParam: "provider_id", path: "/providers", tags: ["realtime"] },
  (providers) => {
    providers.list({
      auth: true,
      summary: "List realtime live providers",
      responses: {
        200: {
          description: "Realtime providers",
          schema: realtimeLiveProviderCatalogueResponseSchema,
        },
      },
      handler: async ({ serviceContext }) =>
        listPageOf(await listRealtimeLiveProviders(serviceContext), (provider) => provider.id),
    });
  },
);

defineResource(
  app,
  { idParam: "session_id", path: "/sessions", tags: ["realtime"] },
  (sessions) => {
    sessions.create({
      auth: true,
      summary: "Create a realtime session",
      description:
        "Creates a realtime, translation or transcription session from the query, or a composed pipeline session from the body when type is pipeline.",
      querySchema: sessionQuerySchema,
      responses: {
        200: { description: "Realtime session", schema: realtimeSessionResponseSchema },
        400: { description: "Bad request", schema: errorResponseSchema },
        403: { description: "Model access denied", schema: errorResponseSchema },
      },
      handler: async ({ query, raw, serviceContext, user }) => {
        if (query.type === "pipeline") {
          const result = await createRealtimePipelineSession({
            env: serviceContext.env,
            request: realtimePipelineSessionCreateSchema.parse(await raw.req.json()),
            user,
          });

          if (result.ok === false) {
            throw new AssistantError(result.message, ErrorType.PARAMS_ERROR, result.status);
          }

          return result.session;
        }

        return createRealtimeSession(serviceContext, user, {
          type: query.type,
          provider: query.provider,
          model: query.model,
          language: query.language,
          targetLanguage: query.target_language,
          voice: query.voice,
          instructions: query.instructions,
          delay: query.delay,
          speakerLabels: query.speakers === "true",
          transport: query.transport,
          inputModalities: query.input_modalities,
          outputModalities: query.output_modalities,
        });
      },
    });
  },
);

addRoute(app, "get", "/transcription", {
  tags: ["realtime"],
  summary: "Connect to realtime transcription",
  description: "Upgrades to a transcription websocket for the provider named in the session grant.",
  auth: true,
  querySchema: transcriptionQuerySchema,
  handler: async ({ query, raw, serviceContext, user }) => {
    const reservation = await assertRealtimeProxyGrant({
      env: serviceContext.env,
      grant: query.grant,
      model: query.model,
      provider: query.provider,
      request: raw.req.raw,
      sessionId: query.session_id,
      user,
    });

    return connectReservedRealtimeProxy(
      reservation,
      transcriptionProxy(query.provider, raw, serviceContext, user, query),
      settleProxySession({
        serviceContext,
        user,
        sessionId: query.session_id,
        model: query.model,
        provider: query.provider,
        byok: reservation.byok,
      }),
    );
  },
});

addRoute(app, "post", "/openai/live/calls", {
  tags: ["realtime"],
  summary: "Exchange a WebRTC offer for a GPT-Live session answer",
  auth: true,
  querySchema: realtimeProxyGrantQuerySchema,
  handler: async ({ query, raw, serviceContext, user }) => {
    const reservation = await assertRealtimeProxyGrant({
      env: serviceContext.env,
      grant: query.grant,
      model: query.model,
      provider: "openai",
      request: raw.req.raw,
      sessionId: query.session_id,
      user,
    });

    try {
      return await createOpenAILiveCallResponse({
        context: raw,
        env: serviceContext.env,
        user,
        model: query.model,
        instructions: query.instructions,
        voice: query.voice,
      });
    } finally {
      await reservation.release();
    }
  },
});

export default app;
