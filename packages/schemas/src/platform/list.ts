import z from "zod/v4";

export const LIST_DEFAULT_LIMIT = 25;
export const LIST_MAX_LIMIT = 100;

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_MAX_LIMIT).optional().default(LIST_DEFAULT_LIMIT),
  after: z.string().min(1).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function listSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    object: z.literal("list"),
    data: z.array(item),
    has_more: z.boolean(),
    last_id: z.string().nullable(),
  });
}

export interface ListPage<TItem> {
  object: "list";
  data: TItem[];
  has_more: boolean;
  last_id: string | null;
}

export function toListPage<TItem>(
  rows: readonly TItem[],
  limit: number,
  idOf: (item: TItem) => string,
): ListPage<TItem> {
  const data = rows.slice(0, limit);
  const last = data.at(-1);

  return {
    object: "list",
    data,
    has_more: rows.length > limit,
    last_id: last === undefined ? null : idOf(last),
  };
}

export function mapListPage<TFrom, TTo>(
  page: ListPage<TFrom>,
  present: (item: TFrom) => TTo,
): ListPage<TTo> {
  return { ...page, data: page.data.map(present) };
}

export function listPageOf<TItem>(
  items: readonly TItem[],
  idOf: (item: TItem) => string,
): ListPage<TItem> {
  return toListPage(items, items.length, idOf);
}

export function nextPageCursor(page: Pick<ListPage<unknown>, "has_more" | "last_id">) {
  return page.has_more && page.last_id ? page.last_id : undefined;
}
