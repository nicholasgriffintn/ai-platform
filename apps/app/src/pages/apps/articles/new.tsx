import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useNavigate } from "react-router";

import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button, Textarea } from "~/components/ui";
import {
  useAnalyseArticle,
  useGenerateReport,
  useSummariseArticle,
} from "~/hooks/useArticles";
import { SidebarLayout } from "~/layouts/SidebarLayout";
import { cn } from "~/lib/utils";
import type { ArticleInput } from "~/types/article";

export function meta() {
  return [
    { title: "New Article Analysis - Polychat" },
    {
      name: "description",
      content: "Start a new multi-article analysis session",
    },
  ];
}

export default function NewArticleAnalysisPage() {
  const navigate = useNavigate();
  const [itemId, setItemId] = useState<string | null>(null);
  const [articles, setArticles] = useState<ArticleInput[]>([
    { id: crypto.randomUUID(), text: "" },
  ]);
  const [processingArticles, setProcessingArticles] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  useEffect(() => {
    setItemId(crypto.randomUUID());
  }, []);

  const analyseMutation = useAnalyseArticle();
  const summariseMutation = useSummariseArticle();
  const generateReportMutation = useGenerateReport();

  const handleAddArticle = useCallback(() => {
    setArticles((prevArticles) => [
      ...prevArticles,
      { id: crypto.randomUUID(), text: "" },
    ]);
  }, []);

  const handleRemoveArticle = useCallback((idToRemove: string) => {
    setArticles((prevArticles) =>
      prevArticles.filter((article) => article.id !== idToRemove),
    );
  }, []);

  const handleTextChange = useCallback(
    (id: string, e: ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setArticles((prevArticles) =>
        prevArticles.map((article) =>
          article.id === id ? { ...article, text: newText } : article,
        ),
      );
    },
    [],
  );

  const handleProcessAndGenerate = useCallback(async () => {
    if (!itemId) return;

    const validArticles = articles.filter((a) => a.text.trim().length > 0);
    if (validArticles.length === 0) {
      setProcessingError("Please add content to at least one article.");
      return;
    }

    setProcessingArticles(true);
    setReportGenerating(false);
    setProcessingError(null);

    try {
      const analysisPromises = validArticles.map((article) =>
        analyseMutation.mutateAsync({ article: article.text, itemId }),
      );
      const summaryPromises = validArticles.map((article) =>
        summariseMutation.mutateAsync({ article: article.text, itemId }),
      );

      await Promise.all([...analysisPromises, ...summaryPromises]);

      setProcessingArticles(false);
      setReportGenerating(true);

      generateReportMutation.mutate(
        { itemId },
        {
          onSuccess: (data) => {
            setReportGenerating(false);
            if (data.appDataId) {
              navigate(`/apps/articles/${data.appDataId}`);
            } else {
              setProcessingError(
                "Report generated but could not navigate. Please check the reports list.",
              );
            }
          },
          onError: (error) => {
            setReportGenerating(false);
            setProcessingError(`Report Generation Failed: ${error.message}`);
          },
        },
      );
    } catch (error: any) {
      setProcessingArticles(false);
      const message =
        error?.message || "An error occurred during article processing.";
      setProcessingError(`Article Processing Failed: ${message}`);
    }
  }, [
    articles,
    itemId,
    analyseMutation,
    summariseMutation,
    generateReportMutation,
    navigate,
  ]);

  const isGenerateEnabled = useMemo(() => {
    return (
      !processingArticles &&
      !reportGenerating &&
      articles.some((a) => a.text.trim().length > 0)
    );
  }, [articles, processingArticles, reportGenerating]);

  if (!itemId) {
    return (
      <SidebarLayout sidebarContent={<StandardSidebarContent />}>
        <div
          className={cn(
            "container mx-auto px-4 py-8 max-w-4xl flex justify-center items-center min-h-[200px]",
          )}
        >
          <Loader2 size={32} className="animate-spin" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout sidebarContent={<StandardSidebarContent />}>
      <div className={cn("container mx-auto px-4 py-8 max-w-4xl")}>
        <div className={cn("flex justify-between items-center mb-8")}>
          <div>
            <Link
              to="/apps/articles"
              className={cn(
                "no-underline flex items-center text-blue-500 dark:text-blue-400 mb-2 hover:underline",
              )}
            >
              <ArrowLeft size={16} className="mr-1" />
              <span>Back to Reports</span>
            </Link>
            <h1
              className={cn(
                "text-2xl font-bold text-zinc-900 dark:text-zinc-50",
              )}
            >
              New Article Analysis Session
            </h1>
            <p className={cn("text-sm text-zinc-500 dark:text-zinc-400 mt-1")}>
              Session ID: {itemId}
            </p>
          </div>
          <Button
            onClick={handleProcessAndGenerate}
            variant="primary"
            icon={
              processingArticles || reportGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )
            }
            disabled={!isGenerateEnabled}
          >
            {processingArticles
              ? "Processing Articles..."
              : reportGenerating
                ? "Generating Report..."
                : "Process & Generate Report"}
          </Button>
        </div>

        {processingError && (
          <div
            className={cn(
              "mb-6 p-4 border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/30 rounded-md",
            )}
          >
            <p className={cn("font-semibold text-red-800 dark:text-red-200")}>
              Error
            </p>
            <p className={cn("text-sm text-red-700 dark:text-red-300 mt-1")}>
              {processingError}
            </p>
          </div>
        )}

        <div className={cn("space-y-6")}>
          {articles.map((article, index) => {
            return (
              <div
                key={article.id}
                className={cn(
                  "p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-off-white dark:bg-zinc-800",
                )}
              >
                <div className={cn("flex justify-between items-start mb-3")}>
                  <h2
                    className={cn(
                      "font-semibold text-lg text-zinc-800 dark:text-zinc-200",
                    )}
                  >
                    Article {index + 1}
                  </h2>
                  {articles.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveArticle(article.id)}
                      aria-label="Remove Article"
                      className={cn(
                        "text-zinc-500 hover:text-red-600 dark:hover:text-red-500",
                      )}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={article.text}
                  onChange={(e) => handleTextChange(article.id, e)}
                  placeholder="Paste article content here..."
                  className={cn("min-h-[150px] mb-3")}
                  disabled={processingArticles || reportGenerating}
                />
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={handleAddArticle}
          icon={<Plus size={16} />}
          className={cn("mt-6")}
          disabled={processingArticles || reportGenerating}
        >
          Add Another Article
        </Button>
      </div>
    </SidebarLayout>
  );
}
