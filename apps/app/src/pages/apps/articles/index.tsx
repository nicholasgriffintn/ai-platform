import { FileSpreadsheet, Plus } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button, Card } from "~/components/ui";
import { useFetchArticleReports } from "~/hooks/useArticles";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Article Reports - Polychat" },
    {
      name: "description",
      content: "View your generated article comparison reports",
    },
  ];
}

export default function ArticlesReportsListPage() {
  const navigate = useNavigate();
  const { data: reports, isLoading, error } = useFetchArticleReports();

  const handleNewAnalysis = useCallback(() => {
    navigate("/apps/articles/new");
  }, [navigate]);

  return (
    <PageShell
      sidebarContent={<AppsSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <PageHeader
          actions={[
            {
              label: "New Analysis",
              onClick: handleNewAnalysis,
              icon: <Plus size={16} />,
            },
          ]}
        >
          <BackLink to="/apps" label="Back to Apps" />
          <PageTitle title="Article Reports" />
        </PageHeader>
      }
      isBeta={true}
    >
      {isLoading ? (
        <div className={cn("flex justify-center items-center min-h-[400px]")}>
          <div
            className={cn(
              "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400",
            )}
          />
        </div>
      ) : error ? (
        <div
          className={cn(
            "p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800",
          )}
        >
          <h3 className={cn("font-semibold mb-2")}>Failed to load reports</h3>
          <p>
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      ) : !reports ? (
        <EmptyState
          title="Data unavailable"
          message="Could not retrieve report data at this time."
          className="min-h-[400px]"
        />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          message="Start a new analysis session to compare multiple articles."
          action={
            <Button
              onClick={handleNewAnalysis}
              variant="primary"
              icon={<Plus size={16} />}
            >
              Start New Analysis
            </Button>
          }
          className="min-h-[400px]"
        />
      ) : (
        <div
          className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")}
        >
          {reports.map((report) => (
            <Link
              key={report.id}
              to={`/apps/articles/${report.id}`}
              className="block focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl"
            >
              <Card
                className={cn(
                  "p-5 h-full",
                  "hover:shadow-lg transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600",
                )}
              >
                <div
                  className={cn(
                    "relative aspect-video w-full rounded-lg overflow-hidden mb-4 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center",
                  )}
                >
                  <FileSpreadsheet
                    size={32}
                    className={cn("text-zinc-500 dark:text-zinc-400")}
                  />
                  {report?.source_article_count &&
                  report.source_article_count > 0 ? (
                    <div
                      className={cn(
                        "absolute top-2 right-2 px-2 py-1 text-xs rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300",
                      )}
                    >
                      {report.source_article_count} Articles
                    </div>
                  ) : null}
                </div>
                <h3
                  className={cn(
                    "font-semibold text-lg mb-1 text-zinc-800 dark:text-zinc-200",
                  )}
                >
                  {report.title || `Report (ID: ${report.id})`}
                </h3>
                <p className={cn("text-sm text-zinc-500 dark:text-zinc-400")}>
                  {new Date(report.created_at).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
