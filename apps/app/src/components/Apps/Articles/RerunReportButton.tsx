import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
	useAnalyseArticle,
	useFetchSourceArticlesByIds,
	useGenerateReport,
	usePrepareSessionForRerun,
	useSummariseArticle,
} from "~/hooks/useArticles";
import { cn } from "~/lib/utils";
import { getStringProperty, isRecord } from "@ngriffin_uk/polychat-utility-core";

interface RerunReportButtonProps {
	sourceIds: string[];
	itemId: string;
	className?: string;
	basePath?: string;
	projectId?: string;
}

export function RerunReportButton({
	basePath,
	className,
	itemId,
	projectId,
	sourceIds,
}: RerunReportButtonProps) {
	const navigate = useNavigate();
	const [isRerunning, setIsRerunning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState<{
		analyzing: boolean;
		summarizing: boolean;
		generating: boolean;
		completed: number;
		total: number;
	}>({
		analyzing: false,
		summarizing: false,
		generating: false,
		completed: 0,
		total: 0,
	});

	const analyseMutation = useAnalyseArticle(projectId);
	const summariseMutation = useSummariseArticle(projectId);
	const generateReportMutation = useGenerateReport(projectId);
	const prepareSessionMutation = usePrepareSessionForRerun(projectId);

	const { data: sourceArticles, isLoading: isLoadingSourceArticles } = useFetchSourceArticlesByIds(
		sourceIds,
		projectId,
	);

	const handleRerunAnalysis = async () => {
		if (!itemId || !sourceIds.length) {
			setError("Missing item ID or source articles");
			return;
		}

		if (isLoadingSourceArticles) {
			setError("Still loading source articles");
			return;
		}

		if (!sourceArticles || sourceArticles.length === 0) {
			setError("No source articles found");
			return;
		}

		try {
			setIsRerunning(true);
			setError(null);

			await prepareSessionMutation.mutateAsync(itemId);

			const articlesWithContent = sourceArticles
				.map((article) => ({
					id: article.id,
					content: isRecord(article.content)
						? getStringProperty(article.content, "originalArticle")
						: undefined,
				}))
				.filter((article): article is { id: string; content: string } => Boolean(article.content));

			if (articlesWithContent.length === 0) {
				throw new Error("Could not find original article content");
			}

			const totalSteps = articlesWithContent.length * 2 + 1;
			setProgress({
				analyzing: true,
				summarizing: false,
				generating: false,
				completed: 0,
				total: totalSteps,
			});

			const analysisPromises = articlesWithContent.map((article) =>
				analyseMutation.mutateAsync({
					article: article.content,
					itemId,
				}),
			);

			await Promise.all(analysisPromises);

			setProgress((prev) => ({
				...prev,
				analyzing: false,
				summarizing: true,
				completed: prev.completed + articlesWithContent.length,
			}));

			const summaryPromises = articlesWithContent.map((article) =>
				summariseMutation.mutateAsync({
					article: article.content,
					itemId,
				}),
			);

			await Promise.all(summaryPromises);

			setProgress((prev) => ({
				...prev,
				summarizing: false,
				generating: true,
				completed: prev.completed + articlesWithContent.length,
			}));

			const reportResult = await generateReportMutation.mutateAsync({
				itemId,
			});

			setProgress((prev) => ({
				...prev,
				generating: false,
				completed: totalSteps,
			}));

			if (reportResult.outputId) {
				navigate(`${basePath ?? "/work"}/${reportResult.outputId}`);
			} else {
				throw new Error("Failed to generate report");
			}
		} catch (error: unknown) {
			setError(`Error: ${error instanceof Error ? error.message : "Failed to rerun analysis"}`);
		} finally {
			setIsRerunning(false);
		}
	};

	const progressPercentage =
		progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

	return (
		<div className={cn("flex flex-col", className)}>
			<Button
				onClick={handleRerunAnalysis}
				disabled={isRerunning || isLoadingSourceArticles}
				variant="secondary"
				className={cn("flex items-center gap-1")}
			>
				<RefreshCw size={16} className={cn(isRerunning && "animate-spin")} />
				{isRerunning
					? `Rerunning (${progressPercentage}%)${
							progress.analyzing
								? " - Analyzing"
								: progress.summarizing
									? " - Summarizing"
									: progress.generating
										? " - Generating Report"
										: ""
						}`
					: "Rerun Analysis"}
			</Button>

			{error && (
				<div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded">
					{error}
				</div>
			)}
		</div>
	);
}
