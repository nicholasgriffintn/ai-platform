import { useCallback, useMemo, useState } from "react";

import { Button } from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
  useDynamicApp,
  useDynamicApps,
  useExecuteDynamicApp,
} from "~/hooks/useDynamicApps";
import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import { BackLink } from "../BackLink";
import { PageHeader } from "../PageHeader";
import { PageTitle } from "../PageTitle";
import { AppCard } from "./AppCard";
import { DynamicForm } from "./DynamicForm";
import { FeaturedApps } from "./FeaturedApps";
import { ResponseRenderer } from "./ResponseRenderer";
import { groupAppsByCategory } from "./utils";

export const DynamicApps = () => {
  const { isAuthenticationLoading } = useChatStore();
  const trackEvent = useTrackEvent();

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

  const handleAppSelect = useCallback(
    (appId: string) => {
      setSelectedAppId(appId);
      setResult(null);

      trackEvent({
        name: "app_select",
        category: "apps",
        label: "app_select",
        value: appId,
      });
    },
    [trackEvent],
  );

  const handleFormSubmit = useCallback(
    async (formData: Record<string, any>) => {
      if (!selectedAppId) return {};

      try {
        trackEvent({
          name: "app_submit",
          category: "apps",
          label: "app_submit",
          value: selectedAppId,
        });

        const result = await executeApp({ id: selectedAppId, formData });
        setResult(result);
        return result;
      } catch (error) {
        console.error(`Error executing app ${selectedAppId}:`, error);
        throw error;
      }
    },
    [selectedAppId, executeApp, trackEvent],
  );

  const handleReset = useCallback(() => {
    trackEvent({
      name: "app_reset",
      category: "apps",
      label: "app_reset",
      value: selectedAppId || "null",
    });
    setResult(null);
  }, [selectedAppId, trackEvent]);

  const handleBackToApps = useCallback(() => {
    trackEvent({
      name: "back_to_apps",
      category: "apps",
      label: "back_to_apps",
      value: 1,
    });
    setSelectedAppId(null);
    setResult(null);
  }, [trackEvent]);

  const renderCategoryApps = useCallback(
    (category: string, categoryApps: any[]) => (
      <div key={category} className="space-y-6">
        <h2
          className={cn(
            "text-xl font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-2",
          )}
        >
          {category}
        </h2>
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

  if (selectedAppId && selectedApp) {
    return (
      <div className={cn("container mx-auto px-4 max-w-7xl")}>
        <PageHeader>
          <BackLink onClick={handleBackToApps} label="Back to Apps" />
          <PageTitle title={selectedApp.name} />
        </PageHeader>
        <div className="flex-grow overflow-auto space-y-6">
          <p className="text-zinc-600 dark:text-zinc-300">
            {selectedApp.description}
          </p>
          {responseContent || formContent}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("container mx-auto px-4 max-w-7xl")}>
      <FeaturedApps />

      {groupedApps.map(([category, categoryApps]) =>
        renderCategoryApps(category, categoryApps),
      )}

      {apps.length > 0 && groupedApps.length === 0 && (
        <div className="text-center text-zinc-500 dark:text-zinc-400 py-10">
          No apps available in your selected categories.
        </div>
      )}
      {apps.length === 0 && !appsLoading && (
        <div className="text-center text-zinc-500 dark:text-zinc-400 py-10">
          No apps found.
        </div>
      )}
    </div>
  );
};
