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

import { getServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import {
  requireAuthenticatedService,
  requireAuthenticatedUser,
  requireAuthenticatedUserOrAnonymous,
} from "~/lib/http/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import type { AnonymousUser, IUser } from "~/types";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

interface RouteResponseSpec {
  description: string;
  schema?: ZodType;
}

export interface HandlerContext<TBody = unknown, TParams = unknown, TQuery = unknown> {
  /** Pre-built ServiceContext for the request. */
  serviceContext: ServiceContext;
  /** The raw Hono context, for cases where you need direct access. */
  raw: Context;
  /** Validated request body (if bodySchema provided). */
  body: TBody;
  /** Validated route params (if paramSchema provided). */
  params: TParams;
  /** Validated query params (if querySchema provided). */
  query: TQuery;
  /** Authenticated user, when present. */
  user: IUser | undefined;
  /** Anonymous user context, when present. */
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
  /** OpenAPI tag(s). */
  tags: string[];
  /** Short summary for OpenAPI docs. */
  summary?: string;
  /** Longer description for OpenAPI docs. */
  description?: string;
  /** Additional Hono middleware to run before the handler. */
  middleware?: MiddlewareHandler[];
  /** Zod schema for JSON request body validation. */
  bodySchema?: ZodType<TBody>;
  /** Zod schema for form-data request body validation. */
  formSchema?: ZodType;
  /** Zod schema for route parameter validation. */
  paramSchema?: ZodType<TParams>;
  /** Zod schema for query string validation. */
  querySchema?: ZodType<TQuery>;
  /** OpenAPI response definitions. Keyed by status code. */
  responses?: Record<number, RouteResponseSpec>;
}

type RouteConfig<TBody, TParams, TQuery> =
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      /** Require a signed-in user. Throws 401 if only anonymous context is present. */
      auth: true;
      /** The handler function. Return data for JSON, or a Response for streaming. */
      handler: (ctx: AuthenticatedHandlerContext<TBody, TParams, TQuery>) => Promise<unknown>;
    })
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      auth: "service";
      serviceScope: InternalServiceScope;
      handler: (ctx: ServiceHandlerContext<TBody, TParams, TQuery>) => Promise<unknown>;
    })
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      /** Require either a signed-in user or anonymous-user context. */
      auth: "user-or-anonymous";
      /** The handler function. Return data for JSON, or a Response for streaming. */
      handler: (ctx: HandlerContext<TBody, TParams, TQuery>) => Promise<unknown>;
    })
  | (BaseRouteConfig<TBody, TParams, TQuery> & {
      auth?: false;
      /** The handler function. Return data for JSON, or a Response for streaming. */
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

    if (config.auth === true) {
      const result = await config.handler({
        ...baseHandlerCtx,
        user: requireAuthenticatedUser(c),
        anonymousUser: c.get("anonymousUser") as AnonymousUser | undefined,
      });

      if (result instanceof Response) {
        return result;
      }

      return ResponseFactory.success(c, result);
    }

    if (config.auth === "service") {
      const result = await config.handler({
        ...baseHandlerCtx,
        user: undefined,
        anonymousUser: undefined,
        service: requireAuthenticatedService(c, config.serviceScope),
      });

      if (result instanceof Response) {
        return result;
      }

      return ResponseFactory.success(c, result);
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

    if (result instanceof Response) {
      return result;
    }

    return ResponseFactory.success(c, result);
  };

  middlewares.push(handler);

  app[method](path, ...middlewares);
}
