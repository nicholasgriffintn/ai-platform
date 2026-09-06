import { cn } from "./utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-selection motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
