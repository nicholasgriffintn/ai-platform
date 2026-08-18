import { ArticleSourceArticleList } from "@ngriffin_uk/polychat-component-experiences/content";

import { useFetchSourceArticlesByIds } from "~/hooks/useArticles";

interface ArticleSourceArticlesProps {
  sourceIds: string[];
  projectId?: string;
}

export function ArticleSourceArticles({ sourceIds, projectId }: ArticleSourceArticlesProps) {
  const { data: sourceArticles, isLoading } = useFetchSourceArticlesByIds(sourceIds, projectId);

  return (
    <ArticleSourceArticleList
      sourceArticles={sourceArticles}
      sourceCount={sourceIds.length}
      isLoading={isLoading}
    />
  );
}
