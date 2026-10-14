import { addRoute, type HonoLike, type RouteConfig } from "~/infrastructure/http/routeBuilder";

type ResourceMethod = "get" | "post" | "patch" | "delete";

type ScopedRouteConfig<TConfig> = TConfig extends { auth?: infer TAuth }
  ? Omit<TConfig, "tags" | "auth"> & { tags?: string[]; auth: Exclude<TAuth, undefined> }
  : never;

export type ResourceOperation<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> = ScopedRouteConfig<RouteConfig<TBody, TParams, TQuery>>;

interface ListEnvelope {
  object: "list";
  data: unknown[];
  has_more: boolean;
  last_id?: string | null;
}

type ListResult<TOperation> = TOperation extends { handler: (context: infer TContext) => unknown }
  ? Omit<TOperation, "handler"> & {
      handler: (context: TContext) => Promise<ListEnvelope>;
    }
  : never;

export type ListOperation<TBody = unknown, TParams = unknown, TQuery = unknown> = ListResult<
  ResourceOperation<TBody, TParams, TQuery>
>;

interface PendingRoute {
  method: ResourceMethod;
  path: string;
  register: (app: HonoLike, tags: string[]) => void;
}

export interface ResourceOptions {
  tags: string[];
}

function joinPath(base: string, segment: string): string {
  const trimmed = base === "/" ? "" : base;

  return `${trimmed}/${segment}`;
}

function compareSegments(left: string, right: string): number {
  const leftSegments = left.split("/");
  const rightSegments = right.split("/");
  const length = Math.min(leftSegments.length, rightSegments.length);

  for (let index = 0; index < length; index += 1) {
    const leftParam = leftSegments[index]?.startsWith(":") ?? false;
    const rightParam = rightSegments[index]?.startsWith(":") ?? false;

    if (leftParam !== rightParam) {
      return leftParam ? 1 : -1;
    }
  }

  return 0;
}

export class ResourceBuilder {
  readonly itemPath: string;

  constructor(
    private readonly routes: PendingRoute[],
    readonly collectionPath: string,
    readonly idParam: string,
  ) {
    this.itemPath = joinPath(collectionPath, `:${idParam}`);
  }

  private add<TBody, TParams, TQuery>(
    method: ResourceMethod,
    path: string,
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): void {
    this.routes.push({
      method,
      path,
      register: (app, tags) =>
        addRoute(app, method, path, { ...operation, tags: operation.tags ?? tags }),
    });
  }

  list<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ListOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("get", this.collectionPath, operation);

    return this;
  }

  create<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("post", this.collectionPath, operation);

    return this;
  }

  read<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("get", this.itemPath, operation);

    return this;
  }

  update<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("patch", this.itemPath, operation);

    return this;
  }

  delete<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("delete", this.itemPath, operation);

    return this;
  }

  deleteAll<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("delete", this.collectionPath, operation);

    return this;
  }

  action<TBody = unknown, TParams = unknown, TQuery = unknown>(
    name: string,
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("post", joinPath(this.itemPath, name), operation);

    return this;
  }

  collectionAction<TBody = unknown, TParams = unknown, TQuery = unknown>(
    name: string,
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("post", joinPath(this.collectionPath, name), operation);

    return this;
  }

  view<TBody = unknown, TParams = unknown, TQuery = unknown>(
    name: string,
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.add("get", joinPath(this.collectionPath, name), operation);

    return this;
  }

  shared<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
    suffix?: string,
  ): this {
    const sharedPath = joinPath(this.collectionPath, "shared/:token");

    this.add("get", suffix ? joinPath(sharedPath, suffix) : sharedPath, operation);

    return this;
  }

  sub(name: string, idParam: string): ResourceBuilder {
    return new ResourceBuilder(this.routes, joinPath(this.itemPath, name), idParam);
  }

  collection(name: string, idParam: string): ResourceBuilder {
    return new ResourceBuilder(this.routes, joinPath(this.collectionPath, name), idParam);
  }

  singleton(name: string): SingletonBuilder {
    return new SingletonBuilder(this.routes, joinPath(this.itemPath, name));
  }

  revisioned(): RevisionsBuilder {
    return new RevisionsBuilder(this);
  }
}

export class RevisionsBuilder {
  private readonly revisions: ResourceBuilder;

  constructor(private readonly item: ResourceBuilder) {
    this.revisions = item.sub("revisions", "revision_id");
  }

  list<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ListOperation<TBody, TParams, TQuery>,
  ): this {
    this.revisions.list(operation);

    return this;
  }

  read<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.revisions.read(operation);

    return this;
  }

  restore<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.revisions.action("restore", operation);

    return this;
  }

  draft<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.item.singleton("draft").update(operation);

    return this;
  }

  promote<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.item.action("promote", operation);

    return this;
  }

  rollback<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.item.action("rollback", operation);

    return this;
  }
}

export class SingletonBuilder {
  constructor(
    private readonly routes: PendingRoute[],
    readonly path: string,
  ) {}

  private add<TBody, TParams, TQuery>(
    method: ResourceMethod,
    path: string,
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    this.routes.push({
      method,
      path,
      register: (app, tags) =>
        addRoute(app, method, path, { ...operation, tags: operation.tags ?? tags }),
    });

    return this;
  }

  read<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    return this.add("get", this.path, operation);
  }

  create<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    return this.add("post", this.path, operation);
  }

  update<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    return this.add("patch", this.path, operation);
  }

  delete<TBody = unknown, TParams = unknown, TQuery = unknown>(
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    return this.add("delete", this.path, operation);
  }

  action<TBody = unknown, TParams = unknown, TQuery = unknown>(
    name: string,
    operation: ResourceOperation<TBody, TParams, TQuery>,
  ): this {
    return this.add("post", joinPath(this.path, name), operation);
  }
}

export function defineResource(
  app: HonoLike,
  options: ResourceOptions & { idParam: string; path?: string },
  define: (resource: ResourceBuilder) => void,
): void {
  const routes: PendingRoute[] = [];

  define(new ResourceBuilder(routes, options.path ?? "/", options.idParam));

  const ordered = routes
    .map((route, index) => ({ route, index }))
    .sort(
      (left, right) =>
        compareSegments(left.route.path, right.route.path) || left.index - right.index,
    );

  for (const { route } of ordered) {
    route.register(app, options.tags);
  }
}

export function defineSingleton(
  app: HonoLike,
  options: ResourceOptions & { path?: string },
  define: (singleton: SingletonBuilder) => void,
): void {
  const routes: PendingRoute[] = [];

  define(new SingletonBuilder(routes, options.path ?? "/"));

  for (const route of routes) {
    route.register(app, options.tags);
  }
}
