import { Download, Star, User } from "lucide-react";
import { Card } from "~/components/ui";
import { cn } from "~/lib/utils";
import type { MarketplaceAgent } from "~/types";

interface MarketplaceAgentCardProps {
  agent: MarketplaceAgent;
  onInstall: (agentId: string) => Promise<void>;
  onViewDetails: (agent: MarketplaceAgent) => void;
  isInstalling?: boolean;
  className?: string;
}

export function MarketplaceAgentCard({
  agent,
  onInstall,
  onViewDetails,
  isInstalling = false,
  className,
}: MarketplaceAgentCardProps) {
  const rating = Number.parseFloat(agent.rating_average) || 0;
  const hasRating = agent.rating_count > 0;

  const handleClick = () => {
    onViewDetails(agent);
  };

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInstall(agent.id);
  };

  return (
    <Card
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`View ${agent.name} agent details`}
      className={cn(
        "p-5 shadow-none",
        "cursor-pointer w-full h-full",
        "hover:shadow-lg transition-all duration-200",
        "hover:border-zinc-300 dark:hover:border-zinc-600",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        "bg-transparent",
        agent.is_featured &&
          "bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20",
        className,
      )}
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex flex-col space-y-2 md:flex-row md:items-start md:space-y-0 md:space-x-4">
          <div className="p-3 rounded-lg bg-off-white dark:bg-zinc-700 shadow-sm flex-shrink-0">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="w-8 h-8 rounded-md object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {agent.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col items-start flex-grow min-w-0">
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 truncate w-full">
              {agent.name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
              <User className="w-3 h-3" />
              <span className="truncate">{agent.author}</span>
            </div>
            {agent.is_featured && (
              <span className="inline-block px-2 py-1 text-xs rounded-full mt-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                ⭐ Featured
              </span>
            )}
            {agent.category && (
              <span className="inline-block px-2 py-1 text-xs rounded-full mt-1 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {agent.category}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="flex-grow">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
            {agent.description || "No description available."}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{agent.usage_count.toLocaleString()}</span>
            </div>
            {hasRating && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Install Button */}
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={cn(
            "w-full py-2 px-4 rounded-md text-sm font-medium transition-colors",
            "bg-blue-600 hover:bg-blue-700 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
          )}
        >
          {isInstalling ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Installing...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Download className="w-3 h-3" />
              Install Agent
            </div>
          )}
        </button>
      </div>
    </Card>
  );
}
