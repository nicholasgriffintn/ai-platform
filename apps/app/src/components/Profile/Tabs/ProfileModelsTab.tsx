import { ModelCard } from "~/components/ModelCard";
import { Banner } from "~/components/ui/Banner";
import { useModels } from "~/hooks/useModels";

export function ProfileModelsTab() {
  const { data: apiModels = {}, isLoading: isLoadingModels } = useModels();

  console.log(apiModels);

  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">
        Available Models
      </h2>

      <Banner>
        TODO: The ability to enable models and configure their api tokens is
        coming soon.
      </Banner>

      <div className="space-y-4">
        {isLoadingModels ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        ) : Object.keys(apiModels).length === 0 ? (
          <Banner>No models available</Banner>
        ) : (
          <>
            {Object.entries(apiModels).map(([modelId, model]) => (
              <ModelCard key={modelId} model={model} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
