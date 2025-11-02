import { useState, useMemo } from "react";
import { Link } from "react-router";
import { useReplicateModels } from "~/hooks/useReplicate";
import type { ReplicateModel } from "~/types/replicate";
import { AppCard } from "~/components/Apps/AppCard";
import type { AppListItem } from "~/types/apps";

export function ReplicateModels() {
  const { data: models, isLoading, error } = useReplicateModels();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allTypes = useMemo(() => {
    return Array.from(
      new Set(models?.flatMap((model) => model.type) || []),
    ).sort();
  }, [models]);

  const filteredModels = useMemo(() => {
    return models?.filter((model) => {
      const matchesType = !selectedType || model.type.includes(selectedType);
      const matchesSearch =
        !searchQuery ||
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [models, selectedType, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold mb-2">Failed to load models</h3>
        <p>Please try again later.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/apps/replicate/predictions"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          View my predictions →
        </Link>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedType || ""}
          onChange={(e) => setSelectedType(e.target.value || null)}
          className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {allTypes.map((type) => (
            <option key={type} value={type}>
              {type.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModels?.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>

      {filteredModels?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-500 dark:text-zinc-400">
            No models found matching your criteria.
          </p>
        </div>
      )}
    </div>
  );
}

interface ModelCardProps {
  model: ReplicateModel;
}

function ModelCard({ model }: ModelCardProps) {
  const appItem: AppListItem = {
    id: model.id,
    name: model.name,
    description: model.description,
    icon: "sparkles",
    category:
      model.type[0]
        ?.replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()) || "AI",
    kind: "frontend",
    href: `/apps/replicate/${model.id}`,
  };

  return (
    <Link
      to={`/apps/replicate/${model.id}`}
      className="block transform transition-transform hover:scale-[1.02] h-[200px] no-underline"
    >
      <AppCard app={appItem} onSelect={() => {}} />
    </Link>
  );
}
