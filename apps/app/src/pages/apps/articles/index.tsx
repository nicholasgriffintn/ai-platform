import { ArrowLeft, FileSpreadsheet, Plus } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router";

import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button } from "~/components/ui";
import { useFetchArticleReports } from "~/hooks/useArticles";
import { SidebarLayout } from "~/layouts/SidebarLayout";
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
    <SidebarLayout sidebarContent={<StandardSidebarContent />}>
      <div className={cn("container mx-auto px-4 py-8 max-w-6xl")}>
        <div className={cn("flex justify-between items-center mb-8")}>
          <div>
            <Link
              to="/apps"
              className={cn(
                "no-underline flex items-center text-blue-500 dark:text-blue-400 mb-2 hover:underline",
              )}
            >
              <ArrowLeft size={16} className="mr-1" />
              <span>Back to Apps</span>
            </Link>
            <h1
              className={cn(
                "text-2xl font-bold text-zinc-900 dark:text-zinc-50",
              )}
            >
              Article Reports
            </h1>
          </div>
          <Button
            onClick={handleNewAnalysis}
            variant="primary"
            icon={<Plus size={16} />}
          >
            New Analysis
          </Button>
        </div>

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
              {error instanceof Error
                ? error.message
                : "Unknown error occurred"}
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
          <div className={cn("p-4 bg-gray-100 dark:bg-gray-800 rounded-md")}>
            Data unavailable.
          </div>
        ) : reports.length === 0 ? (
          <div
            className={cn(
              "bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-8 text-center",
            )}
          >
            <h3
              className={cn(
                "text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200",
              )}
            >
              No reports yet
            </h3>
            <p className={cn("text-zinc-600 dark:text-zinc-400 mb-6")}>
              Start a new analysis session to compare multiple articles.
            </p>
            <Button
              onClick={handleNewAnalysis}
              variant="primary"
              icon={<Plus size={16} />}
            >
              Start New Analysis
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
            )}
          >
            {reports.map((report) => (
              <Link
                key={report.id}
                to={`/apps/articles/${report.id}`}
                className={cn(
                  "border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-off-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600",
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
