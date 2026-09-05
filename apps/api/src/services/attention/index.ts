import type { WorkAttentionQuery } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireWorkAccess } from "~/services/workspaces/access";

export async function listWorkAttention(context: ServiceContext, query: WorkAttentionQuery) {
  const user = requireWorkAccess(context);
  const [{ items, total }, facets] = await Promise.all([
    context.repositories.attention.list(user.id, query),
    context.repositories.attention.listFacets(user.id),
  ]);

  return {
    items,
    total,
    hasMore: query.offset + items.length < total,
    facets,
  };
}
