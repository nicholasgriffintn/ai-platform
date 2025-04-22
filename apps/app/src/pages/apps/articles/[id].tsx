"use client";

import {
  ArrowDown,
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Markdown } from "~/components/ui/Markdown";
import {
  useFetchArticleReport,
  useFetchSourceArticlesByIds,
} from "~/hooks/useArticles";
import { SidebarLayout } from "~/layouts/SidebarLayout";

export function meta({ params }: { params: { id?: string } }) {
  return [
    { title: `Article Report ${params.id || ""} - Polychat` },
    {
      name: "description",
      content: `Details for article comparison report ${params.id || ""}`,
    },
  ];
}

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

export default function ArticleReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, error } = useFetchArticleReport(id);
  const sourceIds = report?.data?.sourceItemIds || [];
  const { data: sourceArticles, isLoading: isLoadingSourceArticles } =
    useFetchSourceArticlesByIds(sourceIds);

  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(true);
  const [expandedArticleIds, setExpandedArticleIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedOriginalArticles, setExpandedOriginalArticles] = useState<
    Record<string, boolean>
  >({});

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

  if (isLoading) {
    return (
      <SidebarLayout sidebarContent={<StandardSidebarContent />}>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="flex flex-col items-center">
              <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
              <p className="text-zinc-600 dark:text-zinc-400">
                Loading report data...
              </p>
            </div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout sidebarContent={<StandardSidebarContent />}>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Link
                to="/apps/articles"
                className="no-underline flex items-center text-blue-500 dark:text-blue-400 mb-2 hover:underline"
              >
                <ArrowLeft size={16} className="mr-1" />
                <span>Back to Reports List</span>
              </Link>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center">
                Article Report Details
              </h1>
            </div>
          </div>

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
        </div>
      </SidebarLayout>
    );
  }

  if (!report) {
    return (
      <SidebarLayout sidebarContent={<StandardSidebarContent />}>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Link
                to="/apps/articles"
                className="no-underline flex items-center text-blue-500 dark:text-blue-400 mb-2 hover:underline"
              >
                <ArrowLeft size={16} className="mr-1" />
                <span>Back to Reports List</span>
              </Link>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center">
                Article Report Details
              </h1>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm text-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              Report data not found.
            </p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout sidebarContent={<StandardSidebarContent />}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link
              to="/apps/articles"
              className="no-underline flex items-center text-blue-500 dark:text-blue-400 mb-2 hover:underline group"
            >
              <ArrowLeft
                size={16}
                className="mr-1 group-hover:-translate-x-1 transition-transform"
              />
              <span>Back to Reports List</span>
            </Link>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center">
              Article Report Details
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              {report.data?.title || `Report (ID: ${report.id})`}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full">
                <span className="text-zinc-500 dark:text-zinc-400 mr-2">
                  Session ID:
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {report.item_id || "N/A"}
                </span>
              </div>
              <div className="flex items-center px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full">
                <span className="text-zinc-500 dark:text-zinc-400 mr-2">
                  Created:
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {new Date(report.created_at).toLocaleString()}
                </span>
              </div>
              {report.data?.sourceItemIds && (
                <div className="flex items-center px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full">
                  <span className="text-zinc-500 dark:text-zinc-400 mr-2">
                    Source Articles:
                  </span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {report.data.sourceItemIds.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm">
            <h3 className="text-lg font-medium mb-4 flex items-center text-zinc-900 dark:text-zinc-100">
              <FileText
                size={18}
                className="mr-2 text-blue-500 dark:text-blue-400"
              />
              Report Content
            </h3>
            {report.data?.report?.content ? (
              <div className="prose dark:prose-invert max-w-none p-5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                <Markdown>{report.data.report.content}</Markdown>
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 italic p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                No report content available.
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
            >
              <h3 className="text-lg font-medium flex items-center text-zinc-900 dark:text-zinc-100">
                <FileText
                  size={18}
                  className="mr-2 text-blue-500 dark:text-blue-400"
                />
                Source Articles ({sourceIds.length})
              </h3>
              <div className="flex items-center">
                <span className="text-sm text-zinc-500 dark:text-zinc-400 mr-2">
                  {isSourcesExpanded ? "Hide" : "Show"} details
                </span>
                <ArrowDown
                  size={18}
                  className={`text-zinc-500 dark:text-zinc-400 transition-transform duration-300 ${
                    isSourcesExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {isSourcesExpanded && (
              <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 transition-all duration-300">
                {isLoadingSourceArticles ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="flex flex-col items-center">
                      <Loader2
                        size={32}
                        className="animate-spin text-blue-500 mb-3"
                      />
                      <p className="text-zinc-500 dark:text-zinc-400">
                        Loading source articles...
                      </p>
                    </div>
                  </div>
                ) : sourceArticles && sourceArticles.length > 0 ? (
                  <div className="space-y-4">
                    {sourceArticles.map((article, index) => {
                      const articleData = article.data as SourceArticleData;
                      const isExpanded = !!expandedArticleIds[article.id];
                      const articleTitle =
                        articleData?.title?.replace("Analysis: ", "") ||
                        `Source Article ${index + 1}`;

                      return (
                        <div
                          key={article.id}
                          className={`border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden transition-all duration-300 ${
                            isExpanded ? "shadow-md" : "shadow-sm"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleArticleExpanded(article.id)}
                            className="w-full p-4 flex items-center justify-between text-left bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
                          >
                            <div className="flex items-center">
                              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-md mr-3">
                                <FileText
                                  size={18}
                                  className="text-blue-500 dark:text-blue-400"
                                />
                              </div>
                              <div>
                                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
                                  {articleTitle}
                                </h4>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                  {new Date(
                                    article.created_at,
                                  ).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm text-zinc-500 dark:text-zinc-400 mr-2 hidden sm:inline">
                                {isExpanded ? "Hide" : "View"} details
                              </span>
                              <ChevronDown
                                size={18}
                                className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-300 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="animate-in slide-in-from-top duration-300">
                              {articleData?.originalArticle && (
                                <div className="p-4 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleOriginalArticleExpanded(article.id);
                                    }}
                                    className="w-full flex justify-between items-center text-left mb-3"
                                  >
                                    <h5 className="font-medium text-sm flex items-center text-zinc-800 dark:text-zinc-200">
                                      <FileText
                                        size={14}
                                        className="mr-2 text-blue-500 dark:text-blue-400"
                                      />
                                      Original Article
                                    </h5>
                                    <ChevronDown
                                      size={16}
                                      className={`text-zinc-400 transition-transform duration-300 ${
                                        expandedOriginalArticles[article.id]
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                    />
                                  </button>

                                  {expandedOriginalArticles[article.id] ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none animate-in slide-in-from-top duration-200 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-700">
                                      <Markdown>
                                        {articleData.originalArticle}
                                      </Markdown>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleOriginalArticleExpanded(
                                          article.id,
                                        );
                                      }}
                                      className="w-full text-left p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 transition-colors"
                                    >
                                      <p className="line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">
                                        {articleData.originalArticle.substring(
                                          0,
                                          200,
                                        )}
                                        ...
                                      </p>
                                      <div className="text-blue-500 dark:text-blue-400 text-xs mt-2 font-medium flex items-center">
                                        <span>Read full article</span>
                                        <ChevronDown
                                          size={14}
                                          className="ml-1 rotate-270"
                                        />
                                      </div>
                                    </button>
                                  )}
                                </div>
                              )}

                              {articleData?.analysis?.content && (
                                <div className="p-4 bg-white dark:bg-zinc-800">
                                  <h5 className="font-medium text-sm flex items-center text-zinc-800 dark:text-zinc-200 mb-3">
                                    <FileText
                                      size={14}
                                      className="mr-2 text-blue-500 dark:text-blue-400"
                                    />
                                    Analysis
                                    {articleData.analysis.model && (
                                      <span className="ml-2 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded-full text-xs font-normal text-zinc-500 dark:text-zinc-400">
                                        Model: {articleData.analysis.model}
                                      </span>
                                    )}
                                  </h5>
                                  <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-700">
                                    <Markdown>
                                      {articleData.analysis.content}
                                    </Markdown>
                                  </div>

                                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {articleData.analysis.citations &&
                                      articleData.analysis.citations.length >
                                        0 && (
                                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-md border border-zinc-200 dark:border-zinc-700">
                                          <h6 className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400 mb-2 flex items-center">
                                            <ExternalLink
                                              size={12}
                                              className="mr-1"
                                            />
                                            Citations
                                          </h6>
                                          <ul className="text-xs space-y-2 list-none pl-0">
                                            {articleData.analysis.citations.map(
                                              (citation: string, i: number) => (
                                                <li
                                                  key={`citation-${article.id}-${i}`}
                                                  className="break-all bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700"
                                                >
                                                  <a
                                                    href={citation}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center"
                                                  >
                                                    {citation.length > 40
                                                      ? `${citation.substring(0, 40)}...`
                                                      : citation}
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
                                      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-md border border-zinc-200 dark:border-zinc-700">
                                        <h6 className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400 mb-2 flex items-center">
                                          <Info size={12} className="mr-1" />
                                          Quote Verification
                                        </h6>
                                        <div className="text-xs">
                                          <div className="flex items-center">
                                            <span
                                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                articleData.analysis
                                                  .verifiedQuotes.verified
                                                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                                  : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                                              }`}
                                            >
                                              {articleData.analysis
                                                .verifiedQuotes.verified
                                                ? "Verified"
                                                : "Not Verified"}
                                            </span>
                                          </div>

                                          {articleData.analysis.verifiedQuotes
                                            .missingQuotes?.length > 0 && (
                                            <div className="mt-2">
                                              <span className="font-medium">
                                                Missing Quotes:
                                              </span>
                                              <ul className="list-disc pl-4 mt-1 space-y-1">
                                                {articleData.analysis.verifiedQuotes.missingQuotes.map(
                                                  (
                                                    quote: string,
                                                    i: number,
                                                  ) => (
                                                    <li
                                                      key={`missing-quote-${article.id}-${i}`}
                                                      className="mt-1 bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700"
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
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-6 text-center border border-zinc-200 dark:border-zinc-700">
                    <FileText
                      size={32}
                      className="mx-auto mb-3 text-zinc-400 dark:text-zinc-500"
                    />
                    <p className="text-zinc-500 dark:text-zinc-400">
                      No source articles found.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
            >
              <h3 className="text-lg font-medium flex items-center text-zinc-900 dark:text-zinc-100">
                <Info
                  size={18}
                  className="mr-2 text-blue-500 dark:text-blue-400"
                />
                Report Metadata
              </h3>
              <div className="flex items-center">
                <span className="text-sm text-zinc-500 dark:text-zinc-400 mr-2">
                  {isMetadataExpanded ? "Hide" : "Show"} details
                </span>
                <ArrowDown
                  size={18}
                  className={`text-zinc-500 dark:text-zinc-400 transition-transform duration-300 ${
                    isMetadataExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {isMetadataExpanded && (
              <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <h4 className="text-sm font-medium mb-3 flex items-center text-zinc-800 dark:text-zinc-200">
                      <Info
                        size={14}
                        className="mr-2 text-blue-500 dark:text-blue-400"
                      />
                      Basic Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 w-32">
                          Report ID:
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400 break-all">
                          {report.id}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 w-32">
                          Session ID:
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400 break-all">
                          {report.item_id || "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 w-32">
                          Created:
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 w-32">
                          Updated:
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {new Date(report.updated_at).toLocaleString()}
                        </span>
                      </div>
                      {report.data?.report?.model && (
                        <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300 w-32">
                            Model:
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {report.data.report.model}
                          </span>
                        </div>
                      )}
                      {report.data?.report?.log_id && (
                        <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300 w-32">
                            Log ID:
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400 break-all">
                            {report.data.report.log_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <h4 className="text-sm font-medium mb-3 flex items-center text-zinc-800 dark:text-zinc-200">
                      <ExternalLink
                        size={14}
                        className="mr-2 text-blue-500 dark:text-blue-400"
                      />
                      Citation Information
                    </h4>
                    {report.data?.report?.citations?.length ? (
                      <div className="space-y-3">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Citations:
                        </span>
                        <ul className="text-sm list-none pl-0 space-y-2">
                          {report.data.report.citations.map(
                            (citation: string, i: number) => (
                              <li
                                // biome-ignore lint/suspicious/noArrayIndexKey: No need to use index as key
                                key={`citation-${i}`}
                                className="break-all bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700"
                              >
                                <a
                                  href={citation}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 inline-flex items-center transition-colors"
                                >
                                  {citation.length > 50
                                    ? `${citation.substring(0, 50)}...`
                                    : citation}
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
                    ) : (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                        No citations available
                      </p>
                    )}

                    {report.data?.report?.verifiedQuotes && (
                      <div className="mt-4">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Quotes Verification:
                        </span>
                        <div className="text-sm mt-2 bg-white dark:bg-zinc-800 p-3 rounded border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center">
                            <span className="font-medium mr-2">Status:</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                report.data.report.verifiedQuotes.verified
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                              }`}
                            >
                              {report.data.report.verifiedQuotes.verified
                                ? "Verified"
                                : "Not Verified"}
                            </span>
                          </div>

                          {report.data.report.verifiedQuotes.missingQuotes
                            ?.length > 0 && (
                            <div className="mt-3">
                              <span className="font-medium">
                                Missing Quotes:
                              </span>
                              <ul className="list-disc pl-5 mt-2 space-y-2">
                                {report.data.report.verifiedQuotes.missingQuotes.map(
                                  (quote: string, i: number) => (
                                    <li
                                      // biome-ignore lint/suspicious/noArrayIndexKey: No need to use index as key
                                      key={`missing-quote-${i}`}
                                      className="bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-200 dark:border-zinc-700"
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
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
