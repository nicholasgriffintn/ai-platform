export const MessageSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="flex justify-start">
        <div className="bg-surface text-foreground flex w-full flex-col">
          <div className="flex flex-col gap-2 px-3 py-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 overflow-x-auto">
                <div className="space-y-3">
                  <div className="bg-selection h-4 w-1/4 rounded" />
                  <div className="space-y-2">
                    <div className="bg-selection h-3 w-full rounded" />
                    <div className="bg-selection h-3 w-3/4 rounded" />
                    <div className="bg-selection h-3 w-5/6 rounded" />
                    <div className="bg-selection h-3 w-2/3 rounded" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 mt-2">
              <div className="flex items-center space-x-1">
                <div className="bg-selection h-6 w-6 rounded-lg" />
                <div className="bg-selection h-6 w-6 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
