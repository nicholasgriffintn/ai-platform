import { Settings } from "lucide-react";
import { useRef, useState } from "react";

import { Button, FormInput, FormSelect, RangeInput } from "~/components/ui";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/Dialog";
import { FormCheckbox } from "~/components/ui/Form/Checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useModels } from "~/hooks/useModels";
import { getAvailableModels } from "~/lib/models";
import { useChatStore } from "~/state/stores/chatStore";
import type {
	ChatSettings as ChatSettingsType,
	ReasoningEffort,
	VerbosityLevel,
} from "~/types";
import { ToolSelector } from "./ToolSelector";

interface ChatSettingsProps {
	isDisabled?: boolean;
	supportsToolCalls?: boolean;
	toolSelectionLocked?: boolean;
}

export const ChatSettings = ({
	isDisabled = false,
	supportsToolCalls = false,
	toolSelectionLocked = false,
}: ChatSettingsProps) => {
	const { chatSettings, setChatSettings, model } = useChatStore();
	const [showSettings, setShowSettings] = useState(false);
	const settingsButtonRef = useRef<HTMLButtonElement>(null);
	const { data: apiModels = {} } = useModels();
	const availableModels = getAvailableModels(apiModels);

	const activeModelId = model && model.length > 0 ? model : undefined;
	const selectedModelConfig = activeModelId
		? availableModels[activeModelId]
		: undefined;

	const reasoningOptions =
		selectedModelConfig?.reasoningConfig?.supportedEffortLevels ?? [];
	const verbosityOptions =
		selectedModelConfig?.verbosityConfig?.supportedVerbosityLevels ?? [];

	const formatReasoningLabel = (value: ReasoningEffort) => {
		switch (value) {
			case "none":
				return "None (fastest)";
			case "low":
				return "Low (quick)";
			case "medium":
				return "Medium (balanced)";
			case "high":
				return "High (thorough)";
			default:
				return value;
		}
	};

	const formatVerbosityLabel = (value: VerbosityLevel) => {
		switch (value) {
			case "low":
				return "Low (concise)";
			case "medium":
				return "Medium (balanced)";
			case "high":
				return "High (detailed)";
			default:
				return value;
		}
	};

	const handleSettingChange = (
		key: keyof ChatSettingsType,
		value: string | boolean,
	) => {
		if (typeof value === "string") {
			const numValue = Number.parseFloat(value);
			if (!Number.isNaN(numValue)) {
				setChatSettings({
					...chatSettings,
					[key]: numValue,
				});
				return;
			}

			setChatSettings({
				...chatSettings,
				[key]: value,
			});
		} else {
			setChatSettings({
				...chatSettings,
				[key]: value,
			});
		}
	};

	const handleReasoningEffortChange = (value: string) => {
		const nextValue = value as ReasoningEffort | "";
		if (!nextValue) {
			setChatSettings({
				...chatSettings,
				reasoning: undefined,
			});
			return;
		}
		setChatSettings({
			...chatSettings,
			reasoning: {
				...chatSettings.reasoning,
				effort: nextValue,
			},
		});
	};

	const handleVerbosityChange = (value: string) => {
		const nextValue = value as VerbosityLevel | "";
		if (!nextValue) {
			setChatSettings({
				...chatSettings,
				verbosity: undefined,
			});
			return;
		}
		setChatSettings({
			...chatSettings,
			verbosity: nextValue,
		});
	};

	const handleRagOptionChange = (
		key: keyof NonNullable<ChatSettingsType["rag_options"]>,
		value: string | boolean,
	) => {
		if (typeof value === "boolean") {
			setChatSettings({
				...chatSettings,
				rag_options: {
					...chatSettings.rag_options,
					[key]: value,
				},
			});
			return;
		}

		const numValue = Number.parseFloat(value);
		setChatSettings({
			...chatSettings,
			rag_options: {
				...chatSettings.rag_options,
				[key]: !Number.isNaN(numValue) ? numValue : value,
			},
		});
	};

	return (
		<div className="flex items-center">
			<Button
				ref={settingsButtonRef}
				variant="icon"
				icon={<Settings className="h-4 w-4" />}
				onClick={() => setShowSettings(true)}
				disabled={isDisabled}
				aria-haspopup="dialog"
				aria-expanded={showSettings}
				title="Chat settings"
				aria-label="Open chat settings"
			/>

			{supportsToolCalls && (
				<ToolSelector isDisabled={isDisabled || toolSelectionLocked} />
			)}

			<Dialog open={showSettings} onOpenChange={setShowSettings} width="640px">
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Chat Settings</DialogTitle>
						<DialogClose onClick={() => setShowSettings(false)} />
					</DialogHeader>

					<div className="space-y-4">
						<Tabs defaultValue="basic" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="basic">Basic Settings</TabsTrigger>
								<TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
							</TabsList>
							<TabsContent value="basic" className="space-y-6 pt-4">
								{reasoningOptions.length > 0 && (
									<FormSelect
										id="reasoning_effort"
										label="Reasoning depth"
										value={chatSettings.reasoning?.effort ?? ""}
										onChange={(e) =>
											handleReasoningEffortChange(e.target.value)
										}
										disabled={isDisabled}
										options={[
											{
												value: "",
												label: `Model default${
													selectedModelConfig?.reasoningConfig?.defaultEffort
														? ` (${formatReasoningLabel(
																selectedModelConfig.reasoningConfig
																	.defaultEffort,
															)})`
														: ""
												}`,
											},
											...reasoningOptions.map((option) => ({
												value: option,
												label: formatReasoningLabel(option),
											})),
										]}
										description="Controls how much time the model spends thinking before responding."
									/>
								)}
								{verbosityOptions.length > 0 && (
									<FormSelect
										id="text_verbosity"
										label="Verbosity"
										value={chatSettings?.verbosity ?? ""}
										onChange={(e) => handleVerbosityChange(e.target.value)}
										disabled={isDisabled}
										options={[
											{
												value: "",
												label: `Model default${
													selectedModelConfig?.verbosityConfig?.defaultVerbosity
														? ` (${formatVerbosityLabel(
																selectedModelConfig.verbosityConfig
																	.defaultVerbosity,
															)})`
														: ""
												}`,
											},
											...verbosityOptions.map((option) => ({
												value: option,
												label: formatVerbosityLabel(option),
											})),
										]}
										description="Adjusts how detailed or concise the response should be."
									/>
								)}

								<RangeInput
									id="temperature"
									label="Creativity Level (temperature)"
									min={0}
									max={2}
									step={0.1}
									value={chatSettings.temperature ?? 1}
									onChange={(e) =>
										handleSettingChange("temperature", e.target.value)
									}
									aria-describedby="temperature-description"
									markers={["Precise", "Neutral", "Creative"]}
								/>

								<FormCheckbox
									id="use_rag"
									label="Enable RAG"
									labelPosition="left"
									checked={chatSettings.use_rag ?? false}
									onChange={(e) =>
										handleSettingChange("use_rag", e.target.checked)
									}
									aria-describedby="rag-description"
								/>
								<p id="rag-description" className="sr-only">
									RAG stands for Retrieval-Augmented Generation, which enhances
									the model with external data.
								</p>

								<div>
									<details className="mt-2">
										<summary className="text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
											What do these settings mean?
										</summary>
										<div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
											<p>
												<strong>Temperature:</strong> Controls randomness in
												responses. Lower values (0) make responses more
												deterministic and focused, while higher values (2) make
												responses more random and creative.
											</p>
										</div>
									</details>
								</div>
							</TabsContent>
							<TabsContent value="advanced" className="space-y-6 pt-4">
								<RangeInput
									id="top_p"
									label="Openness to Ideas (top_p)"
									min={0}
									max={1}
									step={0.05}
									value={chatSettings.top_p ?? 1}
									onChange={(e) => handleSettingChange("top_p", e.target.value)}
								/>

								<FormInput
									id="max_tokens"
									label="Max Tokens"
									type="number"
									min={1}
									max={4096}
									value={chatSettings.max_tokens ?? 2048}
									onChange={(e) =>
										handleSettingChange("max_tokens", e.target.value)
									}
								/>

								<RangeInput
									id="presence_penalty"
									label="Expression Divergence (presence_penalty)"
									min={-2}
									max={2}
									step={0.1}
									value={chatSettings.presence_penalty ?? 0}
									onChange={(e) =>
										handleSettingChange("presence_penalty", e.target.value)
									}
									markers={["-2", "0", "+2"]}
								/>

								<RangeInput
									id="frequency_penalty"
									label="Vocabulary Richness (frequency_penalty)"
									min={-2}
									max={2}
									step={0.1}
									value={chatSettings.frequency_penalty ?? 0}
									onChange={(e) =>
										handleSettingChange("frequency_penalty", e.target.value)
									}
									markers={["-2", "0", "+2"]}
								/>

								<details className="mt-2">
									<summary className="text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
										What do these settings mean?
									</summary>
									<div className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 space-y-2">
										<p>
											<strong>Top P:</strong> Controls diversity via nucleus
											sampling. Lower values (0.1) make responses more focused,
											while higher values (1.0) make responses more diverse.
										</p>
										<p>
											<strong>Max Tokens:</strong> Limits the length of
											generated responses.
										</p>
										<p>
											<strong>Presence/Frequency Penalty:</strong> Controls
											repetition. Positive values reduce repetition, while
											negative values may increase it.
										</p>
									</div>
								</details>

								{chatSettings.use_rag && (
									<div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
										<h5 className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mt-4">
											RAG Settings
										</h5>

										<FormInput
											id="rag_top_k"
											label="Top K Results"
											type="number"
											min={1}
											max={20}
											value={chatSettings.rag_options?.topK ?? 3}
											onChange={(e) =>
												handleRagOptionChange("topK", e.target.value)
											}
										/>

										<RangeInput
											id="rag_score_threshold"
											label="Score Threshold"
											min={0}
											max={1}
											step={0.05}
											value={chatSettings.rag_options?.scoreThreshold ?? 0.5}
											onChange={(e) =>
												handleRagOptionChange("scoreThreshold", e.target.value)
											}
											markers={["0", "0.5", "1"]}
										/>

										<FormCheckbox
											id="rag_include_metadata"
											label="Include Metadata"
											labelPosition="left"
											checked={
												chatSettings.rag_options?.includeMetadata ?? false
											}
											onChange={(e) =>
												handleRagOptionChange(
													"includeMetadata",
													e.target.checked,
												)
											}
											aria-describedby="metadata-description"
										/>
										<p id="metadata-description" className="sr-only">
											Include additional information about the retrieved
											documents.
										</p>

										<FormInput
											id="rag_namespace"
											label="Namespace"
											value={chatSettings.rag_options?.namespace ?? ""}
											onChange={(e) =>
												handleRagOptionChange("namespace", e.target.value)
											}
											placeholder="e.g., docs, knowledge-base"
											aria-describedby="namespace-description"
										/>
										<p id="namespace-description" className="sr-only">
											Specify a namespace to restrict document retrieval to a
											specific collection.
										</p>
									</div>
								)}
							</TabsContent>
						</Tabs>

						<div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setShowSettings(false)}
								className="px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
							>
								Close
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
};
