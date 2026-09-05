import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ArticleReportItem } from "@ngriffin_uk/polychat-schemas";
import { ArrowDown, ExternalLink, Info } from "lucide-react";
import { useState } from "react";

interface ArticleReportMetadataProps {
  report: ArticleReportItem;
}

export function ArticleReportMetadata({ report }: ArticleReportMetadataProps) {
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  return (
    <div className="border-border bg-surface overflow-hidden rounded-lg border shadow-sm">
      <button
        type="button"
        onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated transition-colors"
      >
        <h3 className="text-lg font-medium flex items-center text-foreground">
          <Info size={18} className="mr-2 text-active-work" />
          Report Metadata
        </h3>
        <div className="flex items-center">
          <span className="text-sm text-muted-foreground mr-2">
            {isMetadataExpanded ? "Hide" : "Show"} details
          </span>
          <ArrowDown
            size={18}
            className={cn(
              "text-muted-foreground transition-transform duration-300",
              isMetadataExpanded ? "rotate-180" : "",
            )}
          />
        </div>
      </button>

      {isMetadataExpanded && (
        <div className="p-5 border-t border-border animate-in slide-in-from-top-10 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-border bg-surface-elevated rounded-lg border p-4">
              <h4 className="text-sm font-medium mb-3 flex items-center text-foreground">
                <Info size={14} className="mr-2 text-active-work" />
                Basic Information
              </h4>
              <div className="space-y-1 text-sm">
                <MetadataItem label="Report ID">{report.id}</MetadataItem>
                <MetadataItem label="Session ID">{report.groupId || "N/A"}</MetadataItem>
                <MetadataItem label="Created">
                  {new Date(report.createdAt).toLocaleString()}
                </MetadataItem>
                <MetadataItem label="Updated">
                  {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : "N/A"}
                </MetadataItem>
                {report.content.report?.model && (
                  <MetadataItem label="Model">{report.content.report.model}</MetadataItem>
                )}
                {report.content.report?.log_id && (
                  <MetadataItem label="Log ID">{report.content.report.log_id}</MetadataItem>
                )}
              </div>
            </div>

            <div className="border-border bg-surface-elevated rounded-lg border p-4">
              <h4 className="text-sm font-medium mb-3 flex items-center text-foreground">
                <ExternalLink size={14} className="mr-2 text-active-work" />
                Citation Information
              </h4>
              {report.content.report?.citations?.length ? (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground block mb-1">Citations:</span>
                  <ul className="text-sm list-none pl-0 space-y-1.5">
                    {report.content.report.citations.map((citation: string, i: number) => (
                      <li
                        key={`citation-${report.id}-${i}`}
                        className="border-border bg-surface rounded border p-2 break-all"
                      >
                        <a
                          href={citation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-active-work hover:text-active-work inline-flex items-center transition-colors group"
                        >
                          <span className="truncate group-hover:underline">{citation}</span>
                          <ExternalLink size={10} className="ml-1 flex-shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No citations available</p>
              )}

              {report.content.report?.verifiedQuotes && (
                <div className="mt-4">
                  <span className="text-sm font-medium text-foreground block mb-2">
                    Quotes Verification:
                  </span>
                  <div className="border-border bg-surface space-y-3 rounded border p-3 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium mr-2 text-foreground">Status:</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          report.content.report.verifiedQuotes.verified
                            ? "bg-success/12 text-success"
                            : "bg-failure/12 text-failure",
                        )}
                      >
                        {report.content.report.verifiedQuotes.verified
                          ? "Verified"
                          : "Not Verified"}
                      </span>
                    </div>

                    {report.content.report.verifiedQuotes.missingQuotes.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="font-medium text-foreground">Missing Quotes:</span>
                        <ul className="list-disc pl-5 mt-2 space-y-1.5">
                          {report.content.report.verifiedQuotes.missingQuotes.map(
                            (quote: string, i: number) => (
                              <li
                                key={`missing-quote-${report.id}-${i}`}
                                className="border-border bg-surface-elevated text-foreground rounded border p-2"
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

function MetadataItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start py-1.5 border-b border-border last:border-0">
      <span className="font-medium text-foreground w-32 flex-shrink-0 mb-1 sm:mb-0">{label}:</span>
      <span className="text-muted-foreground break-words min-w-0">{children}</span>
    </div>
  );
}
