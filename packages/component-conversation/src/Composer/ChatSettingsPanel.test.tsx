import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatSettingsPanel, type ChatSettingsPanelProps } from "./ChatSettingsPanel";

const defaultProps: ChatSettingsPanelProps = {
  showSettings: true,
  onShowSettingsChange: vi.fn(),
  chatSettings: {},
  reasoningOptions: [],
  verbosityOptions: ["medium"],
  defaultReasoningEffort: "medium",
  defaultVerbosity: "medium",
  onUseMultiModelChange: vi.fn(),
  onNumericSettingChange: vi.fn(),
  onCompactionChange: vi.fn(),
  onReasoningEffortChange: vi.fn(),
  onVerbosityChange: vi.fn(),
  onChatSettingsChange: vi.fn(),
};

describe("ChatSettingsPanel", () => {
  it("offers processing modes only when the selected model supports Fast", () => {
    const onServiceTierChange = vi.fn();
    const { rerender } = render(
      <ChatSettingsPanel
        {...defaultProps}
        selectedModelConfig={{
          matchingModel: "gpt-6-astra",
          provider: "openai",
          supportedServiceTiers: ["default", "fast"],
          serviceTierMultipliers: { fast: 2 },
        }}
        onServiceTierChange={onServiceTierChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Processing" }), {
      target: { value: "fast" },
    });
    expect(onServiceTierChange).toHaveBeenCalledWith("fast");

    rerender(
      <ChatSettingsPanel
        {...defaultProps}
        selectedModelConfig={{ matchingModel: "other", provider: "test" }}
        onServiceTierChange={onServiceTierChange}
      />,
    );
    expect(screen.queryByRole("combobox", { name: "Processing" })).toBeNull();
  });
});
