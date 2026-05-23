import type { ReactNode } from "react";

import { AddReasoningStepView } from "./Views/AddReasoningStepView";
import { ResearchView } from "./Views/ResearchView";
import { SandboxView } from "./Views/SandboxView";
import { TutorView } from "./Views/TutorView";
import { WebSearchView } from "./Views/WebSearchView";

interface CustomViewRendererProps {
	data: any;
	embedded: boolean;
	onToolInteraction?: (toolName: string, action: "useAsPrompt", data: Record<string, any>) => void;
}

type CustomViewRenderer = (props: CustomViewRendererProps) => ReactNode;

const CUSTOM_VIEW_RENDERERS: Record<string, CustomViewRenderer> = {
	web_search: ({ data, embedded, onToolInteraction }) => (
		<WebSearchView data={data} embedded={embedded} onToolInteraction={onToolInteraction} />
	),
	research: ({ data, embedded }) => <ResearchView data={data} embedded={embedded} />,
	tutor: ({ data, embedded }) => <TutorView data={data} embedded={embedded} />,
	add_reasoning_step: ({ data, embedded }) => (
		<AddReasoningStepView data={data} embedded={embedded} />
	),
	sandbox_plan: ({ data }) => <SandboxView type="sandbox_plan" data={data} />,
	sandbox_event: ({ data }) => <SandboxView type="sandbox_event" data={data} />,
	sandbox_result: ({ data }) => <SandboxView type="sandbox_result" data={data} />,
};

export function renderCustomView(
	name: string | undefined,
	props: CustomViewRendererProps,
): ReactNode | null {
	if (!name) {
		return null;
	}

	return CUSTOM_VIEW_RENDERERS[name]?.(props) ?? null;
}
