import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "~/components/ui";
import {
  useDynamicApp,
  useDynamicApps,
  useExecuteDynamicApp,
} from "~/hooks/useDynamicApps";
import { useChatStore } from "~/state/stores/chatStore";
import { AppCard } from "./AppCard";
import { DynamicForm } from "./DynamicForm";
import { ResponseRenderer } from "./ResponseRenderer";
import { groupAppsByCategory, styles } from "./utils";

export const DynamicApps = () => {
  const { isPro, isAuthenticated, isAuthenticationLoading } = useChatStore();

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const {
    data: apps = [],
    isLoading: appsLoading,
    error: appsError,
  } = useDynamicApps();

  const {
    data: selectedApp,
    isLoading: appLoading,
    error: appError,
  } = useDynamicApp(selectedAppId);

  const { mutateAsync: executeApp, isPending: isExecuting } =
    useExecuteDynamicApp();

  const groupedApps = useMemo(() => {
    return groupAppsByCategory(apps);
  }, [apps]);

  const handleAppSelect = useCallback((appId: string) => {
    setSelectedAppId(appId);
    setResult(null);
  }, []);

  const handleFormSubmit = useCallback(
    async (formData: Record<string, any>) => {
      if (!selectedAppId) return {};

      try {
        const result = await executeApp({ id: selectedAppId, formData });
        setResult(result);
        return result;
      } catch (error) {
        console.error(`Error executing app ${selectedAppId}:`, error);
        throw error;
      }
    },
    [selectedAppId, executeApp],
  );

  const handleReset = useCallback(() => {
    setResult(null);
  }, []);

  const handleBackToApps = useCallback(() => {
    setSelectedAppId(null);
    setResult(null);
  }, []);

  const renderCategoryApps = useCallback(
    (category: string, categoryApps: any[]) => (
      <div key={category} className="space-y-6">
        <h2 className={styles.subheading}>{category}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryApps.map((app) => (
            <div
              key={app.id}
              className="transform transition-transform hover:scale-[1.02] h-[200px]"
            >
              <AppCard app={app} onSelect={() => handleAppSelect(app.id)} />
            </div>
          ))}
        </div>
      </div>
    ),
    [handleAppSelect],
  );

  const responseContent = useMemo(() => {
    if (!result || !selectedApp) return null;

    return (
      <ResponseRenderer
        app={selectedApp}
        result={result}
        onReset={handleReset}
      />
    );
  }, [selectedApp, result, handleReset]);

  const formContent = useMemo(() => {
    if (!selectedApp) return null;

    return (
      <DynamicForm
        app={selectedApp}
        onSubmit={handleFormSubmit}
        onComplete={(result) => setResult(result)}
        isSubmitting={isExecuting}
      />
    );
  }, [selectedApp, handleFormSubmit, isExecuting]);

  const error = appsError || appError;

  if (appsLoading || appLoading || isAuthenticationLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400">
        Please login to use apps
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400">
        Please upgrade to a pro plan to use apps
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold mb-2">Failed to load apps</h3>
        <p>
          {error instanceof Error ? error.message : "Unknown error occurred"}
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-off-white-highlight dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-md"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!selectedAppId || !selectedApp) {
    return (
      <div className={styles.container}>
        <h1 className={`${styles.heading} mb-10`}>Available Apps</h1>

        {apps.length === 0 ? (
          <div className="bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-md">
            No apps available. Please check back later.
          </div>
        ) : (
          <div className="space-y-12">
            {groupedApps.map(([category, categoryApps]) =>
              renderCategoryApps(category, categoryApps),
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Button
        type="button"
        variant="link"
        className="mb-6"
        onClick={handleBackToApps}
        icon={<ArrowLeft size={18} />}
      >
        Back to Apps
      </Button>

      {result ? responseContent : formContent}
    </div>
  );
};
