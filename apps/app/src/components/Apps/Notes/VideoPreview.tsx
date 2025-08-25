import { memo } from "react";

interface VideoPreviewProps {
  url: string;
  className?: string;
}

export const VideoPreview = memo(function VideoPreview({
  url,
  className = "",
}: VideoPreviewProps) {
  const getVideoTitle = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split("/").pop() || "Video";
    } catch {
      return "Video";
    }
  };

  return (
    <div
      className={`bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.55-2.55c.85-.47 1.85.12 1.85 1.09v6.92c0 .97-1 1.56-1.85 1.09L15 14m0-4v4m0-4V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1v-4z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
            {getVideoTitle(url)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
            {url}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-2 py-1 text-xs font-medium bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
            VIDEO
          </span>
        </div>
      </div>
    </div>
  );
});
