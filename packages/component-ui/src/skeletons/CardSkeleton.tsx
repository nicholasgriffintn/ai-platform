import { Skeleton } from "../Skeleton";

interface CardSkeletonProps {
  count?: number;
  showHeader?: boolean;
  showFooter?: boolean;
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
          // oxlint-disable-next-line react/no-array-index-key -- static loading placeholders with no data; keys never reorder
          key={index}
          className="rounded-lg border border-border bg-surface p-6"
        >
          {showHeader && (
            <div className="mb-4 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          )}
          <div className="space-y-3">
            {Array.from({ length: contentLines }).map((_line, lineIndex) => (
              <Skeleton
                // oxlint-disable-next-line react/no-array-index-key -- static loading placeholders with no data; keys never reorder
                key={lineIndex}
                className="h-4"
                style={{
                  width: `${[82, 68, 94, 74][lineIndex % 4]}%`,
                }}
              />
            ))}
          </div>
          {showFooter && (
            <div className="mt-4 flex gap-2 border-t border-border pt-4">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
