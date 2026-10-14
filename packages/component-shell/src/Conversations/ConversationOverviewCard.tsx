import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { WorkbenchCard, WorkbenchFact } from "@ngriffin_uk/polychat-component-ui";
import { formatStatsTokens } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { getModelDisplayName } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import {
  Briefcase,
  Clock3,
  GitBranch,
  Globe,
  HardDrive,
  Lock,
  MessageCircle,
  Cloud,
} from "lucide-react";

import type { ConversationWorkbenchContext } from "./useConversationWorkbenchContext.js";

export function ConversationOverviewCard({
  workbench,
}: {
  workbench: ConversationWorkbenchContext;
}) {
  const { conversation, model, provider, modelConfig } = workbench;
  const modelName = modelConfig ? getModelDisplayName(modelConfig) : model;
  const isProject = Boolean(conversation?.project_id);

  return (
    <WorkbenchCard title="Conversation" icon={MessageCircle}>
      <div className="space-y-0.5">
        {modelName ? (
          <WorkbenchFact
            leading={
              <span className="flex shrink-0">
                <ModelIcon modelName={model ?? modelName} provider={provider} size={14} mono />
              </span>
            }
            label={modelName}
            value={
              modelConfig?.contextWindow
                ? `${formatStatsTokens(modelConfig.contextWindow)} window`
                : provider
            }
            title={provider ? `${modelName} via ${provider}` : modelName}
          />
        ) : null}
        <WorkbenchFact
          icon={isProject ? Briefcase : MessageCircle}
          label={isProject ? "Project conversation" : "Personal chat"}
        />
        <WorkbenchFact
          icon={conversation?.isLocalOnly ? HardDrive : Cloud}
          label={conversation?.isLocalOnly ? "Kept on this device" : "Saved to your account"}
        />
        <WorkbenchFact
          icon={conversation?.is_public ? Globe : Lock}
          label={conversation?.is_public ? "Shared by link" : "Private"}
        />
        {conversation?.has_branches ? <WorkbenchFact icon={GitBranch} label="Has threads" /> : null}
        {conversation?.created_at ? (
          <WorkbenchFact
            icon={Clock3}
            label="Started"
            value={formatRelativeTime(conversation.created_at)}
          />
        ) : null}
      </div>
    </WorkbenchCard>
  );
}
