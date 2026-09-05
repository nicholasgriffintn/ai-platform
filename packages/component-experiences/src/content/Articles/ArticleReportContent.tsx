import { Markdown } from "@ngriffin_uk/polychat-component-content";
import type { ArticleReportItem } from "@ngriffin_uk/polychat-schemas";
import { FileText } from "lucide-react";

interface ArticleReportContentProps {
  report: ArticleReportItem;
}

export function ArticleReportContent({ report }: ArticleReportContentProps) {
  return (
    <div className="border-border bg-surface rounded-lg border p-5 shadow-sm">
      <h3 className="text-lg font-medium mb-4 flex items-center text-foreground">
        <FileText size={18} className="mr-2 text-active-work" />
        Report Content
      </h3>
      {report.content.report?.content ? (
        <div className="prose dark:prose-invert border-border bg-surface-elevated max-w-none rounded-lg border p-5">
          <Markdown>{report.content.report.content}</Markdown>
        </div>
      ) : (
        <p className="bg-surface-elevated text-muted-foreground rounded-lg p-4 italic">
          No report content available.
        </p>
      )}
    </div>
  );
}
