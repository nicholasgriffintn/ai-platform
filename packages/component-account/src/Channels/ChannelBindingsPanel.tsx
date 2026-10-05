import { Button, SignInEmptyState } from "@ngriffin_uk/polychat-component-ui";
import type {
  ChannelBinding,
  CreateChannelBindingInput,
  UpdateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";

import { SettingsSection } from "../SettingsSection";
import { ChannelBindingCard } from "./ChannelBindingCard";
import { ChannelBindingForm } from "./ChannelBindingForm";

export interface ChannelBindingsPanelProps {
  bindings: ChannelBinding[];
  teammates: { id: string; name: string }[];
  projectId?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  loadError?: string;
  createError?: string;
  isCreating: boolean;
  updatingId?: string;
  deletingId?: string;
  onSignIn: () => void;
  onRetry: () => void;
  onCreate: (input: CreateChannelBindingInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateChannelBindingInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ChannelBindingsPanel(props: ChannelBindingsPanelProps) {
  if (!props.isAuthenticated) {
    return (
      <SignInEmptyState
        title="Sign in to connect channels"
        message="Manage the channels allowed to start conversations with Polychat."
        onSignIn={props.onSignIn}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Connected channels"
        description="Each Slack thread keeps its own history. Allowed senders can use your access in the selected personal or project scope."
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Send <strong>polychat stop</strong> to stop the current reply,{" "}
          <strong>polychat mute</strong> to mute a thread, or <strong>polychat resume</strong> to
          resume replies. Send these commands in the thread you want to control.
        </p>
        {props.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading channels…</p>
        ) : props.loadError ? (
          <div role="alert">
            <p className="text-sm text-failure">{props.loadError}</p>
            <Button variant="outline" onClick={props.onRetry}>
              Try again
            </Button>
          </div>
        ) : props.bindings.length ? (
          <div className="space-y-4">
            {props.bindings.map((binding) => (
              <ChannelBindingCard
                key={`${binding.id}:${binding.revision}`}
                binding={binding}
                isSaving={props.updatingId === binding.id}
                isDeleting={props.deletingId === binding.id}
                onUpdate={(input) => props.onUpdate(binding.id, input)}
                onDelete={() => props.onDelete(binding.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No channels connected {props.projectId ? "to this project" : "to your personal account"}
            .
          </p>
        )}
      </SettingsSection>
      <SettingsSection
        title="Connect a channel"
        description="Install the deployment’s Polychat bot in Slack, or use the configured Telegram bot, then choose who can send it messages."
      >
        <ChannelBindingForm
          projectId={props.projectId}
          teammates={props.teammates}
          isSaving={props.isCreating}
          errorMessage={props.createError}
          onSave={props.onCreate}
        />
      </SettingsSection>
    </div>
  );
}
