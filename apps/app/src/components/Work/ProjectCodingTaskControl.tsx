import { InlineSettingSelect } from "@ngriffin_uk/polychat-component-conversation";
import { GitBranch } from "lucide-react";

import type { ProjectConversationCodingTaskType } from "~/lib/project-coding-presentation";

const TASK_OPTIONS: Array<{ value: ProjectConversationCodingTaskType; label: string }> = [
  { value: "feature-implementation", label: "Build a feature" },
  { value: "bug-fix", label: "Fix a bug" },
  { value: "refactoring", label: "Refactor code" },
  { value: "code-review", label: "Review changes" },
  { value: "test-suite", label: "Improve tests" },
  { value: "documentation", label: "Write documentation" },
  { value: "migration", label: "Run a migration" },
];

export function ProjectCodingTaskControl({
  taskType,
  onChange,
}: {
  taskType: ProjectConversationCodingTaskType;
  onChange: (taskType: ProjectConversationCodingTaskType) => void;
}) {
  const selectedOption = TASK_OPTIONS.find((option) => option.value === taskType);

  return (
    <InlineSettingSelect<ProjectConversationCodingTaskType>
      id="project-coding-task"
      label="Coding task"
      icon={<GitBranch className="h-4 w-4" />}
      value={taskType}
      displayLabel={selectedOption?.label ?? "Build a feature"}
      options={TASK_OPTIONS}
      onChange={(value) => {
        if (value) {
          onChange(value);
        }
      }}
    />
  );
}
