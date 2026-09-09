import { Markdown } from "@ngriffin_uk/polychat-component-content";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import { ArrowDown, ChevronDown, ExternalLink, FileText, Info, Loader2 } from "lucide-react";
import { useState } from "react";

interface SourceArticleData {
  originalArticle?: string;
  analysis?: {
    content?: string;
    model?: string;
    citations?: string[];
    verifiedQuotes?: {
      verified: boolean;
      missingQuotes: string[];
    };
  };
  title?: string;
  text?: string;
}

export interface SourceArticle {
  id: string;
  content: SourceArticleData;
  createdAt: string;
}

export interface ArticleSourceArticleListProps {
  sourceArticles?: SourceArticle[];
  sourceCount: number;
  isLoading?: boolean;
}

export function ArticleSourceArticleList({
  sourceArticles,
  sourceCount,
  isLoading: isLoadingSourceArticles = false,
}: ArticleSourceArticleListProps) {
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(true);
  const [expandedArticleIds, setExpandedArticleIds] = useState<Record<string, boolean>>({});
  const [expandedOriginalArticles, setExpandedOriginalArticles] = useState<Record<string, boolean>>(
    {},
  );

  const toggleArticleExpanded = (articleId: string) => {
    setExpandedArticleIds((prev) => ({
      ...prev,
      [articleId]: !prev[articleId],
    }));
  };

  const toggleOriginalArticleExpanded = (articleId: string) => {
    setExpandedOriginalArticles((prev) => ({
      ...prev,
      [articleId]: !prev[articleId],
    }));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-surface-elevated"
      >
        <h3 className="flex items-center text-lg font-medium text-foreground">
          <FileText size={18} className="mr-2 text-active-work" />
          Source Articles ({sourceCount})
        </h3>
        <div className="flex items-center">
          <span className="mr-2 text-sm text-muted-foreground">
            {isSourcesExpanded ? "Hide" : "Show"} details
          </span>
          <ArrowDown
            size={18}
            className={cn(
              "text-muted-foreground transition-transform duration-300",
              isSourcesExpanded ? "rotate-180" : "",
            )}
          />
        </div>
      </button>

      {isSourcesExpanded && (
        <div className="animate-in border-t border-border p-5 transition-all duration-300 slide-in-from-top-10">
          {isLoadingSourceArticles ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center">
                <Loader2 size={32} className="mb-3 animate-spin text-active-work" />
                <p className="text-muted-foreground">Loading source articles...</p>
              </div>
            </div>
          ) : sourceArticles && sourceArticles.length > 0 ? (
            <div className="space-y-4">
              {sourceArticles.map((article, index) => {
                const articleData: SourceArticleData = article.content;
                const isExpanded = expandedArticleIds[article.id];
                const articleTitle =
                  articleData?.title?.replace("Analysis: ", "") || `Source Article ${index + 1}`;

                return (
                  <div
                    key={article.id}
                    className={cn(
                      "overflow-hidden rounded-lg border border-border transition-all duration-300",
                      isExpanded ? "shadow-md" : "shadow-sm",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleArticleExpanded(article.id)}
                      className="flex w-full items-center justify-between bg-surface-elevated p-4 text-left transition-colors hover:bg-selection/60"
                    >
                      <div className="flex min-w-0 items-center">
                        <div className="mr-3 flex-shrink-0 rounded-md bg-active-work/12 p-2">
                          <FileText size={18} className="text-active-work" />
                        </div>
                        <div className="min-w-0 flex-grow">
                          <h4 className="truncate font-medium text-foreground">{articleTitle}</h4>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(article.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="ml-2 flex flex-shrink-0 items-center">
                        <span className="mr-2 hidden text-sm text-muted-foreground sm:inline">
                          {isExpanded ? "Hide" : "View"} details
                        </span>
                        <ChevronDown
                          size={18}
                          className={cn(
                            "text-muted-foreground transition-transform duration-300",
                            isExpanded ? "rotate-180" : "",
                          )}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="animate-in duration-300 slide-in-from-top-5">
                        {articleData?.originalArticle && (
                          <div className="border-b border-border bg-surface p-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOriginalArticleExpanded(article.id);
                              }}
                              className="group mb-3 flex w-full items-center justify-between text-left"
                            >
                              <h5 className="flex items-center text-sm font-medium text-foreground transition-colors group-hover:text-active-work">
                                <FileText size={14} className="mr-2 text-active-work" />
                                Original Article
                              </h5>
                              <ChevronDown
                                size={16}
                                className={cn(
                                  "text-muted-foreground transition-transform duration-300",
                                  expandedOriginalArticles[article.id] ? "rotate-180" : "",
                                )}
                              />
                            </button>

                            {expandedOriginalArticles[article.id] ? (
                              <div className="prose prose-sm max-w-none animate-in rounded-md border border-border bg-surface-elevated p-4 duration-200 slide-in-from-top-2 dark:prose-invert">
                                <Markdown>{articleData.originalArticle}</Markdown>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOriginalArticleExpanded(article.id);
                                }}
                                className="w-full rounded-md border border-border bg-surface-elevated p-4 text-left transition-colors hover:bg-selection/60"
                              >
                                <p className="line-clamp-3 text-sm text-foreground">
                                  {articleData.originalArticle.substring(0, 200)}
                                  {articleData.originalArticle.length > 200 ? "..." : ""}
                                </p>
                                <div className="mt-2 flex items-center text-xs font-medium text-active-work">
                                  <span>Read full article</span>
                                  <ChevronDown size={14} className="ml-1 -rotate-90 transform" />
                                </div>
                              </button>
                            )}
                          </div>
                        )}

                        {articleData?.analysis?.content && (
                          <div className="bg-surface p-4">
                            <h5 className="mb-3 flex items-center text-sm font-medium text-foreground">
                              <FileText size={14} className="mr-2 text-active-work" />
                              Analysis
                              {articleData.analysis.model && (
                                <span className="ml-2 rounded-full bg-selection px-2 py-0.5 text-xs font-normal text-muted-foreground">
                                  Model: {articleData.analysis.model}
                                </span>
                              )}
                            </h5>
                            <div className="prose prose-sm max-w-none rounded-md border border-border bg-surface-elevated p-4 dark:prose-invert">
                              <Markdown>{articleData.analysis.content}</Markdown>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                              {articleData.analysis.citations &&
                                articleData.analysis.citations.length > 0 && (
                                  <div className="rounded-md border border-border bg-surface-elevated p-3">
                                    <h6 className="mb-2 flex items-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                      <ExternalLink size={12} className="mr-1.5" />
                                      Citations
                                    </h6>
                                    <ul className="list-none space-y-1.5 pl-0 text-xs">
                                      {articleData.analysis.citations.map(
                                        (citation: string, i: number) => (
                                          <li
                                            key={`citation-${article.id}-${i}`}
                                            className="rounded border border-border bg-surface p-2 break-all"
                                          >
                                            <a
                                              href={citation}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center text-active-work hover:underline"
                                            >
                                              <span className="truncate">{citation}</span>
                                              <ExternalLink
                                                size={10}
                                                className="ml-1 flex-shrink-0"
                                              />
                                            </a>
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                )}

                              {articleData.analysis.verifiedQuotes && (
                                <div className="rounded-md border border-border bg-surface-elevated p-3">
                                  <h6 className="mb-2 flex items-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    <Info size={12} className="mr-1.5" />
                                    Quote Verification
                                  </h6>
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center">
                                      <span
                                        className={cn(
                                          "rounded-full px-2 py-1 text-xs font-medium",
                                          articleData.analysis.verifiedQuotes.verified
                                            ? "bg-success/12 text-success"
                                            : "bg-failure/12 text-failure",
                                        )}
                                      >
                                        {articleData.analysis.verifiedQuotes.verified
                                          ? "Verified"
                                          : "Not Verified"}
                                      </span>
                                    </div>

                                    {articleData.analysis.verifiedQuotes.missingQuotes?.length >
                                      0 && (
                                      <div>
                                        <span className="font-medium text-foreground">
                                          Missing Quotes:
                                        </span>
                                        <ul className="mt-1 list-disc space-y-1 pl-4">
                                          {articleData.analysis.verifiedQuotes.missingQuotes.map(
                                            (quote: string, i: number) => (
                                              <li
                                                key={`missing-quote-${article.id}-${i}`}
                                                className="mt-1 rounded border border-border bg-surface p-2 text-foreground"
                                              >
                                                "{quote}"
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface-elevated p-6 text-center">
              <FileText size={32} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No source articles found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
