import type { ArticleReportItem } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

export interface ArticleReportHeaderProps {
  report: ArticleReportItem;
  isShared?: boolean;
  rerunControl?: ReactNode;
}

export function ArticleReportHeader({ report, isShared, rerunControl }: ArticleReportHeaderProps) {
  return (
    <div className="border-border bg-surface rounded-lg border p-5 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          {report.content.title || report.title || `Report (ID: ${report.id})`}
        </h2>
        {!isShared && rerunControl}
      </div>
    </div>
  );
}
