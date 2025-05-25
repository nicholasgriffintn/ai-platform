import type { ArticleReportItem } from "~/types";
import { ArticleReportContent } from "./ArticleReportContent";
import { ArticleReportHeader } from "./ArticleReportHeader";
import { ArticleReportMetadata } from "./ArticleReportMetadata";
import { ArticleSourceArticles } from "./ArticleSourceArticles";

export function ArticleView({
  report,
  sourceIds,
  isShared,
}: {
  report: ArticleReportItem;
  sourceIds: string[];
  isShared?: boolean;
}) {
  return (
    <div className="space-y-6">
      <ArticleReportHeader report={report} isShared={isShared} />
      <ArticleReportContent report={report} />
      <ArticleSourceArticles sourceIds={sourceIds} />
      <ArticleReportMetadata report={report} />
    </div>
  );
}
