import { Button, cn, Input, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { Link2, Loader2, Plus, Save, Trash2 } from "lucide-react";

export interface ArticleAnalysisArticle {
  id: string;
  content?: string;
  text?: string;
}

export interface ArticleAnalysisSessionState {
  itemId: string;
  articles: ArticleAnalysisArticle[];
  urlInputs: Record<string, string>;
  extractingContent: Record<string, boolean>;
  processingArticles: boolean;
  reportGenerating: boolean;
  processingError?: string | null;
  isGenerateEnabled: boolean;
  actions: {
    addArticle: () => void;
    removeArticle: (articleId: string) => void;
    setArticleUrl: (articleId: string, url: string) => void;
    setArticleText: (articleId: string, text: string) => void;
    fetchArticleContent: (articleId: string) => void | Promise<void>;
    processAndGenerate: () => Promise<string | null | undefined>;
  };
}

export interface ArticleAnalysisFormProps {
  session: ArticleAnalysisSessionState;
  onReportGenerated: (reportId: string) => void;
}

export function ArticleAnalysisForm({ session, onReportGenerated }: ArticleAnalysisFormProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">New Article Analysis Session</h2>
          <p className="mt-1 text-sm text-muted-foreground">Session ID: {session.itemId}</p>
        </div>
        <Button
          variant="primary"
          icon={
            session.processingArticles || session.reportGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )
          }
          disabled={!session.isGenerateEnabled}
          onClick={async () => {
            const reportId = await session.actions.processAndGenerate();

            if (reportId) {
              onReportGenerated(reportId);
            }
          }}
        >
          {session.processingArticles
            ? "Processing Articles..."
            : session.reportGenerating
              ? "Generating Report..."
              : "Process & Generate Report"}
        </Button>
      </div>

      <div className="mx-auto max-w-3xl">
        {session.processingError && (
          <div role="alert" className="mb-6 rounded-md border border-failure/45 bg-failure/12 p-4">
            <p className="font-semibold text-failure">Error</p>
            <p className="mt-1 text-sm text-failure">{session.processingError}</p>
          </div>
        )}

        <div className="space-y-6">
          {session.articles.map((article, index) => {
            const isExtracting = session.extractingContent[article.id] ?? false;
            const isBusy = session.processingArticles || session.reportGenerating || isExtracting;

            return (
              <div key={article.id} className="border-border bg-surface rounded-lg border p-4">
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Article {index + 1}</h3>
                  {session.articles.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => session.actions.removeArticle(article.id)}
                      aria-label="Remove Article"
                      className="text-muted-foreground hover:text-failure"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>

                <form
                  className="mb-2 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void session.actions.fetchArticleContent(article.id);
                  }}
                >
                  <Input
                    type="url"
                    placeholder="Enter article URL..."
                    value={session.urlInputs[article.id] ?? ""}
                    onChange={(event) =>
                      session.actions.setArticleUrl(article.id, event.target.value)
                    }
                    className="flex-1"
                    disabled={isBusy}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={!session.urlInputs[article.id]?.trim() || isBusy}
                  >
                    {isExtracting ? (
                      <Loader2 size={16} className="mr-1 animate-spin" />
                    ) : (
                      <Link2 size={16} className="mr-1" />
                    )}
                    {isExtracting ? "Fetching..." : "Fetch Content"}
                  </Button>
                </form>
                <p className="mb-3 text-xs text-muted-foreground">
                  Enter a URL to automatically extract article content or paste it manually below
                </p>
                <Textarea
                  value={article.text}
                  onChange={(event) =>
                    session.actions.setArticleText(article.id, event.target.value)
                  }
                  placeholder="Paste article content here..."
                  className={cn("min-h-[150px]")}
                  disabled={isBusy}
                />
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={session.actions.addArticle}
          icon={<Plus size={16} />}
          className="mt-6"
          disabled={session.processingArticles || session.reportGenerating}
        >
          Add Another Article
        </Button>
      </div>
    </div>
  );
}
