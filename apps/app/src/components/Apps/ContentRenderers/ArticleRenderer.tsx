import { ArticleView } from "~/components/Apps/Articles/View";
import type { ArticleReportItem } from "~/types";

interface ArticleRendererProps {
  data: ArticleReportItem;
}

export const ArticleRenderer = ({ data }: ArticleRendererProps) => {
  return (
    <ArticleView
      report={data}
      sourceIds={data.data.sourceItemIds || []}
      isShared={true}
    />
  );
};
