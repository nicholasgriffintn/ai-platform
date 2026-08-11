import { FileText, Plus } from "lucide-react";
import { Link } from "react-router";

import { ArticleAnalysisSession } from "~/components/Apps/Articles/ArticleAnalysisSession";
import { ArticleView } from "~/components/Apps/Articles/View";
import { EmptyState } from "~/components/Core/EmptyState";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Button, Card } from "~/components/ui";
import { useFetchArticleReport, useFetchArticleReports } from "~/hooks/useArticles";
import { WorkCardGridSkeleton } from "../WorkLoadingSkeletons";
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
		if (isReportLoading) return <WorkCardGridSkeleton count={1} label="Loading article report" />;
		if (isAuthenticationError(reportError)) {
			return (
				<SignInEmptyState
					title="Sign in to view this report"
					message="Sign in to access this project report."
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
		const sourceIds = report.data?.sourceItemIds ?? report.source_item_ids ?? [];
		return (
			<ArticleView
				report={report}
				sourceIds={sourceIds}
				basePath={basePath}
				projectId={projectId}
			/>
		);
	}
	if (isLoading) return <WorkCardGridSkeleton count={4} label="Loading article reports" />;
	if (isAuthenticationError(error)) {
		return (
			<SignInEmptyState
				title="Sign in to view project reports"
				message="Sign in to access the reports in this project."
			/>
		);
	}
	if (error) return <EmptyState title="Article reports unavailable" message={error.message} />;
	if (!reports?.length) {
		return (
			<EmptyState
				icon={<FileText size={24} className="text-zinc-400" />}
				title="No project reports"
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
		<div>
			<div className="mb-5 flex justify-end">
				<Link to={`${basePath}/new`}>
					<Button variant="primary" icon={<Plus size={16} />}>
						New report
					</Button>
				</Link>
			</div>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{reports.map((item) => (
					<Link
						key={item.id}
						to={`${basePath}/${item.id}`}
						className="group no-underline hover:!no-underline"
					>
						<Card className="h-full gap-3 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
							<h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
								{item.data?.title || item.title || "Article report"}
							</h2>
							<p className="line-clamp-3 text-sm leading-6 text-zinc-500">
								{item.data?.report?.content ||
									item.summary?.content ||
									"Open this report to review its analysis."}
							</p>
							<p className="mt-auto pt-3 text-xs text-zinc-400">
								{item.data?.sourceArticleCount ?? item.source_article_count ?? 0} sources ·{" "}
								{new Date(item.updated_at).toLocaleDateString()}
							</p>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}

interface ExperienceProps {
	basePath: string;
	projectId: string;
	subpath: string;
}
