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
    <div className="border-border bg-surface overflow-hidden rounded-lg border shadow-sm">
      <button
        type="button"
        onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated transition-colors"
      >
        <h3 className="text-lg font-medium flex items-center text-foreground">
          <FileText size={18} className="mr-2 text-active-work" />
          Source Articles ({sourceCount})
        </h3>
        <div className="flex items-center">
          <span className="text-sm text-muted-foreground mr-2">
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
        <div className="p-5 border-t border-border transition-all duration-300 animate-in slide-in-from-top-10">
          {isLoadingSourceArticles ? (
            <div className="flex justify-center items-center py-12">
              <div className="flex flex-col items-center">
                <Loader2 size={32} className="animate-spin text-active-work mb-3" />
                <p className="text-muted-foreground">Loading source articles...</p>
              </div>
            </div>
          ) : sourceArticles && sourceArticles.length > 0 ? (
            <div className="space-y-4">
              {sourceArticles.map((article, index) => {
                const articleData: SourceArticleData = article.content;
                const isExpanded = !!expandedArticleIds[article.id];
                const articleTitle =
                  articleData?.title?.replace("Analysis: ", "") || `Source Article ${index + 1}`;

                return (
                  <div
                    key={article.id}
                    className={cn(
                      "border border-border rounded-lg overflow-hidden transition-all duration-300",
                      isExpanded ? "shadow-md" : "shadow-sm",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleArticleExpanded(article.id)}
                      className="bg-surface-elevated hover:bg-selection/60 flex w-full items-center justify-between p-4 text-left transition-colors"
                    >
                      <div className="flex items-center min-w-0">
                        <div className="bg-active-work/12 p-2 rounded-md mr-3 flex-shrink-0">
                          <FileText size={18} className="text-active-work" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h4 className="font-medium text-foreground truncate">{articleTitle}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(article.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center ml-2 flex-shrink-0">
                        <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">
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
                      <div className="animate-in slide-in-from-top-5 duration-300">
                        {articleData?.originalArticle && (
                          <div className="border-border bg-surface border-b p-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOriginalArticleExpanded(article.id);
                              }}
                              className="w-full flex justify-between items-center text-left mb-3 group"
                            >
                              <h5 className="font-medium text-sm flex items-center text-foreground group-hover:text-active-work transition-colors">
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
                              <div className="prose prose-sm dark:prose-invert border-border bg-surface-elevated animate-in slide-in-from-top-2 max-w-none rounded-md border p-4 duration-200">
                                <Markdown>{articleData.originalArticle}</Markdown>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOriginalArticleExpanded(article.id);
                                }}
                                className="border-border bg-surface-elevated hover:bg-selection/60 w-full rounded-md border p-4 text-left transition-colors"
                              >
                                <p className="line-clamp-3 text-sm text-foreground">
                                  {articleData.originalArticle.substring(0, 200)}
                                  {articleData.originalArticle.length > 200 ? "..." : ""}
                                </p>
                                <div className="text-active-work text-xs mt-2 font-medium flex items-center">
                                  <span>Read full article</span>
                                  <ChevronDown size={14} className="ml-1 transform -rotate-90" />
                                </div>
                              </button>
                            )}
                          </div>
                        )}

                        {articleData?.analysis?.content && (
                          <div className="bg-surface p-4">
                            <h5 className="font-medium text-sm flex items-center text-foreground mb-3">
                              <FileText size={14} className="mr-2 text-active-work" />
                              Analysis
                              {articleData.analysis.model && (
                                <span className="bg-selection text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-normal">
                                  Model: {articleData.analysis.model}
                                </span>
                              )}
                            </h5>
                            <div className="prose prose-sm dark:prose-invert border-border bg-surface-elevated max-w-none rounded-md border p-4">
                              <Markdown>{articleData.analysis.content}</Markdown>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {articleData.analysis.citations &&
                                articleData.analysis.citations.length > 0 && (
                                  <div className="border-border bg-surface-elevated rounded-md border p-3">
                                    <h6 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center">
                                      <ExternalLink size={12} className="mr-1.5" />
                                      Citations
                                    </h6>
                                    <ul className="text-xs space-y-1.5 list-none pl-0">
                                      {articleData.analysis.citations.map(
                                        (citation: string, i: number) => (
                                          <li
                                            key={`citation-${article.id}-${i}`}
                                            className="border-border bg-surface rounded border p-2 break-all"
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
                                <div className="border-border bg-surface-elevated rounded-md border p-3">
                                  <h6 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center">
                                    <Info size={12} className="mr-1.5" />
                                    Quote Verification
                                  </h6>
                                  <div className="text-xs space-y-2">
                                    <div className="flex items-center">
                                      <span
                                        className={cn(
                                          "px-2 py-1 rounded-full text-xs font-medium",
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
                                        <ul className="list-disc pl-4 mt-1 space-y-1">
                                          {articleData.analysis.verifiedQuotes.missingQuotes.map(
                                            (quote: string, i: number) => (
                                              <li
                                                key={`missing-quote-${article.id}-${i}`}
                                                className="border-border bg-surface text-foreground mt-1 rounded border p-2"
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
            <div className="border-border bg-surface-elevated rounded-lg border p-6 text-center">
              <FileText size={32} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No source articles found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
