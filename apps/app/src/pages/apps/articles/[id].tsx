"use client";

import { Info, Loader2 } from "lucide-react";
import { useParams } from "react-router";

import { ArticleView } from "~/components/Apps/Articles/View";
import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { ShareButton } from "~/components/ui/ShareButton";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { useFetchArticleReport } from "~/hooks/useArticles";

export function meta({ params }: { params: { id?: string } }) {
  return [
    { title: `Article Report ${params.id || ""} - Polychat` },
    {
      name: "description",
      content: `Details for article comparison report ${params.id || ""}`,
    },
  ];
}

export default function ArticleReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, error } = useFetchArticleReport(id);
  const sourceIds = report?.data?.sourceItemIds || [];

  if (isLoading) {
    return (
      <PageShell sidebarContent={<AppsSidebarContent />} className="max-w-4xl">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="flex flex-col items-center">
            <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400">
              Loading report data...
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell
        sidebarContent={<AppsSidebarContent />}
        className="max-w-4xl"
        headerContent={
          <PageHeader>
            <BackLink to="/apps/articles" label="Back to Reports List" />
            <PageTitle title="Article Report Details" />
          </PageHeader>
        }
      >
        <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
          <div className="flex items-start">
            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-full mr-4">
              <Info size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                Error Loading Report
              </h3>
              <p className="text-zinc-700 dark:text-zinc-300 mb-4">
                {error instanceof Error
                  ? error.message
                  : "Unknown error occurred"}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!report) {
    return (
      <PageShell
        sidebarContent={<AppsSidebarContent />}
        className="max-w-4xl"
        headerContent={
          <PageHeader>
            <BackLink to="/apps/articles" label="Back to Reports List" />
            <PageTitle title="Article Report Details" />
          </PageHeader>
        }
      >
        <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm text-center">
          <p className="text-zinc-600 dark:text-zinc-400">
            Report data not found.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      sidebarContent={<AppsSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <div className="flex justify-between items-center">
          <PageHeader>
            <BackLink to="/apps/articles" label="Back to Reports List" />
            <PageTitle title="Article Report Details" />
          </PageHeader>
          {id && <ShareButton appId={id} />}
        </div>
      }
      isBeta={true}
    >
      <ArticleView report={report} sourceIds={sourceIds} />
    </PageShell>
  );
}
