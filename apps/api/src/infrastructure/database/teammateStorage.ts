export const SHARED_TEAMMATE_COLUMNS = `sa.publication_id AS id, sa.source_teammate_id AS teammate_id,
  sa.created_by_user_id AS user_id, sa.name, sa.description, sa.avatar_url, sa.category,
  sa.tags, sa.is_featured, sa.is_public, sa.usage_count, sa.rating_count, sa.rating_average,
  sa.configuration AS template_data, sa.created_at, sa.updated_at`;

export const TEAMMATE_INSTALL_COLUMNS = `id, publication_id AS shared_teammate_id, user_id,
  teammate_id, created_at`;

export const TEAMMATE_RATING_COLUMNS = `ar.id, ar.publication_id AS shared_teammate_id,
  ar.user_id, ar.rating, ar.note AS review, ar.created_at, ar.updated_at`;
