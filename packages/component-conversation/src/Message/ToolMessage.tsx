import { ConnectorApprovalCard } from "./ConnectorApprovalCard";
import { readConnectorApprovalRequest } from "@ngriffin_uk/polychat-schemas";
import { Terminal } from "lucide-react";

import { ResponseView } from "@ngriffin_uk/polychat-component-content";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";

interface ToolMessageProps {
	message: Message;
	onToolInteraction?: (toolName: string, action: "useAsPrompt", data: Record<string, any>) => void;
	onConnectorApproval?: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
}

export const ToolMessage = ({
	message,
	onToolInteraction,
	onConnectorApproval,
}: ToolMessageProps) => {
	if (!message.data) return null;
	const approvalData = isRecord(message.data) ? message.data : undefined;
	if (approvalData && readConnectorApprovalRequest(approvalData)) {
		return <ConnectorApprovalCard data={approvalData} onResolve={onConnectorApproval} />;
	}
	return (
		<div className="mb-2">
			<div className="text-xs font-medium text-blue-700 dark:text-blue-300 pt-1">
				<div className="flex items-start gap-2">
					<ToolIcon />
					{message.data?.formattedName || message.name} {message.status && `(${message.status})`}
				</div>
			</div>
			<div>
				<div className="mt-1">
					<ResponseView
						result={{
							status: message.status || "success",
							name: message.name || "Tool",
							content: message.content || "",
							data: message.data,
						}}
						responseType={typeof message.data === "object" ? message.data.responseType : undefined}
						responseDisplay={
							typeof message.data === "object" ? message.data.responseDisplay : undefined
						}
						embedded={true}
						onToolInteraction={onToolInteraction}
					/>
				</div>
			</div>
		</div>
	);
};

export const ToolIcon = () => <Terminal size={18} className="text-blue-600 dark:text-blue-400" />;
