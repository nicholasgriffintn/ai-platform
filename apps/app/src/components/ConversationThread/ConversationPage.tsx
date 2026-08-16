import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";

import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import {
	type AssistantActionLaunchState,
	loadAssistantActionRequestOptions,
	parseAssistantActionLaunchState,
	removeConsumedAssistantActionLaunchParams,
} from "~/lib/assistant-action-launch";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import { mergeChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/request-options";
import type { ChatRequestOptions } from "~/types";
import { ConversationThread, type ConversationThreadModeConfig } from ".";
import { ConversationProductHeader } from "./ConversationProductHeader";

interface ConversationPageProps {
	embedded?: boolean;
	title: string;
	modeConfig?: ConversationThreadModeConfig;
	sidebarContent?: ReactNode;
}

export function ConversationPage({
	embedded = false,
	title,
	modeConfig,
	sidebarContent,
}: ConversationPageProps) {
	const { clearCurrentConversation, initializeStore, setChatInput, startNewConversation } =
		useChatStore();
	const { setSelectedTools } = useToolsStore();
	const location = useLocation();
	const [urlRequestOptions, setUrlRequestOptions] = useState<ChatRequestOptions | undefined>();
	const [urlState, setUrlState] = useState<AssistantActionLaunchState | null>(null);
	const handledLocationKeyRef = useRef<string | null>(null);

	useEffect(() => {
		// React replays mount effects in development, so consume each launch URL only once.
		const locationKey = `${location.pathname}${location.search}`;
		if (handledLocationKeyRef.current === locationKey) {
			return;
		}
		handledLocationKeyRef.current = locationKey;

		const init = async () => {
			const searchParams = new URLSearchParams(location.search);
			const completionId = searchParams.get("completion_id");
			const nextUrlState = parseAssistantActionLaunchState(location.search);

			if (!completionId) {
				clearCurrentConversation();
			}
			await initializeStore(completionId || undefined);

			if (nextUrlState.autoSubmit) {
				startNewConversation();
				setChatInput("");
			} else if (nextUrlState.query) {
				setChatInput(nextUrlState.query);
			}
			if (nextUrlState.hasEnabledTools) {
				setSelectedTools(nextUrlState.enabledTools);
			}
			setUrlRequestOptions(loadAssistantActionRequestOptions(nextUrlState));
			setUrlState(nextUrlState);

			if (nextUrlState.autoSubmit) {
				const query = removeConsumedAssistantActionLaunchParams(location.search);
				window.history.replaceState(
					{},
					"",
					`${window.location.pathname}${query ? `?${query}` : ""}`,
				);
			}
		};

		init();
	}, [
		clearCurrentConversation,
		initializeStore,
		location.pathname,
		location.search,
		setChatInput,
		setSelectedTools,
		startNewConversation,
	]);

	const effectiveModeConfig = useMemo<ConversationThreadModeConfig | undefined>(() => {
		const initialAutoSubmit =
			urlState?.autoSubmit && urlState.query
				? {
						key: `${location.pathname}${location.search}`,
						input: urlState.query,
					}
				: modeConfig?.initialAutoSubmit;

		if (!urlRequestOptions && !initialAutoSubmit) {
			return modeConfig;
		}

		return {
			...modeConfig,
			requestOptions: mergeChatRequestOptions(modeConfig?.requestOptions, urlRequestOptions),
			initialAutoSubmit,
		};
	}, [location.pathname, location.search, modeConfig, urlRequestOptions, urlState]);

	const content = (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			{!embedded && <ConversationProductHeader />}
			<div className="relative flex min-h-0 flex-1 flex-grow flex-row overflow-hidden">
				<div className="flex min-h-0 w-full flex-grow flex-col">
					<div className="relative min-h-0 flex-1 overflow-hidden">
						<ConversationThread modeConfig={effectiveModeConfig} />
					</div>
				</div>
			</div>
		</div>
	);

	if (embedded) {
		return content;
	}

	return (
		<PageShell
			sidebarContent={sidebarContent ?? <ChatSidebar />}
			fullBleed={true}
			displayNavBar={false}
			headerContent={<PageTitle title={title} className="sr-only" />}
		>
			{content}
		</PageShell>
	);
}
