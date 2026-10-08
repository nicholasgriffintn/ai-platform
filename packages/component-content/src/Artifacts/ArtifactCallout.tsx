import { ProgressLine } from "@ngriffin_uk/polychat-component-ui";
import { Code2, Eye, FileText } from "lucide-react";
import { memo, useMemo } from "react";

import type { ArtifactProps } from "./artifact";
import { isCodeArtifact } from "./artifact-kinds";

export interface ArtifactCalloutProps extends ArtifactProps {
  isGenerating?: boolean;
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
    isGenerating = false,
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
      <div className="artifact-wrapper polychat-motion-enter">
        <button
          type="button"
          className={`artifact-container w-full border border-border text-left ${
            isCombinable && combinableCount && combinableCount > 1
              ? "rounded-t-md rounded-b-none"
              : "rounded-md"
          } my-1 cursor-pointer p-2 transition-colors hover:border-active-work/45`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={`Open ${title || "artifact"}`}
        >
          <div className="flex items-start gap-2">
            <div className="mt-1 flex-shrink-0">{icon}</div>
            <div className="min-w-0 flex-grow">
              <span className="truncate text-sm font-medium">{title || "Artifact"}</span>
              <p
                className={`text-xs text-muted-foreground ${isGenerating ? "polychat-motion-shimmer" : ""}`}
              >
                {isGenerating
                  ? `Writing the ${isCode ? "code" : "file"}…`
                  : `Click here to open the ${isCode ? "code" : "file"}`}
              </p>
            </div>
            {language && (
              <span className="mr-1 flex-shrink-0 text-xs text-muted-foreground">{language}</span>
            )}
          </div>
          {isGenerating ? (
            <ProgressLine label={`Writing ${title || "artifact"}`} className="mt-2" />
          ) : null}
        </button>

        {isCombinable && combinableCount && combinableCount > 1 && (
          <button
            type="button"
            className="preview-together-button -mt-1 flex w-full cursor-pointer items-center justify-center gap-1 rounded-b-md border border-t-0 border-active-work/45 bg-active-work/12 px-2 py-1 text-xs text-active-work transition-colors hover:bg-active-work/20"
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
