import { TrendingUp } from "lucide-react";
import type { MarketplaceAgent } from "~/types";
import { MarketplaceAgentCard } from "./MarketplaceAgentCard";

interface FeaturedAgentsProps {
  agents: MarketplaceAgent[];
  onInstall: (agentId: string) => Promise<void>;
  onViewDetails: (agent: MarketplaceAgent) => void;
  isInstalling: boolean;
}

export function FeaturedAgents({
  agents,
  onInstall,
  onViewDetails,
  isInstalling,
}: FeaturedAgentsProps) {
  if (agents.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-yellow-500" />
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Featured Agents
        </h2>
        <span className="inline-block px-2 py-1 text-xs rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {agents.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.slice(0, 6).map((agent) => (
          <MarketplaceAgentCard
            key={agent.id}
            agent={agent}
            onInstall={onInstall}
            onViewDetails={onViewDetails}
            isInstalling={isInstalling}
          />
        ))}
      </div>
    </div>
  );
}
