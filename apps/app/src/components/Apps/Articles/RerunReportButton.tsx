import { RerunReportControl } from "@ngriffin_uk/polychat-component-experiences/content";
import { getStringProperty, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";

import {
  useAnalyseArticle,
  useFetchSourceArticlesByIds,
  useGenerateReport,
  usePrepareSessionForRerun,
  useSummariseArticle,
} from "~/hooks/useArticles";

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
        void navigate(`${basePath ?? "/work"}/${reportResult.outputId}`);
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
    <RerunReportControl
      isRerunning={isRerunning}
      isDisabled={isLoadingSourceArticles}
      progressPercentage={progressPercentage}
      phase={
        progress.analyzing
          ? "analyzing"
          : progress.summarizing
            ? "summarizing"
            : progress.generating
              ? "generating"
              : null
      }
      errorMessage={error}
      onRerun={handleRerunAnalysis}
      className={className}
    />
  );
}
