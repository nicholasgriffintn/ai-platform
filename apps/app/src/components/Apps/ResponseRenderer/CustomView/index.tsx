import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { JsonView } from "../JsonView";
import { renderCustomView } from "./registry";

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
	const registeredView = renderCustomView(data.name, {
		data: customData,
		embedded,
		onToolInteraction,
	});

	if (registeredView) {
		return registeredView;
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
