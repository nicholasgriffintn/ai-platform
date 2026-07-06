import { Settings } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { EMPTY_MODEL_CONFIG, getAvailableModels } from "~/lib/models";
import {
	formatReasoningLabel,
	getDefaultReasoningEffort,
	getReasoningOptions,
} from "~/lib/reasoning";
import { formatVerbosityLabel, getDefaultVerbosity, getVerbosityOptions } from "~/lib/verbosity";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatSettings as ChatSettingsType, ReasoningEffort, VerbosityLevel } from "~/types";
import {
	CompactSettingNumber,
	CompactSettingRange,
	CompactSettingSelect,
	CompactSettingSwitch,
} from "./CompactSettingControls";
import { HostedToolSettings } from "./HostedToolSettings";
import { ToolSelector } from "./ToolSelector";

interface ChatSettingsProps {
	isDisabled?: boolean;
	supportsToolCalls?: boolean;
	toolSelectionLocked?: boolean;
}

type NumericChatSettingKey =
	| "temperature"
	| "top_p"
	| "max_tokens"
	| "presence_penalty"
	| "frequency_penalty";

type RagNumericOptionKey = "topK" | "scoreThreshold";
type RagBooleanOptionKey = "includeMetadata";
type RagStringOptionKey = "type" | "namespace";
type ChatCompactionMode = NonNullable<ChatSettingsType["compaction"]>;

function isChatCompactionMode(value: string): value is ChatCompactionMode {
	return value === "auto" || value === "off";
}

export const ChatSettings = ({
	isDisabled = false,
	supportsToolCalls = false,
	toolSelectionLocked = false,
}: ChatSettingsProps) => {
	const {
		chatMode,
		chatSettings,
		isAuthenticated,
		isPro,
		model,
		setChatSettings,
		setUseMultiModel,
		useMultiModel,
	} = useChatStore();
	const [showSettings, setShowSettings] = useState(false);
	const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
	const webLLMModels = useWebLLMModels({ enabled: chatMode === "local" });
	const availableModels = useMemo(
		() => getAvailableModels(apiModels, chatMode === "local", webLLMModels),
		[apiModels, chatMode, webLLMModels],
	);

	const activeModelId = model && model.length > 0 ? model : undefined;
	const selectedModelConfig = activeModelId ? availableModels[activeModelId] : undefined;

	const reasoningOptions = getReasoningOptions(selectedModelConfig);
	const defaultReasoningEffort = getDefaultReasoningEffort(selectedModelConfig);
	const verbosityOptions = getVerbosityOptions(selectedModelConfig);
	const defaultVerbosity = getDefaultVerbosity(selectedModelConfig);
	const showMultiModelToggle = isPro && !model && chatMode === "remote";
	const showToolSelector =
		isAuthenticated && (supportsToolCalls || (!model && chatMode === "remote"));

	const handleNumericSettingChange = (key: NumericChatSettingKey, value: string) => {
		const numValue = Number.parseFloat(value);
		if (Number.isNaN(numValue)) {
			return;
		}

		setChatSettings({
			...chatSettings,
			[key]: numValue,
		});
	};

	const handleBooleanSettingChange = (key: "use_rag", value: boolean) => {
		setChatSettings({
			...chatSettings,
			[key]: value,
		});
	};

	const handleCompactionChange = (value: string) => {
		if (!isChatCompactionMode(value)) {
			return;
		}

		setChatSettings({
			...chatSettings,
			compaction: value,
		});
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

	const handleRagNumericOptionChange = (key: RagNumericOptionKey, value: string) => {
		const numValue = Number.parseFloat(value);
		if (Number.isNaN(numValue)) {
			return;
		}

		setChatSettings({
			...chatSettings,
			rag_options: {
				...chatSettings.rag_options,
				[key]: numValue,
			},
		});
	};

	const handleRagBooleanOptionChange = (key: RagBooleanOptionKey, value: boolean) => {
		setChatSettings({
			...chatSettings,
			rag_options: {
				...chatSettings.rag_options,
				[key]: value,
			},
		});
	};

	const handleRagStringOptionChange = (key: RagStringOptionKey, value: string) => {
		setChatSettings({
			...chatSettings,
			rag_options: {
				...chatSettings.rag_options,
				[key]: value,
			},
		});
	};

	return (
		<div className="flex items-center">
			<Popover open={showSettings} onOpenChange={setShowSettings}>
				<PopoverTrigger asChild>
					<Button
						variant={showSettings ? "iconActive" : "icon"}
						icon={<Settings className="h-4 w-4" />}
						disabled={isDisabled}
						aria-haspopup="dialog"
						aria-expanded={showSettings}
						title="Chat settings"
						aria-label="Open chat settings"
					/>
				</PopoverTrigger>
				<PopoverContent
					side="top"
					align="end"
					sideOffset={10}
					className="max-h-[min(34rem,72dvh)] w-[min(92vw,24rem)] overflow-y-auto rounded-xl p-2"
					aria-label="Chat settings"
				>
					<div className="space-y-2">
						<div className="px-3 py-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
							Settings
						</div>

						<Tabs defaultValue="basic" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="basic">Basic</TabsTrigger>
								<TabsTrigger value="advanced">Advanced</TabsTrigger>
							</TabsList>
							<TabsContent value="basic" className="space-y-3 px-1 pt-3">
								{reasoningOptions.length > 0 && (
									<CompactSettingSelect
										id="reasoning_effort"
										label="Reasoning depth"
										value={chatSettings.reasoning?.effort ?? defaultReasoningEffort}
										onChange={handleReasoningEffortChange}
										disabled={isDisabled}
										options={reasoningOptions.map((option) => ({
											value: option,
											label: formatReasoningLabel(option),
										}))}
										description="Controls configured thinking when the model supports it."
									/>
								)}
								<CompactSettingSelect
									id="text_verbosity"
									label="Verbosity"
									value={chatSettings?.verbosity ?? defaultVerbosity}
									onChange={handleVerbosityChange}
									disabled={isDisabled}
									options={verbosityOptions.map((option) => ({
										value: option,
										label: formatVerbosityLabel(option),
									}))}
									description="Adjusts how detailed or concise the response should be."
								/>

								<CompactSettingRange
									id="temperature"
									label="Temperature"
									min={0}
									max={2}
									step={0.1}
									value={chatSettings.temperature ?? 1}
									disabled={isDisabled}
									onChange={(value) => handleNumericSettingChange("temperature", value)}
									markers={["Precise", "Neutral", "Creative"]}
								/>

								<CompactSettingSwitch
									id="use_rag"
									label="Enable RAG"
									checked={chatSettings.use_rag ?? false}
									disabled={isDisabled}
									onChange={(checked) => handleBooleanSettingChange("use_rag", checked)}
									description="RAG stands for Retrieval-Augmented Generation, which enhances the model with external data."
								/>
								{showMultiModelToggle && (
									<CompactSettingSwitch
										id="use_multi_model"
										label="Multi-model"
										checked={useMultiModel}
										disabled={isDisabled}
										onChange={setUseMultiModel}
									/>
								)}
								<details>
									<summary className="cursor-pointer px-2 text-xs text-zinc-500 dark:text-zinc-400">
										What do these settings mean?
									</summary>
									<p className="mt-1 px-2 text-xs text-zinc-500 dark:text-zinc-400">
										Temperature controls randomness. Lower values are more deterministic; higher
										values are more varied.
									</p>
								</details>
							</TabsContent>
							<TabsContent value="advanced" className="space-y-3 px-1 pt-3">
								<CompactSettingSelect
									id="compaction"
									label="Context compaction"
									value={chatSettings.compaction ?? "auto"}
									onChange={handleCompactionChange}
									disabled={isDisabled}
									options={[
										{ value: "auto", label: "Automatic" },
										{ value: "off", label: "Off" },
									]}
									description="Controls whether stored context is compacted near the model limit."
								/>

								<CompactSettingRange
									id="top_p"
									label="Top P"
									min={0}
									max={1}
									step={0.05}
									value={chatSettings.top_p ?? 1}
									disabled={isDisabled}
									onChange={(value) => handleNumericSettingChange("top_p", value)}
								/>

								<CompactSettingNumber
									id="max_tokens"
									label="Max Tokens"
									min={1}
									max={4096}
									value={chatSettings.max_tokens ?? 2048}
									disabled={isDisabled}
									onChange={(value) => handleNumericSettingChange("max_tokens", value)}
								/>

								<CompactSettingRange
									id="presence_penalty"
									label="Presence penalty"
									min={-2}
									max={2}
									step={0.1}
									value={chatSettings.presence_penalty ?? 0}
									disabled={isDisabled}
									onChange={(value) => handleNumericSettingChange("presence_penalty", value)}
									markers={["-2", "0", "+2"]}
								/>

								<CompactSettingRange
									id="frequency_penalty"
									label="Frequency penalty"
									min={-2}
									max={2}
									step={0.1}
									value={chatSettings.frequency_penalty ?? 0}
									disabled={isDisabled}
									onChange={(value) => handleNumericSettingChange("frequency_penalty", value)}
									markers={["-2", "0", "+2"]}
								/>

								<details>
									<summary className="cursor-pointer px-2 text-xs text-zinc-500 dark:text-zinc-400">
										What do these settings mean?
									</summary>
									<div className="mt-1 space-y-1 px-2 text-xs text-zinc-500 dark:text-zinc-400">
										<p>
											<strong>Top P:</strong> controls sampling diversity.
										</p>
										<p>
											<strong>Max Tokens:</strong> limits response length.
										</p>
										<p>
											<strong>Penalties:</strong> tune repetition.
										</p>
									</div>
								</details>

								{chatSettings.use_rag && (
									<div className="space-y-3 border-t border-zinc-200 px-1 pt-3 dark:border-zinc-700">
										<div className="px-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
											RAG Settings
										</div>

										<CompactSettingNumber
											id="rag_top_k"
											label="Top K Results"
											min={1}
											max={20}
											value={chatSettings.rag_options?.topK ?? 3}
											disabled={isDisabled}
											onChange={(value) => handleRagNumericOptionChange("topK", value)}
										/>

										<CompactSettingRange
											id="rag_score_threshold"
											label="Score Threshold"
											min={0}
											max={1}
											step={0.05}
											value={chatSettings.rag_options?.scoreThreshold ?? 0.5}
											disabled={isDisabled}
											onChange={(value) => handleRagNumericOptionChange("scoreThreshold", value)}
											markers={["0", "0.5", "1"]}
										/>

										<CompactSettingSwitch
											id="rag_include_metadata"
											label="Include Metadata"
											checked={chatSettings.rag_options?.includeMetadata ?? false}
											disabled={isDisabled}
											onChange={(checked) =>
												handleRagBooleanOptionChange("includeMetadata", checked)
											}
											description="Include additional information about the retrieved documents."
										/>

										<div className="space-y-1.5">
											<label
												htmlFor="rag_namespace"
												className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
											>
												Namespace
											</label>
											<input
												id="rag_namespace"
												value={chatSettings.rag_options?.namespace ?? ""}
												disabled={isDisabled}
												onChange={(event) =>
													handleRagStringOptionChange("namespace", event.target.value)
												}
												placeholder="e.g., docs"
												aria-describedby="namespace-description"
												className="h-8 w-full rounded-md border border-zinc-200 bg-off-white px-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
											/>
											<p id="namespace-description" className="sr-only">
												Specify a namespace to restrict document retrieval to a specific collection.
											</p>
										</div>
									</div>
								)}

								<HostedToolSettings
									chatSettings={chatSettings}
									isDisabled={isDisabled}
									model={selectedModelConfig}
									setChatSettings={setChatSettings}
								/>
							</TabsContent>
						</Tabs>

						<div className="flex justify-end border-t border-zinc-200 px-1 pt-2 dark:border-zinc-700">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setShowSettings(false)}
								className="h-8 rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
							>
								Done
							</Button>
						</div>
					</div>
				</PopoverContent>
			</Popover>

			{showToolSelector && <ToolSelector isDisabled={isDisabled || toolSelectionLocked} />}
		</div>
	);
};
