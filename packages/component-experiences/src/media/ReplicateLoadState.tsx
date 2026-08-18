export interface ReplicateLoadingProps {
  minHeight?: string;
}

export function ReplicateLoading({ minHeight = "min-h-[400px]" }: ReplicateLoadingProps) {
  return (
    <div className={`flex justify-center items-center ${minHeight}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
    </div>
  );
}

export interface ReplicateLoadErrorProps {
  title: string;
}

export function ReplicateLoadError({ title }: ReplicateLoadErrorProps) {
  return (
    <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
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
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-100" />
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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{message}</p>
      </div>
    </div>
  );
}
