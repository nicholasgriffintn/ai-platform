import { InfoTooltip } from "~/components/ui/InfoTooltip";
import { cn } from "~/lib/utils";
import type { Message } from "~/types";

interface MessageInfoProps {
  message: Message;
  buttonClassName?: string;
}

export const MessageInfo = ({ message, buttonClassName }: MessageInfoProps) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getMessageInfo = () => (
    <div className="space-y-2">
      <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
        Message Information
      </h4>
      <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Time:{" "}
          {message.created
            ? formatDate(message.created)
            : message.timestamp
              ? formatDate(message.timestamp)
              : "Unknown"}
        </p>
        {message.model && <p>Model: {message.model}</p>}
        {message.platform && <p>Platform: {message.platform}</p>}
        {message.usage && (
          <div className="space-y-1">
            <p className="font-medium">Token Usage:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Prompt: {message.usage.prompt_tokens}</li>
              <li>Completion: {message.usage.completion_tokens}</li>
              <li>Total: {message.usage.total_tokens}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <InfoTooltip
      content={getMessageInfo()}
      buttonClassName={cn(buttonClassName, "flex items-center")}
      tooltipClassName="w-72 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-900 shadow-lg"
    />
  );
};
