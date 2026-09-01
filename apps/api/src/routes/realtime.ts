import {
  errorResponseSchema,
  NO_STORE,
  realtimeLiveProviderCatalogueResponseSchema,
  realtimePipelineSessionCreateSchema,
  realtimePipelineSessionResponseSchema,
  realtimeProxyGrantQuerySchema,
  realtimeSessionResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { optionalRepositories } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import {
  getRealtimeProvider,
  listRealtimeProviders,
  parseRealtimeModalities,
  parseRealtimeTranscriptionDelay,
  parseRealtimeTransport,
} from "~/lib/providers/capabilities/realtime";
import { assertRealtimeProxyGrant, connectReservedRealtimeProxy } from "~/lib/realtime/proxy-grant";
import { resolveRealtimeMaxSessionSeconds } from "~/lib/realtime/sessionLimits";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getAccessibleRealtimeModel } from "~/services/realtime/access";
import { createCartesiaRealtimeProxyResponse } from "~/services/realtime/cartesia";
import { listRealtimeLiveProviders } from "~/services/realtime/catalogue";
import { createElevenLabsRealtimeProxyResponse } from "~/services/realtime/elevenlabs";
import { createMistralRealtimeProxyResponse } from "~/services/realtime/mistral";
import { createRealtimePipelineSession } from "~/services/realtime/pipeline";
import {
  admitRealtimeSession,
  priceRealtimeReservation,
  registerRealtimeSessionUsage,
} from "~/services/realtime/sessionUsage";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { isRecord } from "~/utils/objects";

const app = new Hono<{
  Bindings: IEnv;
  Variables: {
    user?: IUser;
  };
}>();
const routeLogger = createRouteLogger("realtime");

app.use("/*", async (c, next) => {
  routeLogger.info(`Processing realtime route: ${c.req.path}`);
  c.header("Cache-Control", NO_STORE);

  await next();
  c.res.headers.set("Cache-Control", NO_STORE);
});

addRoute(app, "get", "/providers", {
  tags: ["realtime"],
  summary: "List realtime live providers",
  auth: true,
  responses: {
    200: {
      description: "Realtime live provider catalogue with current readiness",
      schema: realtimeLiveProviderCatalogueResponseSchema,
    },
  },
  handler: async ({ serviceContext }) => ({
    providers: await listRealtimeLiveProviders(serviceContext),
  }),
});

addRoute(app, "post", "/session/:type", {
  tags: ["realtime"],
  summary: "Create a new realtime session",
  auth: true,
  responses: {
    200: {
      description: "Realtime session created",
      schema: realtimeSessionResponseSchema,
    },
    400: { description: "Bad request", schema: errorResponseSchema },
  },
  handler: async ({ raw, serviceContext, user }) => {
    const env = serviceContext.env;
    const type = raw.req.param("type");
    const model = raw.req.query("model");
    const language = raw.req.query("language");
    const sourceLanguage = raw.req.query("source_language");
    const targetLanguage = raw.req.query("target_language");
    const voice = raw.req.query("voice");
    const instructions = raw.req.query("instructions");
    const delay = parseRealtimeTranscriptionDelay(raw.req.query("delay"));
    const transportQuery = raw.req.query("transport");
    const inputModalitiesQuery = raw.req.query("input_modalities");
    const outputModalitiesQuery =
      raw.req.query("output_modalities") ||
      raw.req.query("response_modalities") ||
      raw.req.query("modalities");
    const providerName = raw.req.query("provider") || "openai";

    if (type !== "realtime" && type !== "translation" && type !== "transcription") {
      return ResponseFactory.error(raw, "Invalid session type", 400);
    }

    if (!listRealtimeProviders().includes(providerName)) {
      return ResponseFactory.error(raw, "Invalid provider specified", 400);
    }

    const provider = getRealtimeProvider(providerName, { env, user });

    if (model && provider.models && !provider.models.includes(model)) {
      return ResponseFactory.error(raw, "Invalid model specified", 400);
    }

    let requestedModel = model;

    if (!requestedModel) {
      try {
        requestedModel = provider.getDefaultModel(type);
      } catch (error) {
        return ResponseFactory.error(
          raw,
          error instanceof Error ? error.message : "Invalid session type",
          400,
        );
      }
    }

    const accessibleModel = await getAccessibleRealtimeModel({
      env,
      user,
      model: requestedModel,
      provider: providerName,
    });

    if (!accessibleModel) {
      return ResponseFactory.error(raw, "Model not found or user does not have access", 403);
    }

    const transport = parseRealtimeTransport(transportQuery);
    const inputModalities = parseRealtimeModalities(inputModalitiesQuery);
    const outputModalities = parseRealtimeModalities(outputModalitiesQuery);

    const pricing = priceRealtimeReservation(
      accessibleModel.config,
      providerName,
      accessibleModel.id,
    );
    const admitted = await admitRealtimeSession({
      repositories: optionalRepositories(serviceContext),
      userId: user.id,
      creditMicros: pricing.creditMicros,
    });

    if (!admitted) {
      return ResponseFactory.error(
        raw,
        "Realtime session refused: usage allowance is exhausted",
        403,
      );
    }

    const maxSessionSeconds = resolveRealtimeMaxSessionSeconds(env);

    const session = await provider.createSession({
      env,
      user,
      credentialAuthority: accessibleModel.credentialAuthority,
      type,
      model: accessibleModel.id,
      language,
      sourceLanguage,
      targetLanguage,
      voice,
      instructions,
      delay,
      transport,
      inputModalities,
      outputModalities,
    });

    if (!session) {
      return ResponseFactory.error(raw, "Failed to create realtime session", 500);
    }

    const sessionId =
      isRecord(session) && typeof session.id === "string" && session.id ? session.id : generateId();

    await registerRealtimeSessionUsage({
      env,
      repositories: optionalRepositories(serviceContext),
      userId: user.id,
      sessionId,
      model: accessibleModel.id,
      provider: providerName,
      byok: accessibleModel.credentialAuthority === "byok",
      pricing,
      maxSessionSeconds,
    });

    if (isRecord(session)) {
      return { ...session, max_session_seconds: maxSessionSeconds };
    }

    return session;
  },
});

addRoute(app, "post", "/pipeline/session", {
  tags: ["realtime"],
  summary: "Create a composed realtime pipeline session",
  auth: true,
  bodySchema: realtimePipelineSessionCreateSchema,
  responses: {
    200: {
      description: "Composed realtime pipeline session created",
      schema: realtimePipelineSessionResponseSchema,
    },
    400: { description: "Bad request", schema: errorResponseSchema },
    403: { description: "Model access denied", schema: errorResponseSchema },
  },
  handler: async ({ body, raw, serviceContext, user }) => {
    type PipelineResult = Awaited<ReturnType<typeof createRealtimePipelineSession>>;
    const result: PipelineResult = await createRealtimePipelineSession({
      env: serviceContext.env,
      request: body,
      user,
    });

    if (!result.ok) {
      const failure = result as Extract<PipelineResult, { ok: false }>;

      return ResponseFactory.error(raw, failure.message, failure.status);
    }

    return result.session;
  },
});

addRoute(app, "get", "/mistral/transcription", {
  tags: ["realtime"],
  summary: "Connect to Mistral realtime transcription",
  auth: true,
  querySchema: realtimeProxyGrantQuerySchema,
  handler: async ({ query, raw, serviceContext, user }) => {
    const reservation = await assertRealtimeProxyGrant({
      env: serviceContext.env,
      grant: query.grant,
      model: query.model,
      provider: "mistral",
      request: raw.req.raw,
      sessionId: query.session_id,
      user,
    });

    return connectReservedRealtimeProxy(reservation, (onSessionEnd) =>
      createMistralRealtimeProxyResponse({
        context: raw,
        delay: query.delay,
        env: serviceContext.env,
        user,
        model: query.model,
        onSessionEnd,
      }),
    );
  },
});

addRoute(app, "get", "/elevenlabs/transcription", {
  tags: ["realtime"],
  summary: "Connect to ElevenLabs realtime transcription",
  auth: true,
  querySchema: realtimeProxyGrantQuerySchema,
  handler: async ({ query, raw, serviceContext, user }) => {
    const reservation = await assertRealtimeProxyGrant({
      env: serviceContext.env,
      grant: query.grant,
      model: query.model,
      provider: "elevenlabs",
      request: raw.req.raw,
      sessionId: query.session_id,
      user,
    });

    return connectReservedRealtimeProxy(reservation, (onSessionEnd) =>
      createElevenLabsRealtimeProxyResponse({
        context: raw,
        env: serviceContext.env,
        user,
        model: query.model,
        language: query.language,
        onSessionEnd,
      }),
    );
  },
});

addRoute(app, "get", "/cartesia/transcription", {
  tags: ["realtime"],
  summary: "Connect to Cartesia realtime transcription",
  auth: true,
  querySchema: realtimeProxyGrantQuerySchema,
  handler: async ({ query, raw, serviceContext, user }) => {
    const reservation = await assertRealtimeProxyGrant({
      env: serviceContext.env,
      grant: query.grant,
      model: query.model,
      provider: "cartesia",
      request: raw.req.raw,
      sessionId: query.session_id,
      user,
    });

    return connectReservedRealtimeProxy(reservation, (onSessionEnd) =>
      createCartesiaRealtimeProxyResponse({
        context: raw,
        delay: query.delay,
        env: serviceContext.env,
        user,
        model: query.model,
        onSessionEnd,
      }),
    );
  },
});

export default app;
