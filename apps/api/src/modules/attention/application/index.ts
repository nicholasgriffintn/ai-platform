import { toListPage, type WorkAttentionQuery } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AttentionRepository } from "~/modules/attention/infrastructure/AttentionRepository";
import { requireWorkAccess } from "~/modules/workspaces/application/access";

export async function listWorkAttentionPage(context: ServiceContext, query: WorkAttentionQuery) {
  const user = requireWorkAccess(context);
  const { items, total } = await context.repositories.get(AttentionRepository).list(user.id, query);

  return { ...toListPage(items, query.limit, (item) => item.id), total };
}

export async function listWorkAttention(context: ServiceContext, query: WorkAttentionQuery) {
  const user = requireWorkAccess(context);
  const [page, facets] = await Promise.all([
    listWorkAttentionPage(context, query),
    context.repositories.get(AttentionRepository).listFacets(user.id),
  ]);

  return { ...page, facets };
}
