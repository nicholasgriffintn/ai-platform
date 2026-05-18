import { defaultCouncilMemberIds, type CouncilMemberId } from "@assistant/schemas";
import { useMemo, useState } from "react";

import { CouncilChatControls } from "~/components/Council/CouncilChatControls";
import { ConversationPage } from "~/components/ConversationThread/ConversationPage";
import type { ConversationThreadModeConfig } from "~/components/ConversationThread";

export function meta() {
	return [
		{ title: "AI Council - Polychat" },
		{
			name: "description",
			content: "Debate a problem with a selected council of AI perspectives.",
		},
	];
}

export default function CouncilApp() {
	const [selectedMemberIds, setSelectedMemberIds] = useState<CouncilMemberId[]>([
		...defaultCouncilMemberIds,
	]);
	const [responseMode, setResponseMode] = useState<"debate" | "single">("debate");

	const modeConfig = useMemo<ConversationThreadModeConfig>(
		() => ({
			analyticsSource: "council",
			welcomeTitle: "What should the council debate?",
			welcomeDescription:
				"Pick council members, describe the problem, and the backend chat pipeline will run a structured debate before answering.",
			inputPlaceholder: {
				newConversation: "Give the council a problem to debate...",
				followUp: "Ask the council to refine its decision...",
			},
			requestOptions: {
				council: {
					enabled: true,
					responseMode,
					memberIds: selectedMemberIds,
					maxRounds: 3,
					requireConsensus: true,
				},
			},
			councilDebate:
				responseMode === "debate"
					? {
							enabled: true,
							memberIds: selectedMemberIds,
							requireConsensus: true,
						}
					: undefined,
			inputControls: (
				<CouncilChatControls
					selectedMemberIds={selectedMemberIds}
					onSelectedMemberIdsChange={setSelectedMemberIds}
					responseMode={responseMode}
					onResponseModeChange={setResponseMode}
				/>
			),
		}),
		[selectedMemberIds, responseMode],
	);

	return <ConversationPage title="AI Council" modeConfig={modeConfig} />;
}
