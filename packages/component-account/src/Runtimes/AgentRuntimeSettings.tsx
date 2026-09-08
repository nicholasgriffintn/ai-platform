import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { SettingsSection } from "../SettingsSection";

export function AgentRuntimeSettings({
  models,
  onRefresh,
  isLoading,
  error,
}: {
  models: ModelConfig;
  onRefresh: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const agents = Object.values(models).filter((model) => model.kind === "agent");

  return (
    <SettingsSection
      title="Installed coding agents"
      description="Polychat checks the installed command-line tools and their sign-in state. Choose a working folder when sending an agent message; the selected permission mode applies to that run."
    >
      <div className="space-y-3">
        {agents.map((model) => (
          <div key={model.matchingModel} className="rounded-lg border border-border p-4">
            <p className="font-medium">{model.name}</p>
            <p className="text-sm text-muted-foreground">{model.readiness?.reason}</p>
          </div>
        ))}
        {!isLoading && agents.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No supported coding agents found. Install and sign in to a supported CLI, then check
            again.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-failure">
            {error}
          </p>
        )}
        <Button type="button" variant="secondary" isLoading={isLoading} onClick={onRefresh}>
          Check installed agents
        </Button>
      </div>
    </SettingsSection>
  );
}
