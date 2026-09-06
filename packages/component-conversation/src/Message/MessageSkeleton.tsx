export const MessageSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="flex justify-start">
        <div className="flex w-full flex-col bg-surface text-foreground">
          <div className="flex flex-col gap-2 px-3 py-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 overflow-x-auto">
                <div className="space-y-3">
                  <div className="h-4 w-1/4 rounded bg-selection" />
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-selection" />
                    <div className="h-3 w-3/4 rounded bg-selection" />
                    <div className="h-3 w-5/6 rounded bg-selection" />
                    <div className="h-3 w-2/3 rounded bg-selection" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-end gap-2">
              <div className="flex items-center space-x-1">
                <div className="h-6 w-6 rounded-lg bg-selection" />
                <div className="h-6 w-6 rounded-lg bg-selection" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
