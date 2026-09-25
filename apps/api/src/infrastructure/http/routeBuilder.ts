import type {
  InternalServiceScope,
  InternalServiceTokenClaims,
} from "@ngriffin_uk/polychat-schemas";
import type { Context, MiddlewareHandler } from "hono";
import {
  describeRoute,
  resolver,
  validator as zValidator,
  type DescribeRouteOptions,
} from "hono-openapi";
import type { ZodType } from "zod/v4";

import { getServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  requireAuthenticatedService,
  requireAuthenticatedUser,
  requireAuthenticatedUserOrAnonymous,
} from "~/infrastructure/http/auth";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import type { AnonymousUser, IUser } from "~/types";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

interface RouteResponseSpec {
  description: string;
  schema?: ZodType;
}

export interface HandlerContext<TBody = unknown, TParams = unknown, TQuery = unknown> {
  serviceContext: ServiceContext;
  raw: Context;
  body: TBody;
  params: TParams;
  query: TQuery;
  user: IUser | undefined;
  anonymousUser: AnonymousUser | undefined;
}

export interface AuthenticatedHandlerContext<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> extends HandlerContext<TBody, TParams, TQuery> {
  user: IUser;
}

export interface ServiceHandlerContext<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> extends HandlerContext<TBody, TParams, TQuery> {
  service: InternalServiceTokenClaims;
}

interface BaseRouteConfig<TBody, TParams, TQuery> {
  tags: string[];
  summary?: string;
  description?: string;
  middleware?: MiddlewareHandler[];
  bodySchema?: ZodType<TBody>;
  formSchema?: ZodType;
  paramSchema?: ZodType<TParams>;
  querySchema?: ZodType<TQuery>;
  responses?: Record<number, RouteResponseSpec>;
  cache?: RouteCacheConfig | "no-store";
}

export interface RouteCacheConfig {
  maxAge: number;
  staleWhileRevalidate?: number;
}

type RouteConfig<TBody, TParams, TQuery> =
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      auth: true;
      handler: (ctx: AuthenticatedHandlerContext<TBody, TParams, TQuery>) => Promise<unknown>;
    })
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      auth: "service";
      serviceScope: InternalServiceScope;
      handler: (ctx: ServiceHandlerContext<TBody, TParams, TQuery>) => Promise<unknown>;
    })
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      auth: "user-or-anonymous";
      handler: (ctx: HandlerContext<TBody, TParams, TQuery>) => Promise<unknown>;
    })
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      auth?: false;
      handler: (ctx: HandlerContext<TBody, TParams, TQuery>) => Promise<unknown>;
    });

interface HonoLike {
  get(path: string, ...handlers: MiddlewareHandler[]): unknown;
  post(path: string, ...handlers: MiddlewareHandler[]): unknown;
  put(path: string, ...handlers: MiddlewareHandler[]): unknown;
  delete(path: string, ...handlers: MiddlewareHandler[]): unknown;
}

export function addRoute<TBody = unknown, TParams = unknown, TQuery = unknown>(
  app: HonoLike,
  method: HttpMethod,
  path: string,
  config: RouteConfig<TBody, TParams, TQuery>,
): void {
  const middlewares: MiddlewareHandler[] = [];

  if (config.summary || config.description || config.responses) {
    type ResponsesMap = NonNullable<DescribeRouteOptions["responses"]>;
    const responses: ResponsesMap = {};

    if (config.responses) {
      for (const [code, spec] of Object.entries(config.responses)) {
        responses[code] = spec.schema
          ? {
              description: spec.description,
              content: {
                "application/json": {
                  schema: resolver(spec.schema),
                },
              },
            }
          : { description: spec.description };
      }
    }

    middlewares.push(
      describeRoute({
        tags: config.tags || ["uncategorised"],
        summary: config.summary,
        description: config.description,
        responses,
      }),
    );
  }

  if (config.paramSchema) {
    middlewares.push(zValidator("param", config.paramSchema));
  }

  if (config.querySchema) {
    middlewares.push(zValidator("query", config.querySchema));
  }

  if (config.bodySchema) {
    middlewares.push(zValidator("json", config.bodySchema));
  }

  if (config.formSchema) {
    middlewares.push(zValidator("form", config.formSchema));
  }

  if (config.middleware) {
    middlewares.push(...config.middleware);
  }

  const handler: MiddlewareHandler = async (c: Context) => {
    const serviceContext = getServiceContext(c);
    const baseHandlerCtx = {
      serviceContext,
      raw: c,
      body: config.bodySchema ? (c.req.valid("json" as never) as TBody) : undefined,
      params: config.paramSchema ? (c.req.valid("param" as never) as TParams) : undefined,
      query: config.querySchema ? (c.req.valid("query" as never) as TQuery) : undefined,
    };
    const respond = (result: unknown): Response | Promise<Response> => {
      if (result instanceof Response) {
        return result;
      }

      if (method === "get" && config.cache) {
        return config.cache === "no-store"
          ? respondWithoutRouteCache(c, result)
          : respondWithRouteCache(c, result, config.cache);
      }

      return ResponseFactory.success(c, result);
    };

    if (config.auth === true) {
      const result = await config.handler({
        ...baseHandlerCtx,
        user: requireAuthenticatedUser(c),
        anonymousUser: c.get("anonymousUser") as AnonymousUser | undefined,
      });

      return respond(result);
    }

    if (config.auth === "service") {
      const result = await config.handler({
        ...baseHandlerCtx,
        user: undefined,
        anonymousUser: undefined,
        service: requireAuthenticatedService(c, config.serviceScope),
      });

      return respond(result);
    }

    let user = c.get("user") as IUser | undefined;
    let anonymousUser = c.get("anonymousUser") as AnonymousUser | undefined;

    if (config.auth === "user-or-anonymous") {
      const authContext = requireAuthenticatedUserOrAnonymous(c);

      user = authContext.user;
      anonymousUser = authContext.anonymousUser;
    }

    const handlerCtx: HandlerContext<TBody, TParams, TQuery> = {
      ...baseHandlerCtx,
      user,
      anonymousUser,
    };

    const result = await config.handler(handlerCtx);

    return respond(result);
  };

  middlewares.push(handler);

  app[method](path, ...middlewares);
}

function weakBodyEtag(body: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `W/"${(hash >>> 0).toString(16)}-${body.length.toString(16)}"`;
}

async function respondWithRouteCache(
  c: Context,
  data: unknown,
  cache: RouteCacheConfig,
): Promise<Response> {
  const response = ResponseFactory.success(c, data);
  const body = await response.text();
  const etag = weakBodyEtag(body);
  const headers = new Headers(response.headers);

  headers.set("ETag", etag);

  const staleWhileRevalidate = cache.staleWhileRevalidate ?? cache.maxAge;

  headers.set(
    "Cache-Control",
    `private, max-age=${cache.maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  );

  const varied = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );

  varied.add("Origin");
  varied.add("Authorization");
  varied.add("Cookie");
  headers.set("Vary", [...varied].join(", "));

  const ifNoneMatch = c.req.header("If-None-Match");

  if (ifNoneMatch === etag || ifNoneMatch === "*") {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, { status: response.status, headers });
}

function respondWithoutRouteCache(c: Context, data: unknown): Response {
  const response = ResponseFactory.success(c, data);
  const headers = new Headers(response.headers);

  headers.set("Cache-Control", "private, no-store");

  return new Response(response.body, { status: response.status, headers });
}
