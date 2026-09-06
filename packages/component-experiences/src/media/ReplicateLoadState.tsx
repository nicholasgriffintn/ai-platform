export interface ReplicateLoadingProps {
  minHeight?: string;
}

export function ReplicateLoading({ minHeight = "min-h-[400px]" }: ReplicateLoadingProps) {
  return (
    <div className={`flex items-center justify-center ${minHeight}`}>
      <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-active-work" />
    </div>
  );
}

export interface ReplicateLoadErrorProps {
  title: string;
}

export function ReplicateLoadError({ title }: ReplicateLoadErrorProps) {
  return (
    <div className="rounded-md border border-attention/45 bg-attention/12 p-4 text-attention">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p>Please try again later.</p>
    </div>
  );
}

export interface ReplicateModelLoadingProps {
  fullHeight?: boolean;
}

export function ReplicateModelLoading({ fullHeight = true }: ReplicateModelLoadingProps) {
  return (
    <div className={`flex items-center justify-center ${fullHeight ? "min-h-screen" : "py-12"}`}>
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-border" />
    </div>
  );
}

export interface ReplicateModelLoadErrorProps {
  message?: string;
}

export function ReplicateModelLoadError({
  message = "Failed to load model. Please try again.",
}: ReplicateModelLoadErrorProps) {
  return (
    <div>
      <div className="rounded-lg border border-failure/45 bg-failure/12 p-4">
        <p className="text-failure">{message}</p>
      </div>
    </div>
  );
}
