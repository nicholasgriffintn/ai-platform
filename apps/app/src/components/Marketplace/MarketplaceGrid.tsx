import { Grid, List } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Skeleton } from "~/components/ui/Skeleton";
import { cn } from "~/lib/utils";
import { useMarketplaceStore } from "~/state/stores/marketplaceStore";
import type { MarketplaceAgent } from "~/types";
import { MarketplaceAgentCard } from "./MarketplaceAgentCard";

interface MarketplaceGridProps {
  agents: MarketplaceAgent[];
  isLoading: boolean;
  onInstallAgent: (agentId: string) => Promise<void>;
  onViewDetails: (agent: MarketplaceAgent) => void;
  className?: string;
}

export function MarketplaceGrid({
  agents,
  isLoading,
  onInstallAgent,
  onViewDetails,
  className,
}: MarketplaceGridProps) {
  const { viewMode, setViewMode } = useMarketplaceStore();
  const [installingAgents, setInstallingAgents] = useState<Set<string>>(
    new Set(),
  );

  const handleInstall = async (agentId: string) => {
    try {
      setInstallingAgents((prev) => new Set([...prev, agentId]));
      await onInstallAgent(agentId);
    } finally {
      setInstallingAgents((prev) => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>

        <div
          className={cn(
            "grid gap-6",
            viewMode === "grid"
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1",
          )}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "rounded-xl",
                viewMode === "grid" ? "h-80" : "h-32",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="text-muted-foreground text-lg mb-2">
          No agents found
        </div>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search criteria or browse different categories.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {agents.length} agent{agents.length === 1 ? "" : "s"} found
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="p-2"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="p-2"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6",
          viewMode === "grid"
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1",
        )}
      >
        {agents.map((agent) => (
          <MarketplaceAgentCard
            key={agent.id}
            agent={agent}
            onInstall={handleInstall}
            onViewDetails={onViewDetails}
            isInstalling={installingAgents.has(agent.id)}
            className={cn(
              viewMode === "list" &&
                "md:flex md:flex-row md:h-auto [&_[data-slot=card-content]]:md:flex-1",
            )}
          />
        ))}
      </div>
    </div>
  );
}
