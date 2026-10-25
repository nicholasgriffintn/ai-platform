import type { ListPage } from "@ngriffin_uk/polychat-schemas";

import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { getHeaders } from "./utils/headers.js";

export type ResourceQuery = Record<string, string | number | boolean | null | undefined>;

export interface ResourceClient<
  TItem,
  TCreate extends object = object,
  TUpdate extends object = object,
> {
  readonly path: string;
  list(query?: ResourceQuery): Promise<ListPage<TItem>>;
  listAll(query?: ResourceQuery): Promise<TItem[]>;
  get(id: string, query?: ResourceQuery): Promise<TItem>;
  create(body?: TCreate): Promise<TItem>;
  update(id: string, body: TUpdate): Promise<TItem>;
  delete(id: string): Promise<void>;
  action<TResult = TItem>(id: string, name: string, body?: BodyInit | object): Promise<TResult>;
  collectionAction<TResult = unknown>(name: string, body?: BodyInit | object): Promise<TResult>;
  view<TResult>(name: string, query?: ResourceQuery): Promise<TResult>;
  sub<TSubItem, TSubCreate extends object = object, TSubUpdate extends object = object>(
    id: string,
    name: string,
  ): ResourceClient<TSubItem, TSubCreate, TSubUpdate>;
  singleton<TValue, TUpdateValue extends object = object>(
    id: string,
    name: string,
  ): SingletonClient<TValue, TUpdateValue>;
}

export interface SingletonClient<TValue, TUpdate extends object = object> {
  readonly path: string;
  get(query?: ResourceQuery): Promise<TValue>;
  create<TResult = TValue>(body?: BodyInit | object): Promise<TResult>;
  update(body: TUpdate): Promise<TValue>;
  delete<TResult = void>(): Promise<TResult>;
  action<TResult = TValue>(name: string, body?: BodyInit | object): Promise<TResult>;
}

export function withQuery(path: string, query?: ResourceQuery): string {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return search ? `${path}?${search}` : path;
}

export interface RequestJsonOptions {
  timeoutMs?: number | null;
}

export async function requestJson<TResult>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: BodyInit | object,
  options: RequestJsonOptions = {},
): Promise<TResult> {
  const response = await fetchApiOrThrow(path, {
    method,
    headers: await getHeaders(),
    ...(body === undefined ? {} : { body }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  const text = await response.text();

  return JSON.parse(text || "null");
}

export async function requestBlob(path: string): Promise<Blob> {
  const response = await fetchApiOrThrow(path, { method: "GET", headers: await getHeaders() });

  return response.blob();
}

function itemPath(path: string, id: string): string {
  return `${path}/${encodeURIComponent(id)}`;
}

export function singleton<TValue, TUpdate extends object = object>(
  path: string,
): SingletonClient<TValue, TUpdate> {
  return {
    path,
    get: (query) => requestJson<TValue>(withQuery(path, query), "GET"),
    create: <TResult = TValue>(body?: BodyInit | object) =>
      requestJson<TResult>(path, "POST", body ?? {}),
    update: (body) => requestJson<TValue>(path, "PATCH", body),
    delete: <TResult = void>() => requestJson<TResult>(path, "DELETE"),
    action: <TResult = TValue>(name: string, body?: BodyInit | object) =>
      requestJson<TResult>(`${path}/${name}`, "POST", body ?? {}),
  };
}

export function resource<TItem, TCreate extends object = object, TUpdate extends object = object>(
  path: string,
): ResourceClient<TItem, TCreate, TUpdate> {
  const client: ResourceClient<TItem, TCreate, TUpdate> = {
    path,
    list: (query) => requestJson<ListPage<TItem>>(withQuery(path, query), "GET"),
    async listAll(query) {
      const items: TItem[] = [];
      let after: string | undefined;

      for (;;) {
        const page = await client.list({ ...query, after });

        items.push(...page.data);

        if (!page.has_more || !page.last_id) {
          return items;
        }

        after = page.last_id;
      }
    },
    get: (id, query) => requestJson<TItem>(withQuery(itemPath(path, id), query), "GET"),
    create: (body) => requestJson<TItem>(path, "POST", body ?? {}),
    update: (id, body) => requestJson<TItem>(itemPath(path, id), "PATCH", body),
    delete: async (id) => {
      await requestJson<unknown>(itemPath(path, id), "DELETE");
    },
    action: <TResult = TItem>(id: string, name: string, body?: BodyInit | object) =>
      requestJson<TResult>(`${itemPath(path, id)}/${name}`, "POST", body ?? {}),
    collectionAction: <TResult = unknown>(name: string, body?: BodyInit | object) =>
      requestJson<TResult>(`${path}/${name}`, "POST", body ?? {}),
    view: <TResult>(name: string, query?: ResourceQuery) =>
      requestJson<TResult>(withQuery(`${path}/${name}`, query), "GET"),
    sub: <TSubItem, TSubCreate extends object = object, TSubUpdate extends object = object>(
      id: string,
      name: string,
    ) => resource<TSubItem, TSubCreate, TSubUpdate>(`${itemPath(path, id)}/${name}`),
    singleton: <TValue, TUpdateValue extends object = object>(id: string, name: string) =>
      singleton<TValue, TUpdateValue>(`${itemPath(path, id)}/${name}`),
  };

  return client;
}
