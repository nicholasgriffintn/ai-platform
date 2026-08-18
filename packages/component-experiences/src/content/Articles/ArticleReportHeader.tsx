import type { ArticleReportItem } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

export interface ArticleReportHeaderProps {
  report: ArticleReportItem;
  isShared?: boolean;
  /** Host control that re-runs the analysis; omitted on shared, read-only reports. */
  rerunControl?: ReactNode;
}

export function ArticleReportHeader({ report, isShared, rerunControl }: ArticleReportHeaderProps) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {report.content.title || report.title || `Report (ID: ${report.id})`}
        </h2>
        {!isShared && rerunControl}
      </div>
    </div>
  );
}
