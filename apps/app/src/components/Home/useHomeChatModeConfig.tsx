import { defaultCouncilMemberIds, type CouncilMemberId } from "@assistant/schemas";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { CouncilChatControls } from "~/components/Council/CouncilChatControls";
import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
import { ActiveHomeChatModeControl, HomeChatModeMenu } from "./HomeChatModeControls";
import { type HomeChatModeId, resolveHomeChatModeId } from "./chatModes";

type CouncilResponseMode = "debate" | "single";

export function useHomeChatModeConfig(): {
	activeModeId: HomeChatModeId;
	modeConfig: ConversationThreadModeConfig;
} {
	const [searchParams, setSearchParams] = useSearchParams();
	const [activeModeId, setActiveModeId] = useState<HomeChatModeId>(() =>
		resolveHomeChatModeId(searchParams.get("mode")),
	);
	const [selectedCouncilMemberIds, setSelectedCouncilMemberIds] = useState<CouncilMemberId[]>([
		...defaultCouncilMemberIds,
	]);
	const [councilResponseMode, setCouncilResponseMode] = useState<CouncilResponseMode>("debate");

	useEffect(() => {
		setActiveModeId(resolveHomeChatModeId(searchParams.get("mode")));
	}, [searchParams]);

	const handleModeChange = useCallback(
		(modeId: HomeChatModeId) => {
			setActiveModeId(modeId);
			const next = new URLSearchParams(searchParams);
			if (modeId === "chat") {
				next.delete("mode");
			} else {
				next.set("mode", modeId);
			}
			setSearchParams(next, { replace: true });
		},
		[searchParams, setSearchParams],
	);

	return useMemo<{
		activeModeId: HomeChatModeId;
		modeConfig: ConversationThreadModeConfig;
	}>(() => {
		const councilControls = (
			<CouncilChatControls
				selectedMemberIds={selectedCouncilMemberIds}
				onSelectedMemberIdsChange={setSelectedCouncilMemberIds}
				responseMode={councilResponseMode}
				onResponseModeChange={setCouncilResponseMode}
			/>
		);
		const modeControls = {
			menu: <HomeChatModeMenu activeModeId={activeModeId} onModeChange={handleModeChange} />,
			activeControl:
				activeModeId === "chat" ? undefined : (
					<ActiveHomeChatModeControl activeModeId={activeModeId} onModeChange={handleModeChange} />
				),
			onClearActive: activeModeId === "chat" ? undefined : () => handleModeChange("chat"),
		};

		if (activeModeId !== "council") {
			return {
				activeModeId,
				modeConfig: {
					modeControls,
				},
			};
		}

		return {
			activeModeId,
			modeConfig: {
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
						responseMode: councilResponseMode,
						memberIds: selectedCouncilMemberIds,
						requireConsensus: true,
					},
				},
				councilDebate:
					councilResponseMode === "debate"
						? {
								enabled: true,
								memberIds: selectedCouncilMemberIds,
								requireConsensus: true,
							}
						: undefined,
				inputControls: councilControls,
				modeControls,
			},
		};
	}, [activeModeId, handleModeChange, selectedCouncilMemberIds, councilResponseMode]);
}
