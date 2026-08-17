import { ProjectConversationStarter as ControlledProjectConversationStarter } from "@ngriffin_uk/polychat-component-workspaces";
import { useNavigate } from "react-router";

import { createAssistantActionConversationUrl } from "~/lib/assistant-action-launch";

export function ProjectConversationStarter({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const navigate = useNavigate();

	return (
		<ControlledProjectConversationStarter
			onStart={(prompt) => {
				navigate(
					createAssistantActionConversationUrl(
						{ input: prompt, enabledTools: [] },
						`/work/${workspaceId}/projects/${projectId}/chat`,
					),
				);
			}}
		/>
	);
}
