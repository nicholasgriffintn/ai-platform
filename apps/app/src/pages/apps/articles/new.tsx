import { Link2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";
import { Button, Input, Textarea } from "~/components/ui";
import {
  useAnalyseArticle,
  useExtractArticleContent,
  useGenerateReport,
  useSummariseArticle,
} from "~/hooks/useArticles";
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
  const [urlInputs, setUrlInputs] = useState<{ [articleId: string]: string }>(
    {},
  );
  const [extractingContent, setExtractingContent] = useState<{
    [articleId: string]: boolean;
  }>({});

  useEffect(() => {
    setItemId(crypto.randomUUID());
  }, []);

  const analyseMutation = useAnalyseArticle();
  const summariseMutation = useSummariseArticle();
  const generateReportMutation = useGenerateReport();
  const extractContentMutation = useExtractArticleContent();

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

  const handleUrlChange = useCallback(
    (id: string, e: ChangeEvent<HTMLInputElement>) => {
      const newUrl = e.target.value;
      setUrlInputs((prev) => ({
        ...prev,
        [id]: newUrl,
      }));
    },
    [],
  );

  const handleExtractContent = useCallback(
    async (id: string, url: string, e?: FormEvent) => {
      e?.preventDefault();
      if (!url.trim()) return;

      try {
        setExtractingContent((prev) => ({
          ...prev,
          [id]: true,
        }));
        setProcessingError(null);

        const result = await extractContentMutation.mutateAsync({
          urls: [url.trim()],
          extractDepth: "basic",
        });

        if (result.status === "success" && result.data?.content.length) {
          setArticles((prevArticles) =>
            prevArticles.map((article) =>
              article.id === id
                ? { ...article, text: result.data?.content?.[0] || "" }
                : article,
            ),
          );
        } else if (result.data?.failedUrls.length) {
          const error = result.data.failedUrls[0].error;
          setProcessingError(`Failed to extract content: ${error}`);
        }
      } catch (error: any) {
        setProcessingError(
          `Error extracting content: ${error.message || "Unknown error"}`,
        );
      } finally {
        setExtractingContent((prev) => ({
          ...prev,
          [id]: false,
        }));
      }
    },
    [extractContentMutation],
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
      <PageShell
        sidebarContent={<StandardSidebarContent />}
        className="max-w-4xl flex justify-center items-center min-h-[200px]"
      >
        <Loader2 size={32} className="animate-spin" />
      </PageShell>
    );
  }

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <div className={cn("flex justify-between items-center mb-8")}>
          <PageHeader>
            <BackLink to="/apps/articles" label="Back to Reports" />
            <PageTitle title="New Article Analysis Session" />
            <p className={cn("text-sm text-zinc-500 dark:text-zinc-400 mt-1")}>
              Session ID: {itemId}
            </p>
          </PageHeader>
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
      }
      isBeta={true}
    >
      <div className="max-w-3xl mx-auto">
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

                <div className={cn("mb-3")}>
                  <form
                    className={cn("flex space-x-2 mb-2")}
                    onSubmit={(e) =>
                      handleExtractContent(
                        article.id,
                        urlInputs[article.id] || "",
                        e,
                      )
                    }
                  >
                    <Input
                      type="url"
                      placeholder="Enter article URL..."
                      value={urlInputs[article.id] || ""}
                      onChange={(e) => handleUrlChange(article.id, e)}
                      className={cn("flex-1")}
                      disabled={
                        processingArticles ||
                        reportGenerating ||
                        extractingContent[article.id]
                      }
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={
                        !urlInputs[article.id] ||
                        processingArticles ||
                        reportGenerating ||
                        extractingContent[article.id]
                      }
                    >
                      {extractingContent[article.id] ? (
                        <Loader2 size={16} className="animate-spin mr-1" />
                      ) : (
                        <Link2 size={16} className="mr-1" />
                      )}
                      {extractingContent[article.id]
                        ? "Fetching..."
                        : "Fetch Content"}
                    </Button>
                  </form>
                  <div
                    className={cn("text-xs text-zinc-500 dark:text-zinc-400")}
                  >
                    Enter a URL to automatically extract article content or
                    paste it manually below
                  </div>
                </div>

                <Textarea
                  value={article.text}
                  onChange={(e) => handleTextChange(article.id, e)}
                  placeholder="Paste article content here..."
                  className={cn("min-h-[150px] mb-3")}
                  disabled={
                    processingArticles ||
                    reportGenerating ||
                    extractingContent[article.id]
                  }
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
    </PageShell>
  );
}
