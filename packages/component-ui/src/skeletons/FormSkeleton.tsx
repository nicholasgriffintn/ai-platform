import { Skeleton } from "../Skeleton";

interface FormSkeletonProps {
  fields?: number;
  showButton?: boolean;
}

export function FormSkeleton({ fields = 3, showButton = true }: FormSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, index) => (
        <div
          // oxlint-disable-next-line react/no-array-index-key -- static loading placeholders with no data; keys never reorder
          key={index}
          className="space-y-2"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      {showButton && (
        <div className="flex justify-end gap-2 pt-4">
          <Skeleton className="h-10 w-20 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      )}
    </div>
  );
}
