import { ArticleReportGrid } from "@ngriffin_uk/polychat-component-experiences/content";
import { Button, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { FileText, Plus } from "lucide-react";
import { Link } from "react-router";

import { ArticleAnalysisSession } from "~/components/Apps/Articles/ArticleAnalysisSession";
import { ArticleView } from "~/components/Apps/Articles/View";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useFetchArticleReport, useFetchArticleReports } from "~/hooks/useArticles";
import { isAuthenticationError } from "~/lib/errors";

export function ArticlesExperience({ basePath, projectId, subpath }: ExperienceProps) {
  const segments = subpath.split("/").filter(Boolean);
  const articleId = segments[0] && segments[0] !== "new" ? segments[0] : undefined;
  const isNew = segments[0] === "new";
  const {
    data: reports,
    isLoading,
    error,
  } = useFetchArticleReports(projectId, {
    enabled: !isNew && !articleId,
  });
  const {
    data: report,
    isLoading: isReportLoading,
    error: reportError,
  } = useFetchArticleReport(articleId, projectId);

  if (isNew) return <ArticleAnalysisSession basePath={basePath} projectId={projectId} />;
  if (articleId) {
    if (isReportLoading)
      return <CardGridLoadingSkeleton count={1} label="Loading article report" />;
    if (isAuthenticationError(reportError)) {
      return (
        <SignInEmptyState
          title="Sign in to view this report"
          message="Sign in to open this report."
        />
      );
    }
    if (reportError || !report)
      return (
        <EmptyState
          title="Report unavailable"
          message={reportError?.message ?? "Article report not found"}
        />
      );
    const sourceIds = report.content.sourceItemIds ?? [];
    return (
      <ArticleView
        report={report}
        sourceIds={sourceIds}
        basePath={basePath}
        projectId={projectId}
      />
    );
  }
  if (isLoading) return <CardGridLoadingSkeleton count={4} label="Loading article reports" />;
  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view reports"
        message="Article reports are kept against your account."
      />
    );
  }
  if (error) return <EmptyState title="Article reports unavailable" message={error.message} />;
  if (!reports?.length) {
    return (
      <EmptyState
        icon={<FileText size={24} className="text-zinc-400" />}
        title="No reports yet"
        message="Analyse one or more source URLs to create a reusable report."
        action={
          <Link to={`${basePath}/new`}>
            <Button variant="primary" icon={<Plus size={16} />}>
              New report
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <ArticleReportGrid
      reports={reports.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        sourceCount: item.sourceCount,
        createdAt: item.createdAt,
        href: `${basePath}/${item.id}`,
      }))}
      newReportHref={`${basePath}/new`}
    />
  );
}

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}
