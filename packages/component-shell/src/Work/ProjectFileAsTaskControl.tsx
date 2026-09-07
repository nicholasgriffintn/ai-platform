import { InlineSettingToggle } from "@ngriffin_uk/polychat-component-conversation";
import { ListChecks } from "lucide-react";

export function ProjectFileAsTaskControl({
  isEnabled,
  isDisabled = false,
  onChange,
}: {
  isEnabled: boolean;
  isDisabled?: boolean;
  onChange: (isEnabled: boolean) => void;
}) {
  return (
    <InlineSettingToggle
      id="project-file-as-task"
      label="As task"
      icon={<ListChecks className="h-4 w-4" />}
      isOn={isEnabled}
      isDisabled={isDisabled}
      description="File what you type as a project task instead of asking it now"
      onChange={onChange}
    />
  );
}
