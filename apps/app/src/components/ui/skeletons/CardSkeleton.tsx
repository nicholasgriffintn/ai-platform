import { Skeleton } from "../Skeleton";

interface CardSkeletonProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Whether to show header section */
  showHeader?: boolean;
  /** Whether to show footer section */
  showFooter?: boolean;
  /** Number of content lines */
  contentLines?: number;
}

export function CardSkeleton({
  count = 1,
  showHeader = true,
  showFooter = false,
  contentLines = 3,
}: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6"
        >
          {showHeader && (
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          )}
          <div className="space-y-3">
            {Array.from({ length: contentLines }).map((_, lineIndex) => (
              <Skeleton
                key={lineIndex}
                className="h-4"
                style={{
                  width: `${Math.max(60, Math.random() * 40 + 60)}%`,
                }}
              />
            ))}
          </div>
          {showFooter && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
