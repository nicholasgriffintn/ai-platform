import { CustomView } from "./CustomView";
import { GeneratedAudioView } from "./GeneratedAudioView";
import { GeneratedImageView } from "./GeneratedImageView";
import { JsonView } from "./JsonView";
import {
	resolveGeneratedAudioResponseData,
	resolveGeneratedImageResponseData,
	resolveJsonResponseData,
	resolveResponseData,
	resolveTableResponseData,
	resolveTemplateResponseData,
	resolveTextResponseData,
} from "./response-data";
import { TableView } from "./TableView";
import { TemplateView } from "./TemplateView";
import { TextView } from "./TextView";

export interface ResponseDisplay {
	fields?: { key: string; label: string }[];
	template?: string;
}

export interface ResponseViewProps {
	result: Record<string, any>;
	/** Declared by the tool schema, or overridden by the caller for a stored result. */
	responseType?: string;
	responseDisplay?: ResponseDisplay;
	/** True when the tool's own schema described this result, which changes data resolution. */
	hasToolSchema?: boolean;
	embedded?: boolean;
	onToolInteraction?: (toolName: string, action: "useAsPrompt", data: Record<string, any>) => void;
}

export function ResponseView({
	result,
	responseType,
	responseDisplay,
	hasToolSchema = false,
	embedded = false,
	onToolInteraction,
}: ResponseViewProps) {
	const responseData = resolveResponseData(result, {
		hasAppSchema: hasToolSchema,
		responseType,
	});

	const generatedImageData =
		resolveGeneratedImageResponseData(result) ?? resolveGeneratedImageResponseData(responseData);
	if (generatedImageData) {
		return <GeneratedImageView data={generatedImageData} />;
	}
	const generatedAudioData =
		resolveGeneratedAudioResponseData(result) ?? resolveGeneratedAudioResponseData(responseData);
	if (generatedAudioData) {
		return <GeneratedAudioView data={generatedAudioData} />;
	}

	const customView = (
		<CustomView
			messageContent={result.content}
			data={responseData}
			toolName={typeof result.name === "string" ? result.name : undefined}
			embedded={embedded}
			onToolInteraction={onToolInteraction}
		/>
	);

	if (!responseType) {
		return customView;
	}

	switch (responseType) {
		case "hidden":
			return null;

		case "table":
			return <TableView data={resolveTableResponseData(responseData, responseDisplay?.fields)} />;

		case "json":
			return <JsonView data={resolveJsonResponseData(responseData)} />;

		case "text":
			return <TextView data={resolveTextResponseData(result, responseData)} />;

		case "template":
			return (
				<TemplateView
					template={responseDisplay?.template}
					data={resolveTemplateResponseData(responseData)}
				/>
			);

		default:
			return customView;
	}
}
