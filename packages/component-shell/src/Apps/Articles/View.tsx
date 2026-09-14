import {
  ArticleReportContent,
  ArticleReportHeader,
  ArticleReportMetadata,
} from "@ngriffin_uk/polychat-component-experiences/content";
import type { ArticleReportItem } from "@ngriffin_uk/polychat-schemas";

import { ArticleSourceArticles } from "./ArticleSourceArticles.js";
import { RerunReportButton } from "./RerunReportButton.js";

export function ArticleView({
  report,
  sourceIds,
  basePath,
  projectId,
}: {
  report: ArticleReportItem;
  sourceIds: string[];
  basePath: string;
  projectId?: string;
}) {
  return (
    <div className="space-y-6">
      <ArticleReportHeader
        report={report}
        rerunControl={
          <RerunReportButton
            basePath={basePath}
            projectId={projectId}
            sourceIds={report.content.sourceItemIds || []}
            itemId={report.groupId || ""}
          />
        }
      />
      <ArticleReportContent report={report} />
      <ArticleSourceArticles sourceIds={sourceIds} projectId={projectId} />
      <ArticleReportMetadata report={report} />
    </div>
  );
}
