import { EmptyState, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import { useModelChoices, useUpdateModelChoices } from "@ngriffin_uk/polychat-library-react";
import {
  SYSTEM_MODEL_LINEUP,
  SYSTEM_MODEL_ROLE_GROUPS,
  type SystemModelChoicesResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { ModelChoicesPrefill } from "./ModelChoicesPrefill.js";
import { RoleChoiceCard } from "./RoleChoiceCard.js";

export interface ModelChoicesEditorProps {
  workspaceId?: string;
}

function listOutdatedChoices(data: SystemModelChoicesResponse): string[] {
  return data.roles.flatMap((view) => {
    const label = SYSTEM_MODEL_LINEUP.find((definition) => definition.id === view.role)?.label;

    return view.choices
      .filter((choice) => choice.status !== "ready")
      .map((choice) => {
        const name = (choice.id ? data.models[choice.id]?.name : null) ?? choice.model;

        return choice.status === "retired"
          ? `${label}: ${name} has been retired`
          : `${label}: ${name} is no longer available to you`;
      });
  });
}

function listProviders(data: SystemModelChoicesResponse): string[] {
  const providers = new Set(
    data.roles.flatMap((view) => view.options.flatMap((id) => data.models[id]?.provider ?? [])),
  );

  return [...providers].sort();
}

function OutdatedNotice({ notes }: { notes: string[] }) {
  return (
    <div
      role="status"
      className="flex gap-3 rounded-xl border border-attention/25 bg-attention/10 p-4 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {notes.length === 1
            ? "One choice needs a replacement"
            : `${notes.length} choices need a replacement`}
        </p>
        <p className="text-muted-foreground">
          These are skipped until you swap them, so the next choice or the platform default runs
          instead.
        </p>
        <ul className="list-disc pl-5 text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ModelChoicesEditor({ workspaceId }: ModelChoicesEditorProps) {
  const { data, isLoading, error } = useModelChoices(workspaceId);
  const update = useUpdateModelChoices(workspaceId);

  if (isLoading) {
    return (
      <ul aria-label="Loading model choices" className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <li key={index}>
            <Skeleton className="h-44 w-full rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Model choices unavailable"
        message="Your choices could not be loaded. The platform defaults keep running meanwhile."
        className="min-h-[200px]"
      />
    );
  }

  const outdated = listOutdatedChoices(data);
  const views = new Map(data.roles.map((view) => [view.role, view]));

  return (
    <div className="space-y-8">
      {!data.editable && (
        <p className="text-sm text-muted-foreground">
          Only workspace owners and admins can change these.
        </p>
      )}
      {outdated.length > 0 && <OutdatedNotice notes={outdated} />}
      {data.editable && (
        <ModelChoicesPrefill
          workspaceId={workspaceId}
          models={data.models}
          providers={listProviders(data)}
          applying={update.isPending}
          onApply={(choices) =>
            update.mutateAsync({ choices }).then(
              () => toast.success("Choices applied"),
              (mutationError: Error) =>
                toast.error("Couldn't apply those choices", {
                  description: mutationError.message,
                }),
            )
          }
        />
      )}
      {SYSTEM_MODEL_ROLE_GROUPS.map((group) => {
        const definitions = SYSTEM_MODEL_LINEUP.filter(
          (definition) => definition.group === group.id,
        );

        return (
          <section
            key={group.id}
            aria-labelledby={`model-choices-${group.id}`}
            className="space-y-3"
          >
            <h2
              id={`model-choices-${group.id}`}
              className="font-display text-lg font-medium tracking-tight text-foreground"
            >
              {group.label}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {definitions.flatMap((definition) => {
                const view = views.get(definition.id);

                return view
                  ? [
                      <RoleChoiceCard
                        key={definition.id}
                        definition={definition}
                        view={view}
                        models={data.models}
                        editable={data.editable}
                        saving={
                          update.isPending && update.variables?.choices[definition.id] !== undefined
                        }
                        onChange={(choices) =>
                          update.mutate(
                            { choices: { [definition.id]: choices } },
                            {
                              onError: (mutationError) =>
                                toast.error("Couldn't save that choice", {
                                  description: mutationError.message,
                                }),
                            },
                          )
                        }
                      />,
                    ]
                  : [];
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
