import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useMarketplace } from "~/hooks/useMarketplace";
import { useMarketplaceStore } from "~/state/stores/marketplaceStore";
import type { MarketplaceAgent } from "~/types";
import { PageHeader } from "../PageHeader";
import { AgentDetailModal } from "./AgentDetailModal";
import { FeaturedAgents } from "./FeaturedAgents";
import { MarketplaceAgentCard } from "./MarketplaceAgentCard";
import { MarketplaceFilters } from "./MarketplaceFilters";

export function Marketplace() {
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);

  const { getFilters } = useMarketplaceStore();
  const filters = getFilters();

  const {
    agents,
    featuredAgents,
    categories,
    tags,
    isLoadingAgents,
    errorAgents,
    installAgent,
    isInstallingAgent,
    rateAgent,
  } = useMarketplace(filters);

  const handleInstallAgent = useCallback(
    async (agentId: string) => {
      try {
        await installAgent(agentId);
        toast.success("Agent installed successfully!");
      } catch (error) {
        console.error("Failed to install agent:", error);
        toast.error("Failed to install agent. Please try again.");
      }
    },
    [installAgent],
  );

  const handleRateAgent = useCallback(
    async (agentId: string, rating: number, review?: string) => {
      try {
        await rateAgent({ agentId, rating, review });
        toast.success("Rating submitted successfully!");
      } catch (error) {
        console.error("Failed to rate agent:", error);
        toast.error("Failed to submit rating. Please try again.");
      }
    },
    [rateAgent],
  );

  const handleViewDetails = useCallback((agent: MarketplaceAgent) => {
    setSelectedAgent(agent);
    setShowDetailModal(true);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setSelectedAgent(null);
  }, []);

  const groupedAgents = useMemo(() => {
    if (!agents.length) return {};

    return agents.reduce(
      (groups, agent) => {
        const category = agent.category || "Other";
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(agent);
        return groups;
      },
      {} as Record<string, MarketplaceAgent[]>,
    );
  }, [agents]);

  if (errorAgents) {
    return (
      <div className="flex flex-col space-y-4">
        <PageHeader>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Agent Marketplace
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
              Discover and install powerful AI agents created by the community
            </p>
          </div>
        </PageHeader>
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-2">
            Failed to load marketplace
          </div>
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page or check your connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <PageHeader>
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Agent Marketplace
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            Discover and install powerful AI agents created by the community.
            Find specialized assistants for coding, writing, analysis, and more.
          </p>
        </div>
      </PageHeader>

      {/* Featured Agents */}
      <FeaturedAgents
        agents={featuredAgents}
        onInstall={handleInstallAgent}
        onViewDetails={handleViewDetails}
        isInstalling={isInstallingAgent}
      />

      {/* Filters */}
      <MarketplaceFilters categories={categories} tags={tags} />

      {/* Agents by Category */}
      {isLoadingAgents ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`loading-${i}`}
              className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : Object.keys(groupedAgents).length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg mb-2">
            No agents found
          </div>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search criteria or browse different categories.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedAgents).map(([category, categoryAgents]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {category} ({categoryAgents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryAgents.map((agent) => (
                  <MarketplaceAgentCard
                    key={agent.id}
                    agent={agent}
                    onInstall={handleInstallAgent}
                    onViewDetails={handleViewDetails}
                    isInstalling={isInstallingAgent}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Detail Modal */}
      <AgentDetailModal
        agent={selectedAgent}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
        onInstall={handleInstallAgent}
        onRate={handleRateAgent}
        isInstalling={isInstallingAgent}
      />
    </div>
  );
}
