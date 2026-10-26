import { Badge, Button, FormInput, Link } from "@ngriffin_uk/polychat-component-ui";
import {
  creditMicrosFromCredits,
  creditsFromCreditMicros,
  type SetupPlan,
  type SetupPlanState,
} from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, Check, Plug } from "lucide-react";
import { useState } from "react";

import { removeSetupConnector, removeSetupSuggestion } from "./setup-plan-edits";
import { SetupPlanBody } from "./SetupPlanBody";
import { formatCap, RemoveButton } from "./SetupPlanParts";

export function SetupPlanView({
  setup,
  canApprove,
  isBusy,
  connectorName,
  connectHref,
  onApprove,
  onArchive,
  onRevise,
}: {
  setup: SetupPlanState | null;
  canApprove: boolean;
  isBusy: boolean;
  connectorName: (provider: string) => string;
  connectHref: string;
  onApprove: (revision: number) => void;
  onArchive: () => void;
  onRevise: (plan: SetupPlan, expectedRevision: number) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<SetupPlan | null>(null);

  if (!setup) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        The lead is reading what you gave it and drafting the setup plan. It appears here, and in
        Inbox, when it is ready.
      </p>
    );
  }

  const plan = draft ?? setup.plan;
  const editable = canApprove && !setup.appliedAt;

  return (
    <div className="space-y-6">
      {setup.failure && !setup.appliedAt ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-failure/30 bg-failure/5 p-4 text-sm"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-failure" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">
              Revision {setup.failure.revision} stopped part way, so nothing it made was kept.
            </p>
            <p className="text-muted-foreground">{setup.failure.message}</p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <SetupPlanBody plan={plan} onChange={draft ? setDraft : undefined} />
        <aside className="h-fit space-y-5 rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Revision {setup.revision}</h2>
            {setup.appliedAt ? (
              <Badge variant="success">Started</Badge>
            ) : (
              <Badge variant="outline">Waiting for approval</Badge>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Budget</dt>
            <dd className="text-right tabular-nums">
              {draft ? (
                <FormInput
                  aria-label="Monthly budget in credits"
                  type="number"
                  min={0}
                  className="text-right"
                  value={
                    draft.monthlyCreditCapMicros
                      ? creditsFromCreditMicros(draft.monthlyCreditCapMicros)
                      : ""
                  }
                  placeholder="No cap"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      monthlyCreditCapMicros:
                        Number(event.target.value) > 0
                          ? creditMicrosFromCredits(Number(event.target.value))
                          : null,
                    })
                  }
                />
              ) : (
                formatCap(plan.monthlyCreditCapMicros)
              )}
            </dd>
            <dt className="text-muted-foreground">Projects</dt>
            <dd className="text-right tabular-nums">{plan.projects.length}</dd>
            <dt className="text-muted-foreground">Hires</dt>
            <dd className="text-right tabular-nums">{plan.teammates.length}</dd>
            <dt className="text-muted-foreground">First tasks</dt>
            <dd className="text-right tabular-nums">{plan.tasks.length}</dd>
          </dl>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Uses
            </p>
            {plan.connectors.length ? (
              <ul className="space-y-1.5 text-sm">
                {plan.connectors.map((connector) => (
                  <li key={connector.provider} className="flex items-start gap-2">
                    <Plug size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      {connectorName(connector.provider)}
                      <span className="text-muted-foreground">
                        {" "}
                        · {connector.access === "read" ? "read only" : "read and write"} in{" "}
                        {connector.projects
                          .map((key) => plan.projects.find((project) => project.key === key)?.name)
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </span>
                    {draft ? (
                      <RemoveButton
                        label={`Stop using ${connectorName(connector.provider)}`}
                        onClick={() => setDraft(removeSetupConnector(draft, connector.provider))}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No connected services</p>
            )}
          </div>
          {plan.suggestions.length ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Worth connecting
              </p>
              <ul className="space-y-2 text-sm">
                {plan.suggestions.map((suggestion) => (
                  <li key={suggestion.provider} className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{connectorName(suggestion.provider)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {suggestion.reason}
                      </span>
                    </span>
                    {draft ? (
                      <RemoveButton
                        label={`Drop the ${connectorName(suggestion.provider)} suggestion`}
                        onClick={() => setDraft(removeSetupSuggestion(draft, suggestion.provider))}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Only suggestions. Connect any of them in{" "}
                <Link href={connectHref} className="underline">
                  Plugins
                </Link>{" "}
                and the lead can use them from then on.
              </p>
            </div>
          ) : null}
          <div className="space-y-2 border-t border-border pt-4">
            {setup.appliedAt ? (
              <>
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <Check size={14} aria-hidden />
                  Started {new Date(setup.appliedAt).toLocaleString("en-GB")}
                </p>
                {canApprove ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    disabled={isBusy}
                    onClick={onArchive}
                  >
                    Undo what the plan created
                  </Button>
                ) : null}
              </>
            ) : draft ? (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={isBusy || !draft.mission.trim()}
                  onClick={() =>
                    void onRevise(draft, setup.revision).then(
                      () => setDraft(null),
                      () => undefined,
                    )
                  }
                >
                  Save as revision {setup.revision + 1}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => setDraft(null)}
                >
                  Discard changes
                </Button>
                <p className="text-xs text-muted-foreground">
                  Saving makes a new revision, which then needs approving.
                </p>
              </>
            ) : editable ? (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => onApprove(setup.revision)}
                >
                  Approve and start
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => setDraft(setup.plan)}
                >
                  Edit plan
                </Button>
                <p className="text-xs text-muted-foreground">
                  Edit it yourself, or reply on the setup task and the lead posts a new revision.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">An owner or admin approves the plan.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
