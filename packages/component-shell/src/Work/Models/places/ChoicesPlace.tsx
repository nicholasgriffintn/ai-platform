import { ModelChoicesEditor } from "../../../Models/Choices/ModelChoicesEditor.js";
import { useModelsScope } from "../ModelsScope.js";

export function ChoicesPlace() {
  const { workspaceId } = useModelsScope();

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        The models this workspace uses for background jobs in its projects, such as titling,
        summaries, dictation and pictures. The first model runs and the rest step in when it fails.
        Jobs without a workspace choice use each member&apos;s own choices, then the platform
        defaults on Workers AI.
      </p>
      <ModelChoicesEditor workspaceId={workspaceId} />
    </div>
  );
}
