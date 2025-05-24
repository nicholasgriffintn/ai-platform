import type { ArticleReportItem } from "~/types/article";
import { RerunReportButton } from "./RerunReportButton";

interface ArticleReportHeaderProps {
  report: ArticleReportItem;
}

export function ArticleReportHeader({ report }: ArticleReportHeaderProps) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {report.data?.title || `Report (ID: ${report.id})`}
        </h2>
        <RerunReportButton
          sourceIds={report.data?.sourceItemIds || []}
          itemId={report.item_id || ""}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full">
          <span className="text-zinc-500 dark:text-zinc-400 mr-2">
            Session ID:
          </span>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {report.item_id || "N/A"}
          </span>
        </div>
        <div className="flex items-center px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full">
          <span className="text-zinc-500 dark:text-zinc-400 mr-2">
            Created:
          </span>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {new Date(report.created_at).toLocaleString()}
          </span>
        </div>
        {report.data?.sourceItemIds && (
          <div className="flex items-center px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full">
            <span className="text-zinc-500 dark:text-zinc-400 mr-2">
              Source Articles:
            </span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {report.data.sourceItemIds.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
