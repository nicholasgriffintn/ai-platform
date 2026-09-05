import { useState } from "react";

import { MemoizedMarkdown } from "../markdown";

const TOOL_OUTPUT_RENDER_CHARACTERS = 40 * 1024;

export function BoundedMarkdown({ content }: { content: string }) {
  const [showFull, setShowFull] = useState(false);
  const isBounded = content.length > TOOL_OUTPUT_RENDER_CHARACTERS;
  const visibleContent =
    isBounded && !showFull ? content.slice(0, TOOL_OUTPUT_RENDER_CHARACTERS) : content;

  return (
    <div>
      <MemoizedMarkdown className="max-w-none">{visibleContent}</MemoizedMarkdown>
      {isBounded ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          onClick={() => setShowFull((current) => !current)}
          aria-expanded={showFull}
        >
          {showFull
            ? "Show output preview"
            : `Show full output (${content.length.toLocaleString()} characters)`}
        </button>
      ) : null}
    </div>
  );
}
