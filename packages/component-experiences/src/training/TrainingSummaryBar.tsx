import { Button } from "@ngriffin_uk/polychat-component-ui";
import { RefreshCcw } from "lucide-react";

import { TrainingSummaryCard } from "./TrainingSummaryCard";

export interface TrainingSummaryBarProps {
  modelCount: number;
  jobCount: number;
  deploymentCount: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function TrainingSummaryBar({
  modelCount,
  jobCount,
  deploymentCount,
  onRefresh,
  isRefreshing = false,
}: TrainingSummaryBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 flex-1">
        <TrainingSummaryCard label="Models" value={modelCount} />
        <TrainingSummaryCard label="Jobs" value={jobCount} />
        <TrainingSummaryCard label="Deployments" value={deploymentCount} />
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshCcw className="h-4 w-4" />}
        onClick={onRefresh}
        isLoading={isRefreshing}
      >
        Refresh
      </Button>
    </div>
  );
}
