import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import type { VerbosityLevel } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { formatVerbosityLabel } from "@ngriffin_uk/polychat-library-chat/verbosity";
import { formatReasoningLabel, type ReasoningEffort } from "@ngriffin_uk/polychat-schemas";
import { Settings } from "lucide-react";
import type { ReactNode } from "react";

import {
  CompactSettingNumber,
  CompactSettingRange,
  CompactSettingSelect,
  CompactSettingSwitch,
} from "./CompactSettingControls";
import { HostedToolSettings } from "./HostedToolSettings";

export interface ChatSettingsPanelProps {
  showSettings: boolean;
  onShowSettingsChange: (open: boolean) => void;
  isDisabled?: boolean;
  chatSettings: Record<string, any>;
  reasoningOptions: ReasoningEffort[];
  verbosityOptions: VerbosityLevel[];
  selectedModelConfig?: any;
  defaultReasoningEffort: ReasoningEffort;
  defaultVerbosity: VerbosityLevel;
  showMultiModelToggle?: boolean;
  useMultiModel?: boolean;
  onUseMultiModelChange: (value: boolean) => void;
  showToolSelector?: boolean;
  toolSelectionLocked?: boolean;
  onBooleanSettingChange: (key: string, value: boolean) => void;
  onNumericSettingChange: (key: string, value: string) => void;
  onCompactionChange: (value: string) => void;
  onRagBooleanOptionChange: (key: string, value: boolean) => void;
  onRagNumericOptionChange: (key: string, value: string) => void;
  onRagStringOptionChange: (key: string, value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onVerbosityChange: (value: string) => void;
  onChatSettingsChange: (settings: Record<string, any>) => void;
  toolSelectorSlot?: ReactNode;
}

export function ChatSettingsPanel({
  showSettings,
  onShowSettingsChange,
  isDisabled = false,
  chatSettings,
  reasoningOptions,
  verbosityOptions,
  selectedModelConfig,
  defaultReasoningEffort,
  defaultVerbosity,
  showMultiModelToggle = false,
  useMultiModel = false,
  onUseMultiModelChange,
  showToolSelector = false,
  toolSelectionLocked = false,
  onBooleanSettingChange,
  onNumericSettingChange,
  onCompactionChange,
  onRagBooleanOptionChange,
  onRagNumericOptionChange,
  onRagStringOptionChange,
  onReasoningEffortChange,
  onVerbosityChange,
  onChatSettingsChange,
  toolSelectorSlot,
}: ChatSettingsPanelProps) {
  return (
    <div className="flex items-center">
      <Popover open={showSettings} onOpenChange={onShowSettingsChange}>
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
                    onChange={onReasoningEffortChange}
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
                  onChange={onVerbosityChange}
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
                  value={chatSettings.temperature ?? 0.7}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("temperature", value)}
                  markers={["Precise", "Neutral", "Creative"]}
                  description="Controls randomness in responses."
                />

                <CompactSettingSwitch
                  id="use_rag"
                  label="Enable RAG"
                  checked={chatSettings.use_rag ?? false}
                  disabled={isDisabled}
                  onChange={(checked) => onBooleanSettingChange("use_rag", checked)}
                  description="RAG stands for Retrieval-Augmented Generation, which enhances the model with external data."
                />
                {showMultiModelToggle && (
                  <CompactSettingSwitch
                    id="use_multi_model"
                    label="Multi-model"
                    checked={useMultiModel}
                    disabled={isDisabled}
                    onChange={onUseMultiModelChange}
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
                  onChange={onCompactionChange}
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
                  value={chatSettings.top_p ?? 0.8}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("top_p", value)}
                  description="Controls diversity via nucleus sampling."
                />

                <CompactSettingNumber
                  id="max_tokens"
                  label="Max Tokens"
                  min={1}
                  max={4096}
                  value={chatSettings.max_tokens ?? 2048}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("max_tokens", value)}
                />

                <CompactSettingRange
                  id="presence_penalty"
                  label="Presence penalty"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={chatSettings.presence_penalty ?? 0}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("presence_penalty", value)}
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
                  onChange={(value) => onNumericSettingChange("frequency_penalty", value)}
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
                      onChange={(value) => onRagNumericOptionChange("topK", value)}
                    />

                    <CompactSettingRange
                      id="rag_score_threshold"
                      label="Score Threshold"
                      min={0}
                      max={1}
                      step={0.05}
                      value={chatSettings.rag_options?.scoreThreshold ?? 0.5}
                      disabled={isDisabled}
                      onChange={(value) => onRagNumericOptionChange("scoreThreshold", value)}
                      markers={["0", "0.5", "1"]}
                    />

                    <CompactSettingSwitch
                      id="rag_include_metadata"
                      label="Include Metadata"
                      checked={chatSettings.rag_options?.includeMetadata ?? false}
                      disabled={isDisabled}
                      onChange={(checked) => onRagBooleanOptionChange("includeMetadata", checked)}
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
                          onRagStringOptionChange("namespace", event.target.value)
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
                  setChatSettings={onChatSettingsChange}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end border-t border-zinc-200 px-1 pt-2 dark:border-zinc-700">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onShowSettingsChange(false)}
                className="h-8 rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {showToolSelector && !toolSelectionLocked && toolSelectorSlot}
    </div>
  );
}
