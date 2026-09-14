import {
  BackLink,
  Button,
  Card,
  FormInput,
  FormLoadingSkeleton,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { CheckCircle2, RotateCcw, Save, Upload } from "lucide-react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { useSkillEditorController } from "./useSkillEditorController.js";

export interface SkillEditorPageProps {
  skillId: string;
  backPath: string;
  backLabel: string;
  projectId?: string;
  canManage?: boolean;
}

export function SkillEditorPage({
  skillId,
  backPath,
  backLabel,
  projectId,
  canManage = true,
}: SkillEditorPageProps) {
  const controller = useSkillEditorController({ skillId, projectId, canManage });

  if (controller.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isAuthenticationError(controller.loadError)) {
    return (
      <SignInEmptyState
        title="Sign in to review skills"
        message="Sign in to review, edit and publish skill revisions."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (controller.loadError || !controller.skill) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <Card className="p-8 text-center shadow-none">
          <h1 className="text-2xl font-bold text-foreground">Skill unavailable</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This skill no longer exists, or it is not yours to open.
          </p>
          <BackLink href={backPath} label={backLabel} />
        </Card>
      </div>
    );
  }

  const { skill } = controller;
  const revisions = controller.history?.revisions ?? [];
  const stableRevisionId = controller.history?.state.stableRevisionId;
  const draftRevisionId = controller.history?.state.draftRevisionId;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10 md:py-14">
      <header className="mb-8 space-y-3">
        <BackLink href={backPath} label={backLabel} />
        <h1 className="text-2xl font-bold text-foreground">{skill.name}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{skill.description}</p>
      </header>

      <Card className="space-y-5 p-6 shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Skill document</h2>
            <p className="text-xs text-muted-foreground">
              Saved edits stay a draft until you publish them.
            </p>
          </div>
          {controller.hasUnpublishedDraft ? (
            <span className="rounded-full bg-surface-elevated px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Unpublished draft
            </span>
          ) : null}
        </div>

        <Textarea
          aria-label="Skill document"
          rows={18}
          value={controller.content}
          disabled={!controller.canManage || controller.isSaving}
          onChange={(event) => controller.setContent(event.target.value)}
        />

        <FormInput
          label="Change note"
          value={controller.changeNote}
          placeholder="What changed, and why"
          disabled={!controller.canManage || controller.isSaving}
          onChange={(event) => controller.setChangeNote(event.target.value)}
        />

        {controller.canManage ? (
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              icon={<Save size={16} />}
              isLoading={controller.isSaving}
              disabled={!controller.isDirty}
              onClick={controller.save}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Upload size={16} />}
              isLoading={controller.isPublishing}
              disabled={controller.isDirty || !controller.hasUnpublishedDraft}
              onClick={controller.publish}
            >
              Publish revision
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can read this skill, but only project admins can change it.
          </p>
        )}
      </Card>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Revision history</h2>
        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No revisions yet.</p>
        ) : (
          <ul className="space-y-2">
            {revisions.map((revision) => {
              const isStable = revision.id === stableRevisionId;
              const isDraft = revision.id === draftRevisionId;

              return (
                <li
                  key={revision.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Revision {revision.revision}
                      {isStable && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <CheckCircle2 size={12} /> Published
                        </span>
                      )}
                      {isDraft && !isStable && (
                        <span className="text-[11px] font-medium text-muted-foreground">Draft</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {revision.changeNote ?? "No change note"} ·{" "}
                      {formatRelativeTime(revision.createdAt)}
                    </p>
                  </div>
                  {controller.canManage && !isStable ? (
                    <Button
                      variant="icon"
                      size="icon"
                      icon={<RotateCcw size={15} />}
                      aria-label={`Restore revision ${revision.revision}`}
                      disabled={controller.isRestoring}
                      onClick={() => controller.restore(revision.id)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
