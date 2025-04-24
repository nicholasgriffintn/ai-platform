import { ArrowDown, ExternalLink, Info } from "lucide-react";
import { useState } from "react";

import { cn } from "~/lib/utils";
import type { ArticleReportItem } from "~/types/article";

interface ArticleReportMetadataProps {
  report: ArticleReportItem;
}

export function ArticleReportMetadata({ report }: ArticleReportMetadataProps) {
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <h3 className="text-lg font-medium flex items-center text-zinc-900 dark:text-zinc-100">
          <Info size={18} className="mr-2 text-blue-500 dark:text-blue-400" />
          Report Metadata
        </h3>
        <div className="flex items-center">
          <span className="text-sm text-zinc-500 dark:text-zinc-400 mr-2">
            {isMetadataExpanded ? "Hide" : "Show"} details
          </span>
          <ArrowDown
            size={18}
            className={cn(
              "text-zinc-500 dark:text-zinc-400 transition-transform duration-300",
              isMetadataExpanded ? "rotate-180" : "",
            )}
          />
        </div>
      </button>

      {isMetadataExpanded && (
        <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-10 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-medium mb-3 flex items-center text-zinc-800 dark:text-zinc-200">
                <Info
                  size={14}
                  className="mr-2 text-blue-500 dark:text-blue-400"
                />
                Basic Information
              </h4>
              <div className="space-y-1 text-sm">
                <MetadataItem label="Report ID">{report.id}</MetadataItem>
                <MetadataItem label="Session ID">
                  {report.item_id || "N/A"}
                </MetadataItem>
                <MetadataItem label="Created">
                  {new Date(report.created_at).toLocaleString()}
                </MetadataItem>
                <MetadataItem label="Updated">
                  {new Date(report.updated_at).toLocaleString()}
                </MetadataItem>
                {report.data?.report?.model && (
                  <MetadataItem label="Model">
                    {report.data.report.model}
                  </MetadataItem>
                )}
                {report.data?.report?.log_id && (
                  <MetadataItem label="Log ID">
                    {report.data.report.log_id}
                  </MetadataItem>
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
                <div className="space-y-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Citations:
                  </span>
                  <ul className="text-sm list-none pl-0 space-y-1.5">
                    {report.data.report.citations.map(
                      (citation: string, i: number) => (
                        <li
                          key={`citation-${report.id}-${i}`}
                          className="break-all bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700"
                        >
                          <a
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center transition-colors group"
                          >
                            <span className="truncate group-hover:underline">
                              {citation}
                            </span>
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
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2">
                    Quotes Verification:
                  </span>
                  <div className="text-sm bg-white dark:bg-zinc-800 p-3 rounded border border-zinc-200 dark:border-zinc-700 space-y-3">
                    <div className="flex items-center">
                      <span className="font-medium mr-2 text-zinc-700 dark:text-zinc-300">
                        Status:
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          report.data.report.verifiedQuotes.verified
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
                        )}
                      >
                        {report.data.report.verifiedQuotes.verified
                          ? "Verified"
                          : "Not Verified"}
                      </span>
                    </div>

                    {report.data.report.verifiedQuotes.missingQuotes?.length >
                      0 && (
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          Missing Quotes:
                        </span>
                        <ul className="list-disc pl-5 mt-2 space-y-1.5">
                          {report.data.report.verifiedQuotes.missingQuotes.map(
                            (quote: string, i: number) => (
                              <li
                                key={`missing-quote-${report.id}-${i}`}
                                className="bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
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
  );
}

function MetadataItem({
  label,
  children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start py-1.5 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
      <span className="font-medium text-zinc-700 dark:text-zinc-300 w-32 flex-shrink-0 mb-1 sm:mb-0">
        {label}:
      </span>
      <span className="text-zinc-600 dark:text-zinc-400 break-words min-w-0">
        {children}
      </span>
    </div>
  );
}
