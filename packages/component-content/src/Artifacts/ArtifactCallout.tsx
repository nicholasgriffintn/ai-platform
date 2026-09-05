import { Code2, Eye, FileText } from "lucide-react";
import { memo, useMemo } from "react";

import type { ArtifactProps } from "./artifact";
import { isCodeArtifact } from "./artifact-kinds";

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
      return isCodeArtifact({ type, language });
    }, [type, language]);

    const icon = isCode ? <Code2 size={16} /> : <FileText size={16} />;

    return (
      <div className="artifact-wrapper">
        <button
          type="button"
          className={`artifact-container w-full text-left border border-border ${
            isCombinable && combinableCount && combinableCount > 1
              ? "rounded-t-md rounded-b-none"
              : "rounded-md"
          } p-2 my-1 hover:border-active-work/45 transition-colors cursor-pointer`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={`Open ${title || "artifact"}`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-1">{icon}</div>
            <div className="flex-grow min-w-0">
              <span className="text-sm font-medium truncate">{title || "Artifact"}</span>
              <p className="text-xs text-muted-foreground">
                Click here to open the {isCode ? "code" : "file"}
              </p>
            </div>
            {language && (
              <span className="text-xs text-muted-foreground flex-shrink-0 mr-1">{language}</span>
            )}
          </div>
        </button>

        {isCombinable && combinableCount && combinableCount > 1 && (
          <button
            type="button"
            className="cursor-pointer preview-together-button w-full flex items-center justify-center gap-1 text-xs bg-active-work/12 text-active-work py-1 px-2 rounded-b-md hover:bg-active-work/20 transition-colors -mt-1 border border-t-0 border-active-work/45"
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
