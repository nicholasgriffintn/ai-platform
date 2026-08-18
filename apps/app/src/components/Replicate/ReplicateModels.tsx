import { groupAppsByCategory } from "@ngriffin_uk/polychat-component-capabilities";
import {
  ReplicateLoadError,
  ReplicateModelCategoryGrid,
  ReplicateModelFilters,
} from "@ngriffin_uk/polychat-component-experiences/media";
import { Button, EmptyState, CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import type { CapabilityCatalogItem as AppListItem } from "@ngriffin_uk/polychat-schemas";
import { Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppCard } from "~/components/Apps/AppCard";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useReplicateModels } from "~/hooks/useReplicate";
import { isAuthenticationError } from "~/lib/errors";

const DEFAULT_CATEGORY = "Creative Tools";

const formatTypeLabel = (type: string): string =>
  type.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function ReplicateModels({ basePath, projectId }: { basePath: string; projectId?: string }) {
  const { data: models, isLoading, error } = useReplicateModels(projectId);
  const navigate = useNavigate();
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const signatureFilters = useMemo(
    () =>
      Array.from(
        new Map(
          (models ?? []).map((model) => [model.modalitySignature, model.modalityLabel]),
        ).entries(),
      )
        .map(([signature, label]) => ({
          signature,
          label: label ?? formatTypeLabel(signature.replace("->", " to ")),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [models],
  );

  const filteredModels = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return (models ?? []).filter((model) => {
      if (selectedSignature && model.modalitySignature !== selectedSignature) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableFields = [
        model.name,
        model.description,
        model.category,
        model.modalityLabel,
        ...(model.tags ?? []),
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return searchableFields.some((field) => field.includes(normalizedQuery));
    });
  }, [models, selectedSignature, searchQuery]);

  const appItems = useMemo<AppListItem[]>(() => {
    return filteredModels.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      icon: model.icon ?? "sparkles",
      category: model.category ?? model.modalityLabel ?? DEFAULT_CATEGORY,
      theme: model.theme,
      tags: model.tags ?? [model.modalityLabel],
      href: `${basePath}/${model.id}`,
      kind: model.kind ?? "frontend",
      featured: model.featured,
      type: "normal",
    }));
  }, [basePath, filteredModels]);

  const groupedApps = useMemo(() => groupAppsByCategory(appItems), [appItems]);

  const handleModelSelect = useCallback(
    (app: AppListItem) => {
      void navigate(`${basePath}/${app.id}`);
    },
    [basePath, navigate],
  );

  const handlePredictionsClick = useCallback(() => {
    void navigate(`${basePath}/predictions`);
  }, [basePath, navigate]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedSignature(null);
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton count={6} showHeader showFooter />
        </div>
      </div>
    );
  }

  if (error) {
    if (isAuthenticationError(error)) {
      return (
        <SignInEmptyState
          title="Sign in to view Replicate models"
          message="Sign in to access the models available to this project."
          className="min-h-[300px]"
        />
      );
    }

    return <ReplicateLoadError title="Failed to load models" />;
  }

  const hasResults = appItems.length > 0;

  return (
    <div>
      <ReplicateModelFilters
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        signatureFilters={signatureFilters}
        selectedSignature={selectedSignature}
        onSelectedSignatureChange={setSelectedSignature}
        onViewPredictions={handlePredictionsClick}
      />

      {hasResults ? (
        <ReplicateModelCategoryGrid
          categories={groupedApps.map(([category, categoryApps]) => ({
            category,
            models: categoryApps,
          }))}
          renderModel={(app) => <AppCard app={app} onSelect={() => handleModelSelect(app)} />}
        />
      ) : (
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-zinc-400" />}
          title="No models found"
          message={
            searchQuery || selectedSignature
              ? "Try adjusting your search or filters to discover different models."
              : "No Replicate models are currently available."
          }
          action={
            searchQuery || selectedSignature ? (
              <Button variant="secondary" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
