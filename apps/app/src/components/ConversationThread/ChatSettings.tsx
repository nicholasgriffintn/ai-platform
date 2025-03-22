import { CloudOff, Computer, Settings, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	Button,
	Checkbox,
	RangeInput,
	Select,
	TextInput,
} from "~/components/ui";
import { defaultModel } from "~/lib/models";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatSettings as ChatSettingsType } from "~/types";

interface ChatSettingsProps {
	isDisabled?: boolean;
}

export const ChatSettings = ({ isDisabled = false }: ChatSettingsProps) => {
	const {
		isPro,
		chatSettings,
		setChatSettings,
		chatMode,
		setChatMode,
		setModel,
	} = useChatStore();
	const [showSettings, setShowSettings] = useState(false);
	const [promptCoach, setPromptCoach] = useState(chatMode === "prompt_coach");
	const [useLocalModel, setUseLocalModel] = useState(chatMode === "local");
	const [localOnly, setLocalOnly] = useState(chatSettings.localOnly || false);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const settingsButtonRef = useRef<HTMLButtonElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const responseSelectRef = useRef<HTMLSelectElement>(null);
	const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");

	useEffect(() => {
		setPromptCoach(chatMode === "prompt_coach");
		setUseLocalModel(chatMode === "local");
		setLocalOnly(chatSettings.localOnly || false);
	}, [chatMode, chatSettings.localOnly]);

	const showDialog = () => {
		dialogRef.current?.showModal();
		setShowSettings(true);
		setTimeout(() => {
			titleRef.current?.focus();
		}, 50);
	};

	const closeDialog = () => {
		dialogRef.current?.close();
		setShowSettings(false);
		settingsButtonRef.current?.focus();
	};

	const handleEnableLocalModels = () => {
		const newValue = !useLocalModel;
		setUseLocalModel(newValue);
		setChatMode(newValue ? "local" : "remote");

		if (newValue) {
			setLocalOnly(true);
			setChatSettings({
				...chatSettings,
				localOnly: true,
			});
			setModel("");
		} else {
			setLocalOnly(false);
			setChatSettings({
				...chatSettings,
				localOnly: false,
			});
			setModel(defaultModel);
		}
	};

	const handleEnablePromptCoach = () => {
		if (useLocalModel) {
			setPromptCoach(false);
			return;
		}

		const newValue = !promptCoach;
		setPromptCoach(newValue);
		setChatMode(newValue ? "prompt_coach" : "remote");
	};

	const handleLocalOnlyToggle = () => {
		if (useLocalModel && localOnly) {
			return;
		}

		const newValue = !localOnly;
		setLocalOnly(newValue);
		setChatSettings({
			...chatSettings,
			localOnly: newValue,
		});
	};

	const handleSettingChange = (
		key: keyof ChatSettingsType,
		value: string | boolean,
	) => {
		if (typeof value === "string") {
			if (key === "responseMode") {
				setChatSettings({
					...chatSettings,
					[key]: value as ChatSettingsType["responseMode"],
				});
				return;
			}

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

	const handleRagOptionChange = (
		key: keyof NonNullable<ChatSettingsType["ragOptions"]>,
		value: string | boolean,
	) => {
		if (typeof value === "boolean") {
			setChatSettings({
				...chatSettings,
				ragOptions: {
					...chatSettings.ragOptions,
					[key]: value,
				},
			});
			return;
		}

		const numValue = Number.parseFloat(value);
		setChatSettings({
			...chatSettings,
			ragOptions: {
				...chatSettings.ragOptions,
				[key]: !Number.isNaN(numValue) ? numValue : value,
			},
		});
	};

	const handleDialogKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			closeDialog();
		}

		if (e.key === "Tab") {
			const focusableElements = dialogRef.current?.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			) as NodeListOf<HTMLElement>;

			if (!focusableElements?.length) return;

			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (e.shiftKey && document.activeElement === firstElement) {
				e.preventDefault();
				lastElement.focus();
			} else if (!e.shiftKey && document.activeElement === lastElement) {
				e.preventDefault();
				firstElement.focus();
			}
		}
	};

	const responseModeOptions = [
		{ value: "normal", label: "Normal" },
		{ value: "concise", label: "Concise" },
		{ value: "explanatory", label: "Explanatory" },
		{ value: "formal", label: "Formal" },
	];

	const getResponseModeDescription = (mode: string) => {
		switch (mode) {
			case "concise":
				return "Brief, to-the-point responses";
			case "explanatory":
				return "Detailed explanations with examples";
			case "formal":
				return "Professional, structured responses";
			default:
				return "Balanced, conversational responses";
		}
	};

	return (
		<div className="relative">
			<Button
				variant={useLocalModel ? "iconActive" : "icon"}
				icon={<Computer className="h-4 w-4" />}
				onClick={handleEnableLocalModels}
				title={useLocalModel ? "Use Remote Models" : "Use Local Models"}
				aria-label={useLocalModel ? "Use Remote Models" : "Use Local Models"}
			/>
			<Button
				variant={promptCoach ? "iconActive" : "icon"}
				icon={<Sparkles className="h-4 w-4" />}
				onClick={handleEnablePromptCoach}
				disabled={useLocalModel}
				title={
					promptCoach
						? "Disable Prompt Enhancement"
						: "Enable Prompt Enhancement"
				}
				aria-label={
					promptCoach
						? "Disable Prompt Enhancement"
						: "Enable Prompt Enhancement"
				}
			/>

			{isPro && (
				<Button
					variant={localOnly ? "iconActive" : "icon"}
					icon={<CloudOff className="h-4 w-4" />}
					onClick={handleLocalOnlyToggle}
					disabled={useLocalModel}
					title={
						useLocalModel
							? "Local models are always stored locally"
							: localOnly
								? "Store on server"
								: "Local-only (not stored on server)"
					}
					aria-label={
						useLocalModel
							? "Local models are always stored locally"
							: localOnly
								? "Store on server"
								: "Local-only (not stored on server)"
					}
					className={useLocalModel ? "opacity-50 cursor-not-allowed" : ""}
				/>
			)}

			<Button
				ref={settingsButtonRef}
				variant="icon"
				icon={<Settings className="h-4 w-4" />}
				onClick={showDialog}
				disabled={isDisabled}
				aria-haspopup="dialog"
				aria-expanded={showSettings}
				title="Chat settings"
				aria-label="Open chat settings"
			/>

			<dialog
				ref={dialogRef}
				className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full p-0 bg-off-white dark:bg-zinc-900 rounded-lg shadow-xl backdrop:bg-black/50 max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-700 m-0"
				onClick={(e) => {
					if (e.target === dialogRef.current) {
						closeDialog();
					}
				}}
				onKeyDown={handleDialogKeyDown}
				aria-labelledby="chat-settings-title"
				aria-modal="true"
			>
				<div className="relative p-4">
					<div className="flex justify-between items-center mb-4">
						<h4
							ref={titleRef}
							id="chat-settings-title"
							className="font-medium text-zinc-900 dark:text-zinc-100 text-2xl"
							tabIndex={-1}
						>
							Chat Settings
						</h4>
						<Button
							variant="ghost"
							icon={<X size={24} strokeWidth={2.5} />}
							onClick={closeDialog}
							className="p-2 rounded-lg"
							aria-label="Close settings dialog"
						/>
					</div>

					<div className="space-y-4">
						<div className="flex border-b border-zinc-200 dark:border-zinc-700 mb-4">
							<Button
								variant={activeTab === "basic" ? "primary" : "secondary"}
								className={`px-4 py-2 text-sm font-medium w-1/2 text-center rounded-none ${
									activeTab === "basic"
										? "bg-white dark:bg-zinc-800 border-b-2 border-blue-500 dark:border-blue-500"
										: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
								}`}
								onClick={() => setActiveTab("basic")}
								aria-selected={activeTab === "basic"}
								role="tab"
							>
								Basic Settings
							</Button>
							<Button
								variant={activeTab === "advanced" ? "primary" : "secondary"}
								className={`px-4 py-2 text-sm font-medium w-1/2 text-center rounded-none ${
									activeTab === "advanced"
										? "bg-white dark:bg-zinc-800 border-b-2 border-blue-500 dark:border-blue-500"
										: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
								}`}
								onClick={() => setActiveTab("advanced")}
								aria-selected={activeTab === "advanced"}
								role="tab"
							>
								Advanced Settings
							</Button>
						</div>

						{activeTab === "basic" && (
							<div className="space-y-6">
								<Select
									ref={responseSelectRef}
									id="responseMode"
									label="Response Mode"
									value={chatSettings.responseMode ?? "normal"}
									onChange={(e) =>
										handleSettingChange("responseMode", e.target.value)
									}
									disabled={isDisabled}
									options={responseModeOptions}
									description={getResponseModeDescription(
										chatSettings.responseMode ?? "normal",
									)}
									aria-describedby="response-mode-description"
								/>

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

								<Checkbox
									id="use_rag"
									label="Enable RAG"
									labelPosition="left"
									checked={chatSettings.useRAG ?? false}
									onChange={(e) =>
										handleSettingChange("useRAG", e.target.checked)
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
							</div>
						)}

						{activeTab === "advanced" && (
							<div className="space-y-6">
								<RangeInput
									id="top_p"
									label="Openness to Ideas (top_p)"
									min={0}
									max={1}
									step={0.05}
									value={chatSettings.top_p ?? 1}
									onChange={(e) => handleSettingChange("top_p", e.target.value)}
								/>

								<TextInput
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

								{chatSettings.useRAG && (
									<div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
										<h5 className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mt-4">
											RAG Settings
										</h5>

										<TextInput
											id="rag_top_k"
											label="Top K Results"
											type="number"
											min={1}
											max={20}
											value={chatSettings.ragOptions?.topK ?? 3}
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
											value={chatSettings.ragOptions?.scoreThreshold ?? 0.5}
											onChange={(e) =>
												handleRagOptionChange("scoreThreshold", e.target.value)
											}
											markers={["0", "0.5", "1"]}
										/>

										<Checkbox
											id="rag_include_metadata"
											label="Include Metadata"
											labelPosition="left"
											checked={
												chatSettings.ragOptions?.includeMetadata ?? false
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

										<TextInput
											id="rag_namespace"
											label="Namespace"
											value={chatSettings.ragOptions?.namespace ?? ""}
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
							</div>
						)}

						<div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
							<Button
								type="button"
								variant="secondary"
								onClick={closeDialog}
								className="px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
							>
								Close
							</Button>
						</div>
					</div>
				</div>
			</dialog>
		</div>
	);
};
