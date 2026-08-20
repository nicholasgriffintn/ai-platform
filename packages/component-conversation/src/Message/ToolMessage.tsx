import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { resolveToolMessageDisplay } from "@ngriffin_uk/polychat-library-chat/tool-results";
import { readConnectorApprovalRequest } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { ConnectorApprovalCard } from "./ConnectorApprovalCard";
import { ToolResultView } from "./ToolResultView";

interface ToolMessageProps {
  message: Message;
  onToolInteraction?: ToolInteractionHandler;
  onConnectorApproval?: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
}

export const ToolMessage = ({
  message,
  onToolInteraction,
  onConnectorApproval,
}: ToolMessageProps) => {
  if (!message.data) {
    return null;
  }

  const approvalData = isRecord(message.data) ? message.data : undefined;

  if (approvalData && readConnectorApprovalRequest(approvalData)) {
    return <ConnectorApprovalCard data={approvalData} onResolve={onConnectorApproval} />;
  }

  return (
    <ToolResultView
      display={resolveToolMessageDisplay(message)}
      input={message.tool_call_arguments}
      onToolInteraction={onToolInteraction}
    />
  );
};
