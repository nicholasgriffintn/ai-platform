import { Code2, Eye, FileText } from "lucide-react";
import { memo, useMemo } from "react";

import type { ArtifactProps } from "~/types/artifact";

export interface ArtifactCalloutProps extends ArtifactProps {
  isCombinable?: boolean;
  combinableCount?: number;
  artifacts?: ArtifactProps[];
}

export const ArtifactCallout = memo(
  ({
    identifier,
    type,
    language,
    title,
    content,
    onOpen,
    isCombinable,
    combinableCount,
    artifacts,
  }: ArtifactCalloutProps) => {
    const handleClick = () => {
      if (onOpen) {
        onOpen({ identifier, type, language, title, content }, false);
      }
    };

    const handleCombineClick = () => {
      if (onOpen) {
        onOpen({ identifier, type, language, title, content }, true, artifacts);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    };

    const isCode = useMemo(() => {
      const includedLanguages = ["jsx", "javascript", "html", "svg"];
      const includedTypes = [
        "text/jsx",
        "text/javascript",
        "text/html",
        "image/svg+xml",
      ];

      return (
        includedLanguages.some((lang) =>
          language?.toLowerCase().includes(lang),
        ) || includedTypes.some((type) => type?.includes(type))
      );
    }, [language]);

    const icon = isCode ? <Code2 size={16} /> : <FileText size={16} />;

    return (
      <div className="artifact-wrapper">
        <button
          type="button"
          className={`artifact-container w-full text-left border border-zinc-200 dark:border-zinc-700 ${
            isCombinable && combinableCount && combinableCount > 1
              ? "rounded-t-md rounded-b-none"
              : "rounded-md"
          } p-2 my-1 hover:border-blue-300 dark:hover:border-blue-500 transition-colors cursor-pointer`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={`Open ${title || "artifact"}`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-1">{icon}</div>
            <div className="flex-grow min-w-0">
              <h3 className="text-sm font-medium truncate">
                {title || "Artifact"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click here to open the {isCode ? "code" : "file"}
              </p>
            </div>
            {language && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0 mr-1">
                {language}
              </span>
            )}
          </div>
        </button>

        {isCombinable && combinableCount && combinableCount > 1 && (
          <button
            type="button"
            className="cursor-pointer preview-together-button w-full flex items-center justify-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 py-1 px-2 rounded-b-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors -mt-1 border border-t-0 border-blue-200 dark:border-blue-800"
            onClick={handleCombineClick}
            aria-label={`Preview with ${combinableCount - 1} other artifact${combinableCount > 2 ? "s" : ""}`}
          >
            <Eye size={12} />
            <span>
              Preview together with {combinableCount - 1} other file
              {combinableCount > 2 ? "s" : ""}
            </span>
          </button>
        )}
      </div>
    );
  },
);
