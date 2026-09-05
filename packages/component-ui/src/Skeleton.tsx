import { cn } from "./utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("bg-selection animate-pulse rounded-md motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
