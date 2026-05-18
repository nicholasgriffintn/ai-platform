import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { JsonView } from "../JsonView";
import { AddReasoningStepView } from "./Views/AddReasoningStepView";
import { TutorView } from "./Views/TutorView";
import { WebSearchView } from "./Views/WebSearchView";
import { ResearchView } from "./Views/ResearchView";
import { SandboxView } from "./Views/SandboxView";

export function CustomView({
	messageContent,
	data,
	embedded,
	onToolInteraction,
}: {
	messageContent: string;
	data: any;
	embedded: boolean;
	onToolInteraction?: (toolName: string, action: "useAsPrompt", data: Record<string, any>) => void;
}) {
	const customData = data.data || data;

	if (data.name === "web_search") {
		return (
			<WebSearchView data={customData} embedded={embedded} onToolInteraction={onToolInteraction} />
		);
	}

	if (data.name === "research") {
		return <ResearchView data={customData} embedded={embedded} />;
	}

	if (data.name === "tutor") {
		return <TutorView data={customData} embedded={embedded} />;
	}

	if (data.name === "add_reasoning_step") {
		return <AddReasoningStepView data={customData} embedded={embedded} />;
	}

	if (
		data.name === "sandbox_plan" ||
		data.name === "sandbox_event" ||
		data.name === "sandbox_result"
	) {
		return <SandboxView type={data.name} data={customData} />;
	}

	console.info("ResponseRenderer custom response -> it's on you now!", customData);
	return (
		<>
			<JsonView data={customData} />
			{typeof messageContent === "string" && (
				<div className="mt-6">
					<MemoizedMarkdown>{messageContent}</MemoizedMarkdown>
				</div>
			)}
		</>
	);
}
