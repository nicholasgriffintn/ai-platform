import { Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { EmptyState } from "~/components/Core/EmptyState";
import { Logo } from "~/components/Core/Logo";
import { Button, SearchInput } from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
  useDynamicApp,
  useDynamicApps,
  useExecuteDynamicApp,
} from "~/hooks/useDynamicApps";
import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import { BackLink } from "../Core/BackLink";
import { PageHeader } from "../Core/PageHeader";
import { AppCard } from "./AppCard";
import { DynamicForm } from "./DynamicForm";
import { FeaturedApps } from "./FeaturedApps";
import { ResponseRenderer } from "./ResponseRenderer";
import { groupAppsByCategory } from "./utils";

export const DynamicApps = () => {
  const { isAuthenticationLoading, isPro } = useChatStore();
  const { trackEvent } = useTrackEvent();
  const navigate = useNavigate();

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return apps;

    const query = searchQuery.toLowerCase();
    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(query) ||
        app.description?.toLowerCase().includes(query) ||
        app.category?.toLowerCase().includes(query),
    );
  }, [apps, searchQuery]);

  const groupedApps = useMemo(() => {
    return groupAppsByCategory(filteredApps);
  }, [filteredApps]);

  const handleAppSelect = useCallback(
    (appId: string) => {
      const app = apps.find((a) => a.id === appId);

      if (app && app.type === "premium" && !isPro) {
        return;
      }

      setSelectedAppId(appId);
      setResult(null);

      trackEvent({
        name: "app_select",
        category: "apps",
        label: "app_select",
        value: appId,
      });
    },
    [trackEvent, apps, isPro],
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
        if (result?.response_id) {
          navigate(`/apps/responses/${result.response_id}`);
        } else {
          setResult(result);
        }
        return result;
      } catch (error) {
        console.error(`Error executing app ${selectedAppId}:`, error);
        throw error;
      }
    },
    [selectedAppId, executeApp, trackEvent, navigate],
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
          data-category={category}
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
      <div className={cn("container mx-auto px-4 max-w-7xl")}>
        <div className="mb-6">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search apps..."
            className="max-w-md"
            disabled
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton count={6} showHeader showFooter />
        </div>
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
        </PageHeader>
        <div className="flex-grow overflow-auto space-y-6">
          {responseContent || formContent}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("container mx-auto px-4 max-w-7xl")}>
      {apps.length > 0 && (
        <div className="mb-6">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search apps..."
            className="max-w-md"
          />
        </div>
      )}

      {apps.length === 0 && !appsLoading ? (
        <EmptyState
          variant="welcome"
          icon={<Logo variant="logo_control" />}
          title="Welcome to Apps"
          message="Discover powerful AI-powered applications to boost your productivity."
          suggestions={[
            {
              label: "Article Research",
              onClick: () => handleAppSelect("articles"),
            },
            {
              label: "Podcast Generation",
              onClick: () => handleAppSelect("podcasts"),
            },
            {
              label: "Image Creation",
              onClick: () => handleAppSelect("replicate"),
            },
          ]}
        />
      ) : (
        <>
          <FeaturedApps searchQuery={searchQuery} />

          {filteredApps.length === 0 &&
          searchQuery &&
          groupedApps.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-8 w-8 text-zinc-400" />}
              title="No apps found"
              message={`No apps matching "${searchQuery}"`}
              action={
                <Button onClick={() => setSearchQuery("")} variant="secondary">
                  Clear Search
                </Button>
              }
            />
          ) : (
            groupedApps.map(([category, categoryApps]) =>
              renderCategoryApps(category, categoryApps),
            )
          )}
        </>
      )}
    </div>
  );
};
