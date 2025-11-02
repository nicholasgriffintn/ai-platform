import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import type { AppSchema } from "~/types/apps";
import { getCardGradient, getIcon, getIconContainerClass } from "../utils";
import { CustomView } from "./CustomView";
import { JsonView } from "./JsonView";
import { TableView } from "./TableView";
import { TemplateView } from "./TemplateView";
import { TextView } from "./TextView";

interface ResponseRendererProps {
	app?: AppSchema;
	result: Record<string, any>;
	onReset?: () => void;
	responseType?: string;
	responseDisplay?: {
		fields?: {
			key: string;
			label: string;
		}[];
		template?: string;
	};
	className?: string;
	embedded?: boolean;
	onToolInteraction?: (
		toolName: string,
		action: "useAsPrompt",
		data: Record<string, any>,
	) => void;
}

export const ResponseRenderer = ({
	app,
	result,
	onReset,
	responseType,
	responseDisplay,
	className = "",
	embedded = false,
	onToolInteraction,
}: ResponseRendererProps) => {
	const renderResponse = () => {
		const type = responseType || app?.responseSchema.type;
		const resultData = result.data || result;

		let responseData;
		if (app && resultData?.result) {
			responseData = resultData.result;
		} else if (responseType && "result" in resultData) {
			responseData = resultData.result;
		} else if (responseType && "results" in resultData) {
			responseData = resultData.results;
		} else {
			responseData = resultData;
		}

		const display = responseDisplay || app?.responseSchema.display;

		if (!type) {
			return (
				<CustomView
					messageContent={result.content}
					data={responseData}
					embedded={embedded}
					onToolInteraction={onToolInteraction}
				/>
			);
		}

		switch (type) {
			case "table":
				if (responseDisplay?.fields && Array.isArray(responseData)) {
					const tableData = {
						headers: responseDisplay.fields,
						rows: responseData,
					};
					return <TableView data={tableData} />;
				}
				return <TableView data={responseData} />;

			case "json":
				return <JsonView data={responseData} />;

			case "text":
				if (typeof responseData === "string") {
					return <TextView data={{ content: responseData }} />;
				}
				return <TextView data={responseData} />;

			case "template":
				return (
					<TemplateView
						template={display?.template}
						data={{ data: responseData }}
					/>
				);

			default:
				return (
					<CustomView
						messageContent={result.content}
						data={responseData}
						embedded={embedded}
						onToolInteraction={onToolInteraction}
					/>
				);
		}
	};

	if (app && onReset) {
		return (
			<div className="max-w-3xl mx-auto">
				<div
					className={cn(
						"border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-off-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600",
						"bg-gradient-to-br",
						getCardGradient(app.theme),
						"mb-6",
					)}
				>
					<div className="mb-6">
						<div className="flex items-center space-x-4 mb-4">
							<div
								className={cn(
									"p-3 rounded-lg shadow-sm",
									getIconContainerClass(app.theme),
								)}
							>
								{getIcon(app.icon, app.theme)}
							</div>
							<div>
								<h1
									className={cn(
										"text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-50",
									)}
								>
									{app.name} - Results
								</h1>
								<p className={cn("text-zinc-600 dark:text-zinc-300")}>
									{result.data?.message || `Results for ${app.name}`}
								</p>
								{result.data?.timestamp && (
									<p
										className={cn(
											"text-sm text-zinc-500 dark:text-zinc-400",
											"mt-1",
										)}
									>
										Generated on:{" "}
										{new Date(result.data.timestamp).toLocaleString()}
									</p>
								)}
							</div>
						</div>
					</div>

					<div className="bg-off-white/80 dark:bg-zinc-800/80 p-5 rounded-lg">
						{renderResponse()}
					</div>

					<div className="flex justify-between mt-6">
						<Button variant="secondary" onClick={onReset}>
							Start Over
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return <div className={className}>{renderResponse()}</div>;
};
