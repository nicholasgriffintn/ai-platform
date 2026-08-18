import { Button, Card, Link } from "@ngriffin_uk/polychat-component-ui";
import { Plus } from "lucide-react";

export interface ArticleReportSummary {
  id?: string;
  title?: string | null;
  status?: string;
  sourceCount?: number;
  createdAt: string;
  href: string;
}

export interface ArticleReportGridProps {
  reports: ArticleReportSummary[];
  newReportHref: string;
}

export function ArticleReportGrid({ reports, newReportHref }: ArticleReportGridProps) {
  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Link href={newReportHref}>
          <Button variant="primary" icon={<Plus size={16} />}>
            New report
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((item) => (
          <Link key={item.id} href={item.href} className="group no-underline hover:!no-underline">
            <Card className="h-full gap-3 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
              <h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
                {item.title || "Article report"}
              </h2>
              <p className="line-clamp-3 text-sm leading-6 text-zinc-500">
                {item.status === "complete"
                  ? "Open this report to review its analysis."
                  : "This report is still being generated."}
              </p>
              <p className="mt-auto pt-3 text-xs text-zinc-400">
                {item.sourceCount ?? 0} sources · {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
