import { Popover, PopoverContent, PopoverTrigger } from "@ngriffin_uk/polychat-component-ui";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  formatStatsCost,
  formatStatsDuration,
  formatStatsTokens,
  getMessageStats,
  readTokenUsageCounts,
} from "@ngriffin_uk/polychat-library-chat/response-stats";
import { getModelDisplayName } from "@ngriffin_uk/polychat-schemas";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { Info } from "lucide-react";

interface MessageInfoProps {
  message: Message;
  modelConfig?: ModelConfigItem;
  responseDurationMs?: number;
  buttonClassName?: string;
}

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString();

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="m-0 text-right tabular-nums text-foreground">{value}</dd>
  </div>
);

export const MessageInfo = ({
  message,
  modelConfig,
  responseDurationMs,
  buttonClassName,
}: MessageInfoProps) => {
  const timestamp = message.created ?? message.timestamp;
  const stats = getMessageStats(message, {
    durationMs: responseDurationMs,
    pricing: modelConfig,
  });
  const usage = readTokenUsageCounts(message.usage);
  const modelName = modelConfig ? getModelDisplayName(modelConfig) : message.model;
  const provider = modelConfig?.provider ?? message.provider;

  return (
    <Popover>
      <PopoverTrigger className={buttonClassName} aria-label="Message details">
        <Info size={14} />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3 text-sm">
          <h4 className="font-medium text-foreground">Message details</h4>
          <dl className="space-y-1">
            <Row label="Time" value={timestamp ? formatTimestamp(timestamp) : "Unknown"} />
            {modelName && <Row label="Model" value={modelName} />}
            {provider && <Row label="Provider" value={provider} />}
            {message.platform && <Row label="Platform" value={message.platform} />}
            {stats.durationMs !== undefined && (
              <Row label="Duration" value={formatStatsDuration(stats.durationMs)} />
            )}
            {stats.toolCount !== undefined && <Row label="Tools" value={String(stats.toolCount)} />}
          </dl>
          {usage && (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="font-medium text-foreground">Tokens</p>
              <dl className="space-y-1">
                {usage.inputTokens !== undefined && (
                  <Row label="Input" value={formatStatsTokens(usage.inputTokens)} />
                )}
                {usage.outputTokens !== undefined && (
                  <Row label="Output" value={formatStatsTokens(usage.outputTokens)} />
                )}
                {usage.totalTokens !== undefined && (
                  <Row label="Total" value={formatStatsTokens(usage.totalTokens)} />
                )}
                {stats.estimatedCostUsd !== undefined && (
                  <Row label="Cost" value={`~${formatStatsCost(stats.estimatedCostUsd)}`} />
                )}
              </dl>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
