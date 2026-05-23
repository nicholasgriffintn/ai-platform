import type {
	ChatSettings,
	HostedToolSettings as HostedToolSettingsValue,
	ModelConfigItem,
} from "~/types";
import { CompactSettingSelect } from "./CompactSettingControls";

interface HostedToolSettingsProps {
	chatSettings: ChatSettings;
	isDisabled?: boolean;
	model?: ModelConfigItem;
	setChatSettings: (settings: ChatSettings) => void;
}

export function HostedToolSettings({
	chatSettings,
	isDisabled,
	model,
	setChatSettings,
}: HostedToolSettingsProps) {
	const toolSettings = chatSettings.tool_options || {};
	const updateToolSettings = (next: HostedToolSettingsValue) => {
		setChatSettings({
			...chatSettings,
			tool_options: {
				...toolSettings,
				...next,
			},
		});
	};

	const hasConfigurableTools = model?.supportsImageGenerationTool || model?.supportsHostedShell;

	if (!hasConfigurableTools) {
		return null;
	}

	return (
		<div className="space-y-3 border-t border-zinc-200 px-1 pt-3 dark:border-zinc-700">
			<div className="px-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
				Hosted Tools
			</div>

			{model?.supportsImageGenerationTool && (
				<div className="grid grid-cols-2 gap-2">
					<CompactSettingSelect
						id="tool_image_size"
						label="Image size"
						value={toolSettings.image_generation?.size ?? ""}
						onChange={(value) =>
							updateToolSettings({
								image_generation: {
									...toolSettings.image_generation,
									size: value || undefined,
								},
							})
						}
						disabled={isDisabled}
						options={[
							{ value: "", label: "Auto" },
							{ value: "1024x1024", label: "1024 square" },
							{ value: "1536x1024", label: "Landscape" },
							{ value: "1024x1536", label: "Portrait" },
						]}
					/>
					<CompactSettingSelect
						id="tool_image_quality"
						label="Image quality"
						value={toolSettings.image_generation?.quality ?? ""}
						onChange={(value) =>
							updateToolSettings({
								image_generation: {
									...toolSettings.image_generation,
									quality: value || undefined,
								},
							})
						}
						disabled={isDisabled}
						options={[
							{ value: "", label: "Auto" },
							{ value: "low", label: "Low" },
							{ value: "medium", label: "Medium" },
							{ value: "high", label: "High" },
						]}
					/>
				</div>
			)}

			{model?.supportsHostedShell && (
				<CompactSettingSelect
					id="tool_shell_environment"
					label="Shell environment"
					value={toolSettings.shell?.environment?.type ?? "container_auto"}
					onChange={(value) =>
						updateToolSettings({
							shell: {
								environment: { type: value },
							},
						})
					}
					disabled={isDisabled}
					options={[{ value: "container_auto", label: "Container auto" }]}
				/>
			)}
		</div>
	);
}
