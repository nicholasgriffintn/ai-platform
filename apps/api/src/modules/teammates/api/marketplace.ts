import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  listPageOf,
  queryBooleanSchema,
  moderateTeammateSchema,
  rateTeammateSchema,
  setTeammateFeaturedSchema,
  shareTeammateSchema,
  sharedTeammateFiltersSchema,
  teammateRatingsSchema,
  toListPage,
  updateSharedTeammateSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { requireAdmin, requireStrictAdmin } from "~/middleware/adminMiddleware";
import {
  getAllSharedTeammatesForAdmin,
  moderateTeammate,
  setTeammateFeaturedStatus,
} from "~/modules/admin/application/sharedTeammates";
import {
  deleteSharedTeammate,
  getSharedTeammateById,
  getSharedTeammateCategories,
  getSharedTeammatePopularTags,
  getSharedTeammateRatings,
  getSharedTeammates,
  getVisibleSharedTeammateByTeammateId,
  installSharedTeammate,
  rateSharedTeammate,
  shareTeammate,
  uninstallSharedTeammate,
  updateSharedTeammate,
} from "~/modules/teammates/application/shared";

const listingParamsSchema = z.object({ listing_id: z.string().min(1) });
const listingsQuerySchema = sharedTeammateFiltersSchema.extend({
  teammate_id: z.string().min(1).optional(),
  review: queryBooleanSchema.optional(),
});

function requireSucceeded<TData>(result: { success: boolean; error?: string; data?: TData }) {
  if (!result.success) {
    throw new AssistantError(
      result.error ?? "The listing could not be changed",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return result.data;
}

export function defineMarketplace(app: HonoLike): void {
  defineResource(
    app,
    { path: "/marketplace", idParam: "listing_id", tags: ["teammates"] },
    (listings) => {
      listings
        .list({
          auth: "user-or-anonymous",
          summary: "List shared teammates",
          description:
            "Published teammates, newest first. Filter by category, tags, search, featured or the source teammate. Categories and popular tags come back with the page. Admins pass review=true for every listing, public or not.",
          querySchema: listingsQuerySchema,
          handler: async ({ serviceContext, query, user }) => {
            if (query.review) {
              if (!authorise("platform.admin", { role: user?.role ?? "", strict: false }).allowed) {
                throw new AssistantError("Admin access required", ErrorType.FORBIDDEN, 403);
              }

              return listPageOf(
                await getAllSharedTeammatesForAdmin({ context: serviceContext }),
                (listing) => (typeof listing.id === "string" ? listing.id : ""),
              );
            }

            const limit = query.limit ?? 20;
            const [listed, categories, tags] = await Promise.all([
              query.teammate_id
                ? getVisibleSharedTeammateByTeammateId(
                    serviceContext,
                    query.teammate_id,
                    user?.id,
                  ).then((listing) => (listing ? [listing] : []))
                : getSharedTeammates(serviceContext, {
                    category: query.category,
                    tags: query.tags,
                    search: query.search,
                    featured: query.featured,
                    limit: limit + 1,
                    offset: query.offset,
                    sortBy: query.sort_by,
                  }),
              getSharedTeammateCategories(serviceContext),
              getSharedTeammatePopularTags(serviceContext),
            ]);

            return {
              ...toListPage(listed, limit, (listing) => listing.id),
              categories,
              tags,
            };
          },
        })
        .create({
          auth: true,
          summary: "Share a teammate",
          bodySchema: shareTeammateSchema,
          handler: ({ serviceContext, body, user }) =>
            shareTeammate(
              serviceContext,
              {
                teammateId: body.agent_id,
                name: body.name,
                avatarUrl: body.avatar_url,
                category: body.category,
              },
              user.id,
            ),
        })
        .read({
          auth: "user-or-anonymous",
          summary: "Get a shared teammate",
          paramSchema: listingParamsSchema,
          handler: async ({ serviceContext, params }) => {
            const listing = await getSharedTeammateById(serviceContext, params.listing_id);

            if (!listing) {
              throw new AssistantError("Shared teammate not found", ErrorType.NOT_FOUND, 404);
            }

            return listing;
          },
        })
        .update({
          auth: true,
          summary: "Update a shared teammate",
          paramSchema: listingParamsSchema,
          bodySchema: updateSharedTeammateSchema,
          handler: async ({ serviceContext, params, body, user }) => {
            await updateSharedTeammate(serviceContext, params.listing_id, body, user.id);

            return getSharedTeammateById(serviceContext, params.listing_id);
          },
        })
        .delete({
          auth: true,
          summary: "Stop sharing a teammate",
          paramSchema: listingParamsSchema,
          handler: async ({ serviceContext, params, user }) => {
            await deleteSharedTeammate(serviceContext, params.listing_id, user.id);

            return { deleted: true };
          },
        })
        .action("install", {
          auth: true,
          summary: "Install a shared teammate",
          paramSchema: listingParamsSchema,
          handler: ({ serviceContext, params, user }) =>
            installSharedTeammate(serviceContext, params.listing_id, user.id),
        })
        .action("uninstall", {
          auth: true,
          summary: "Uninstall a shared teammate",
          paramSchema: listingParamsSchema,
          handler: async ({ serviceContext, params, user }) => {
            await uninstallSharedTeammate(serviceContext, params.listing_id, user.id);

            return { uninstalled: true };
          },
        })
        .action("rate", {
          auth: true,
          summary: "Rate a shared teammate",
          paramSchema: listingParamsSchema,
          bodySchema: rateTeammateSchema,
          handler: ({ serviceContext, params, body, user }) =>
            rateSharedTeammate(
              serviceContext,
              params.listing_id,
              body.rating,
              body.review,
              user.id,
            ),
        })
        .action("feature", {
          auth: true,
          summary: "Feature or unfeature a listing",
          description: "Admins only.",
          middleware: [requireStrictAdmin],
          paramSchema: listingParamsSchema,
          bodySchema: setTeammateFeaturedSchema,
          handler: async ({ serviceContext, params, body, user }) =>
            requireSucceeded(
              await setTeammateFeaturedStatus({
                context: serviceContext,
                env: serviceContext.env,
                teammateId: params.listing_id,
                featured: body.featured,
                moderator: user,
              }),
            ),
        })
        .action("moderate", {
          auth: true,
          summary: "Approve or reject a listing",
          description: "Admins only.",
          middleware: [requireAdmin],
          paramSchema: listingParamsSchema,
          bodySchema: moderateTeammateSchema,
          handler: async ({ serviceContext, params, body, user }) =>
            requireSucceeded(
              await moderateTeammate({
                context: serviceContext,
                env: serviceContext.env,
                teammateId: params.listing_id,
                isPublic: body.is_public,
                reason: body.reason,
                moderator: user,
              }),
            ),
        });

      listings.sub("ratings", "rating_id").list({
        auth: "user-or-anonymous",
        summary: "List a listing's ratings",
        paramSchema: listingParamsSchema,
        querySchema: teammateRatingsSchema,
        handler: async ({ serviceContext, params, query }) =>
          listPageOf(
            await getSharedTeammateRatings(serviceContext, params.listing_id, query.limit),
            (rating) => rating.id,
          ),
      });
    },
  );
}
