import { Markdown } from "@ngriffin_uk/polychat-component-content";
import type { ArticleReportItem } from "@ngriffin_uk/polychat-schemas";
import { FileText } from "lucide-react";

interface ArticleReportContentProps {
  report: ArticleReportItem;
}

export function ArticleReportContent({ report }: ArticleReportContentProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-4 flex items-center text-lg font-medium text-foreground">
        <FileText size={18} className="mr-2 text-active-work" />
        Report Content
      </h3>
      {report.content.report?.content ? (
        <div className="prose max-w-none rounded-lg border border-border bg-surface-elevated p-5 dark:prose-invert">
          <Markdown>{report.content.report.content}</Markdown>
        </div>
      ) : (
        <p className="rounded-lg bg-surface-elevated p-4 text-muted-foreground italic">
          No report content available.
        </p>
      )}
    </div>
  );
}
