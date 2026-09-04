import { BackLink, Card, FormLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";

import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { isAuthenticationError } from "~/lib/errors";

import { SkillDraftPanel } from "./SkillDraftPanel";
import { SkillEvaluationPanel } from "./SkillEvaluationPanel";
import { SkillHistoryPanel } from "./SkillHistoryPanel";
import { useSkillEditor } from "./useSkillEditor";

interface SkillEditorPageProps {
  skillId: string;
  projectId?: string;
  backPath: string;
  backLabel: string;
}

export function SkillEditorPage({ skillId, projectId, backPath, backLabel }: SkillEditorPageProps) {
  const editor = useSkillEditor({ skillId, projectId });

  if (editor.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isAuthenticationError(editor.loadError)) {
    return (
      <SignInEmptyState
        title="Sign in to edit skills"
        message="Sign in to manage skill drafts and evaluations."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (editor.loadError || !editor.history || !editor.draft) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <Card className="p-8 text-center shadow-none">
          <h1 className="text-2xl font-bold">Skill unavailable</h1>
          <p className="text-sm text-zinc-500">
            This skill no longer exists, or you do not have permission to manage it.
          </p>
          <BackLink href={backPath} label={backLabel} />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10 md:px-10 md:py-14">
      <header className="space-y-3">
        <BackLink href={backPath} label={backLabel} />
        <div>
          <h1 className="text-2xl font-bold">{editor.history.skill.name}</h1>
          <p className="text-sm text-zinc-500">
            Edit, compare and test without changing the live revision.
          </p>
        </div>
      </header>

      {editor.actionError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {editor.actionError.message}
        </p>
      )}

      <SkillDraftPanel
        content={editor.content}
        description={editor.history.skill.description}
        changeNote={editor.changeNote}
        isDirty={editor.isDirty}
        isDraftLive={editor.isDraftLive}
        isSaving={editor.save.isPending}
        isPromoting={editor.promote.isPending}
        latestOutcome={editor.latestDraftResult?.outcome}
        onChange={editor.setContent}
        onChangeNote={editor.setChangeNote}
        onSave={editor.save.submit}
        onPromote={editor.promote.submit}
      />

      <SkillEvaluationPanel
        cases={editor.cases}
        results={editor.results}
        revisionNumber={editor.draft.revision.revision}
        isCreatingCase={editor.createCase.isPending}
        isDeletingCase={editor.deleteCase.isPending}
        isRunning={editor.run.isPending}
        onCreateCase={editor.createCase.submit}
        onDeleteCase={editor.deleteCase.submit}
        onRun={editor.run.submit}
      />

      <SkillHistoryPanel
        history={editor.history}
        leftId={editor.compare.leftId}
        rightId={editor.compare.rightId}
        left={editor.compare.left}
        right={editor.compare.right}
        isRollingBack={editor.rollback.isPending}
        onLeftChange={editor.compare.setLeftId}
        onRightChange={editor.compare.setRightId}
        onRollback={editor.rollback.submit}
      />
    </div>
  );
}
