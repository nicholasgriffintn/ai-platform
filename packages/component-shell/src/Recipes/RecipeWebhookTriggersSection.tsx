import { CopyButton } from "@ngriffin_uk/polychat-component-content";
import { Badge, Button, Input, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type { RecipeWebhookTrigger } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import { PauseCircle, PlayCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { useRecipeWebhookTriggers } from "./useRecipeWebhookTriggers.js";

interface RecipeWebhookTriggersSectionProps {
  installationId: string;
  onDelete: (trigger: RecipeWebhookTrigger) => void;
}

export function RecipeWebhookTriggersSection({
  installationId,
  onDelete,
}: RecipeWebhookTriggersSectionProps) {
  const manager = useRecipeWebhookTriggers(installationId);
  const { copied, copy } = useCopyToClipboard();
  const [condition, setCondition] = useState("");
  const [revealed, setRevealed] = useState<{ triggerId: string; url: string } | null>(null);
  const triggers = manager.triggers.data?.triggers ?? [];
  const requestError =
    manager.triggers.error ??
    manager.createTrigger.error ??
    manager.updateTrigger.error ??
    manager.rotateTrigger.error;

  const create = async () => {
    const created = await manager.createTrigger.mutateAsync({
      condition: condition.trim() || undefined,
    });

    setCondition("");
    setRevealed({ triggerId: created.id, url: created.url });
  };

  const rotate = async (trigger: RecipeWebhookTrigger) => {
    const rotated = await manager.rotateTrigger.mutateAsync(trigger.id);

    setRevealed({ triggerId: rotated.id, url: rotated.url });
  };

  return (
    <section aria-labelledby="recipe-webhooks" className="space-y-3">
      <div>
        <h3 id="recipe-webhooks" className="text-sm font-semibold text-foreground">
          Webhooks
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Start this recipe from any service that can send a JSON POST. The URL is the only key, so
          keep it private. Send an Idempotency-Key header to stop retries from running twice.
        </p>
      </div>

      {requestError && (
        <p role="alert" className="text-sm text-failure">
          {getErrorMessage(requestError, "Could not load or update webhooks.")}
        </p>
      )}

      {revealed && (
        <div className="space-y-2 rounded-lg border border-attention/45 bg-attention/10 p-3">
          <p className="text-xs text-foreground">
            Copy this URL now. It will not be shown again; rotate the webhook if you lose it.
          </p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={revealed.url}
              aria-label="Webhook URL"
              className="h-auto py-1.5 font-mono text-xs"
            />
            <CopyButton value={revealed.url} copied={copied} onCopy={copy} />
          </div>
        </div>
      )}

      <form
        className="space-y-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void create().catch(() => undefined);
        }}
      >
        <Label htmlFor="recipe-webhook-condition">Only run when</Label>
        <Textarea
          id="recipe-webhook-condition"
          value={condition}
          maxLength={2000}
          placeholder="Optional — for example: the payment failed"
          onChange={(event) => setCondition(event.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          isLoading={manager.createTrigger.isPending}
        >
          Create webhook
        </Button>
      </form>

      {triggers.length > 0 && (
        <ul className="space-y-2">
          {triggers.map((trigger) => {
            const active = trigger.status === "active";

            return (
              <li
                key={trigger.id}
                className="rounded-lg border border-border bg-surface-elevated/70 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-xs text-muted-foreground">
                    {trigger.condition ? `Only when: ${trigger.condition}` : "Every request"}
                  </p>
                  <Badge variant="outline">{active ? "Active" : "Paused"}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    icon={
                      active ? (
                        <PauseCircle className="h-3.5 w-3.5" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5" />
                      )
                    }
                    isLoading={
                      manager.updateTrigger.isPending &&
                      manager.updateTrigger.variables?.triggerId === trigger.id
                    }
                    onClick={() =>
                      manager.updateTrigger.mutate({
                        triggerId: trigger.id,
                        status: active ? "paused" : "active",
                      })
                    }
                  >
                    {active ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                    isLoading={
                      manager.rotateTrigger.isPending &&
                      manager.rotateTrigger.variables === trigger.id
                    }
                    onClick={() => void rotate(trigger).catch(() => undefined)}
                  >
                    New URL
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => onDelete(trigger)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
