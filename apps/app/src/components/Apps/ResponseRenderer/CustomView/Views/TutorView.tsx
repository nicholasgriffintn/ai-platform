import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { Favicon } from "~/components/ui";
import { MemoizedMarkdown } from "~/components/ui/Markdown";

export function TutorView({
  data,
  embedded,
}: {
  data: any;
  embedded: boolean;
}) {
  const [showAllSources, setShowAllSources] = useState(false);

  if (!data) {
    return <p className="text-red-500">No tutor data available</p>;
  }

  const { answer, sources, completion_id } = data;

  const getDomain = (url: string) => {
    try {
      return url.replace(/(https?:\/\/)?(www\.)?/i, "").split("/")[0];
    } catch (_e) {
      return url;
    }
  };

  const handleToggleSources = () => {
    setShowAllSources(!showAllSources);
  };

  const displayedSources = showAllSources ? sources : sources?.slice(0, 3);

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="mb-6">
        <div className="flex items-center text-sm mb-2 text-zinc-600 dark:text-zinc-300">
          <ArrowRight className="h-5 w-5 mr-2" aria-hidden="true" />
          <span>{sources?.length || 0} sources</span>
        </div>

        <div id="source-list" className="flex flex-wrap gap-2 mb-4">
          {displayedSources?.map((source: any) => (
            <a
              key={`source-card-${source.url}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[150px] border border-gray-700 rounded-md p-3 hover:bg-gray-800 transition-colors"
              aria-label={`View source: ${source.title}`}
            >
              <div className="flex items-center mb-2">
                <Favicon url={source.url} />
                <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                  {getDomain(source.url)}
                </div>
              </div>
              <p className="text-sm font-medium line-clamp-2 text-zinc-600 dark:text-zinc-300">
                {source.title}
              </p>
            </a>
          ))}

          {!showAllSources && sources?.length > 3 && (
            <button
              type="button"
              onClick={handleToggleSources}
              className="flex items-center justify-center min-w-[100px] p-3 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
              aria-expanded={showAllSources}
              aria-controls="source-list"
            >
              <span className="text-zinc-600 dark:text-zinc-300">
                +{sources.length - 3} sources
              </span>
            </button>
          )}

          {showAllSources && sources?.length > 3 && (
            <button
              type="button"
              onClick={handleToggleSources}
              className="flex items-center justify-center min-w-[100px] p-3 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <span className="text-zinc-600 dark:text-zinc-300">
                Show less
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 text-zinc-600 dark:text-zinc-300">
        <div className="prose dark:prose-invert text-zinc-600 dark:text-zinc-300">
          <MemoizedMarkdown>{answer}</MemoizedMarkdown>
        </div>
      </div>

      {completion_id && !embedded && (
        <div className="mt-8">
          <button
            type="button"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
            onClick={() => {
              window.open(`/?completion_id=${completion_id}`, "_blank");
            }}
            aria-label="Continue the conversation in a new window"
          >
            Continue the conversation
          </button>
        </div>
      )}
    </div>
  );
}
