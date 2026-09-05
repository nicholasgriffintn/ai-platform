export interface ReplicateLoadingProps {
  minHeight?: string;
}

export function ReplicateLoading({ minHeight = "min-h-[400px]" }: ReplicateLoadingProps) {
  return (
    <div className={`flex justify-center items-center ${minHeight}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-active-work" />
    </div>
  );
}

export interface ReplicateLoadErrorProps {
  title: string;
}

export function ReplicateLoadError({ title }: ReplicateLoadErrorProps) {
  return (
    <div className="p-4 bg-attention/12 text-attention rounded-md border border-attention/45">
      <h3 className="font-semibold mb-2">{title}</h3>
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
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border" />
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
      <div className="bg-failure/12 border border-failure/45 rounded-lg p-4">
        <p className="text-failure">{message}</p>
      </div>
    </div>
  );
}
