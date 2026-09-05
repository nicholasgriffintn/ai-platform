import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ShortcutTooltip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import type { VerbosityLevel } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { formatVerbosityLabel } from "@ngriffin_uk/polychat-library-chat/verbosity";
import {
  formatReasoningLabel,
  getModelSamplingCapabilities,
  type ModelServiceTier,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";
import { Settings } from "lucide-react";

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
  maxOutputTokens?: number;
  showMultiModelToggle?: boolean;
  useMultiModel?: boolean;
  onUseMultiModelChange: (value: boolean) => void;
  onNumericSettingChange: (key: string, value: string) => void;
  onCompactionChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onServiceTierChange?: (value: string) => void;
  serviceTierDescription?: string;
  onVerbosityChange: (value: string) => void;
  onChatSettingsChange: (settings: Record<string, any>) => void;
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
  maxOutputTokens,
  showMultiModelToggle = false,
  useMultiModel = false,
  onUseMultiModelChange,
  onNumericSettingChange,
  onCompactionChange,
  onReasoningEffortChange,
  onServiceTierChange,
  serviceTierDescription,
  onVerbosityChange,
  onChatSettingsChange,
}: ChatSettingsPanelProps) {
  const samplingCapabilities = getModelSamplingCapabilities(selectedModelConfig);
  const resetNumericSetting = (key: string) => onNumericSettingChange(key, "");
  const topPIsOverridden =
    samplingCapabilities.restrictsCombinedTopPAndTemperature &&
    chatSettings.temperature !== undefined;

  return (
    <Popover open={showSettings} onOpenChange={onShowSettingsChange}>
      <ShortcutTooltip keys={["/settings"]} label="Settings">
        <PopoverTrigger asChild>
          <Button
            variant={showSettings ? "iconActive" : "icon"}
            icon={<Settings className="h-4 w-4" />}
            disabled={isDisabled}
            aria-haspopup="dialog"
            aria-expanded={showSettings}
            aria-label="Open chat settings"
          />
        </PopoverTrigger>
      </ShortcutTooltip>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="max-h-[min(34rem,72dvh)] w-[min(92vw,24rem)] overflow-y-auto rounded-xl p-2"
        aria-label="Chat settings"
      >
        <div className="space-y-2">
          <div className="text-muted-foreground px-3 py-1 text-[11px] font-semibold uppercase">
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
              {selectedModelConfig?.supportedServiceTiers?.includes("fast") &&
                onServiceTierChange && (
                  <CompactSettingSelect
                    id="service_tier"
                    label="Processing"
                    value={chatSettings.service_tier ?? "auto"}
                    onChange={onServiceTierChange}
                    disabled={isDisabled}
                    options={[
                      { value: "auto", label: "Automatic" },
                      ...selectedModelConfig.supportedServiceTiers.map(
                        (tier: ModelServiceTier) => ({
                          value: tier,
                          label:
                            tier === "fast"
                              ? `Fast${
                                  selectedModelConfig.serviceTierMultipliers?.fast
                                    ? ` (${selectedModelConfig.serviceTierMultipliers.fast}×)`
                                    : ""
                                }`
                              : "Standard",
                        }),
                      ),
                    ]}
                    description={serviceTierDescription}
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

              {samplingCapabilities.supportsTemperature && (
                <CompactSettingRange
                  id="temperature"
                  label="Temperature"
                  min={0}
                  max={samplingCapabilities.maxTemperature}
                  step={0.1}
                  value={chatSettings.temperature}
                  automaticValue={samplingCapabilities.maxTemperature / 2}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("temperature", value)}
                  onReset={() => resetNumericSetting("temperature")}
                  markers={["Precise", "Neutral", "Creative"]}
                  description="Automatic leaves this to the model's own default. Move the slider to override it."
                />
              )}

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
                <summary className="text-muted-foreground cursor-pointer px-2 text-xs">
                  What do these settings mean?
                </summary>
                <p className="text-muted-foreground mt-1 px-2 text-xs">
                  Temperature controls randomness. Lower values are more deterministic; higher
                  values are more varied. On Automatic nothing is sent and the model uses its own
                  default. The range follows the model: 0–1 for Claude, 0–2 elsewhere.
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

              {samplingCapabilities.supportsTopP && (
                <CompactSettingRange
                  id="top_p"
                  label="Top P"
                  min={0}
                  max={1}
                  step={0.05}
                  value={chatSettings.top_p}
                  automaticValue={0.8}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("top_p", value)}
                  onReset={() => resetNumericSetting("top_p")}
                  description={
                    topPIsOverridden
                      ? "This model accepts either temperature or Top P, not both, so Top P is ignored while a temperature is set."
                      : "Controls diversity via nucleus sampling. Automatic leaves it to the model."
                  }
                />
              )}

              <CompactSettingNumber
                id="max_tokens"
                label="Max output tokens"
                min={1}
                max={maxOutputTokens}
                value={chatSettings.max_tokens ?? ""}
                placeholder="Automatic"
                disabled={isDisabled}
                onChange={(value) => onNumericSettingChange("max_tokens", value)}
                description="Automatic uses 2,048 for structured JSON, 8,192 for normal chat, 16,384 for agent or coding work, and 32,768 for reasoning. Enter a value to override it; the model's own limit still applies."
              />

              {samplingCapabilities.supportsPresencePenalty && (
                <CompactSettingRange
                  id="presence_penalty"
                  label="Presence penalty"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={chatSettings.presence_penalty}
                  automaticValue={0}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("presence_penalty", value)}
                  onReset={() => resetNumericSetting("presence_penalty")}
                  markers={["-2", "0", "+2"]}
                />
              )}

              {samplingCapabilities.supportsFrequencyPenalty && (
                <CompactSettingRange
                  id="frequency_penalty"
                  label="Frequency penalty"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={chatSettings.frequency_penalty}
                  automaticValue={0}
                  disabled={isDisabled}
                  onChange={(value) => onNumericSettingChange("frequency_penalty", value)}
                  onReset={() => resetNumericSetting("frequency_penalty")}
                  markers={["-2", "0", "+2"]}
                />
              )}

              <details>
                <summary className="text-muted-foreground cursor-pointer px-2 text-xs">
                  What do these settings mean?
                </summary>
                <div className="text-muted-foreground mt-1 space-y-1 px-2 text-xs">
                  <p>
                    <strong>Top P:</strong> controls sampling diversity. Some models accept either
                    temperature or Top P, not both.
                  </p>
                  <p>
                    <strong>Max output tokens:</strong> limits response length. Leave it empty to
                    use the workload-aware default.
                  </p>
                  <p>
                    <strong>Penalties:</strong> tune repetition. On Automatic nothing is sent, so
                    the model applies no penalty of its own.
                  </p>
                  <p>
                    Every slider here starts on Automatic and is only sent once you move it. Use
                    Reset to hand it back to the model. Controls the model does not accept are
                    hidden.
                  </p>
                </div>
              </details>

              <HostedToolSettings
                chatSettings={chatSettings}
                isDisabled={isDisabled}
                model={selectedModelConfig}
                setChatSettings={onChatSettingsChange}
              />
            </TabsContent>
          </Tabs>

          <div className="border-border flex justify-end border-t px-1 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onShowSettingsChange(false)}
              className="border-border text-foreground hover:bg-selection h-8 rounded-md border px-3 text-xs font-medium"
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
