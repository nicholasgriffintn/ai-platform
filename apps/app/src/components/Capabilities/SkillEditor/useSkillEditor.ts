import type {
  AuthoredSkillEvaluationCaseInput,
  AuthoredSkillEvaluationRunInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  createSkillEvaluationCase,
  deleteSkillEvaluationCase,
  fetchSkillEvaluationCases,
  fetchSkillEvaluationResults,
  fetchSkillHistory,
  fetchSkillRevision,
  promoteSkillDraft,
  rollbackSkill,
  runSkillEvaluation,
  saveSkillDraft,
} from "~/lib/api/skills";

interface SkillEditorInput {
  skillId: string;
  projectId?: string;
}

function editorQueryKey(skillId: string, projectId?: string) {
  return ["skillEditor", projectId ?? "personal", skillId] as const;
}

export function useSkillEditor({ skillId, projectId }: SkillEditorInput) {
  const queryClient = useQueryClient();
  const baseKey = editorQueryKey(skillId, projectId);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [compareLeftId, setCompareLeftId] = useState<string>();
  const [compareRightId, setCompareRightId] = useState<string>();
  const history = useQuery({
    queryKey: [...baseKey, "history"],
    queryFn: () => fetchSkillHistory(skillId, projectId),
  });
  const draftRevisionId = history.data?.state.draftRevisionId;
  const stableRevisionId = history.data?.state.stableRevisionId;
  const leftRevisionId = compareLeftId ?? stableRevisionId;
  const rightRevisionId = compareRightId ?? draftRevisionId;
  const draft = useQuery({
    queryKey: [...baseKey, "revision", draftRevisionId],
    queryFn: () => fetchSkillRevision(skillId, draftRevisionId!, projectId),
    enabled: Boolean(draftRevisionId),
  });
  const leftRevision = useQuery({
    queryKey: [...baseKey, "revision", leftRevisionId],
    queryFn: () => fetchSkillRevision(skillId, leftRevisionId!, projectId),
    enabled: Boolean(leftRevisionId),
  });
  const rightRevision = useQuery({
    queryKey: [...baseKey, "revision", rightRevisionId],
    queryFn: () => fetchSkillRevision(skillId, rightRevisionId!, projectId),
    enabled: Boolean(rightRevisionId),
  });
  const cases = useQuery({
    queryKey: [...baseKey, "evaluationCases"],
    queryFn: () => fetchSkillEvaluationCases(skillId, projectId),
  });
  const results = useQuery({
    queryKey: [...baseKey, "evaluationResults"],
    queryFn: () => fetchSkillEvaluationResults(skillId, projectId),
  });

  const refreshLifecycle = async () => {
    await queryClient.invalidateQueries({ queryKey: baseKey });
  };

  const content = editedContent ?? draft.data?.content ?? "";

  const save = useMutation({
    mutationFn: () =>
      saveSkillDraft(
        skillId,
        {
          content,
          resources: draft.data?.resources,
          expectedStateVersion: history.data!.state.stateVersion,
          ...(changeNote.trim() ? { changeNote: changeNote.trim() } : {}),
        },
        projectId,
      ),
    onSuccess: async () => {
      await refreshLifecycle();
      setEditedContent(null);
      setChangeNote("");
    },
  });
  const promote = useMutation({
    mutationFn: () =>
      promoteSkillDraft(
        skillId,
        {
          revisionId: history.data!.state.draftRevisionId,
          expectedStateVersion: history.data!.state.stateVersion,
        },
        projectId,
      ),
    onSuccess: refreshLifecycle,
  });
  const rollback = useMutation({
    mutationFn: (revisionId: string) =>
      rollbackSkill(
        skillId,
        {
          revisionId,
          expectedStateVersion: history.data!.state.stateVersion,
          changeNote: `Rollback to revision ${revisionId}`,
        },
        projectId,
      ),
    onSuccess: refreshLifecycle,
  });
  const createCase = useMutation({
    mutationFn: (input: AuthoredSkillEvaluationCaseInput) =>
      createSkillEvaluationCase(skillId, input, projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...baseKey, "evaluationCases"] }),
  });
  const deleteCase = useMutation({
    mutationFn: (caseId: string) => deleteSkillEvaluationCase(skillId, caseId, projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...baseKey, "evaluationCases"] }),
  });
  const run = useMutation({
    mutationFn: (input: Omit<AuthoredSkillEvaluationRunInput, "revisionId">) =>
      runSkillEvaluation(
        skillId,
        { ...input, revisionId: history.data!.state.draftRevisionId },
        projectId,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...baseKey, "evaluationResults"] }),
  });
  const latestDraftResult = useMemo(
    () => results.data?.results.find((result) => result.revisionId === draftRevisionId),
    [draftRevisionId, results.data?.results],
  );

  return {
    skillId,
    history: history.data,
    draft: draft.data,
    content,
    setContent: setEditedContent,
    changeNote,
    setChangeNote,
    compare: {
      leftId: leftRevisionId,
      rightId: rightRevisionId,
      setLeftId: setCompareLeftId,
      setRightId: setCompareRightId,
      left: leftRevision.data,
      right: rightRevision.data,
    },
    cases: cases.data?.cases ?? [],
    results: results.data?.results ?? [],
    latestDraftResult,
    isDraftLive: Boolean(draftRevisionId && draftRevisionId === stableRevisionId),
    isDirty: editedContent !== null && editedContent !== draft.data?.content,
    isLoading: history.isLoading || draft.isLoading,
    loadError: history.error ?? draft.error,
    actionError:
      save.error ??
      promote.error ??
      rollback.error ??
      createCase.error ??
      deleteCase.error ??
      run.error,
    save: { submit: save.mutateAsync, isPending: save.isPending },
    promote: { submit: promote.mutateAsync, isPending: promote.isPending },
    rollback: { submit: rollback.mutateAsync, isPending: rollback.isPending },
    createCase: { submit: createCase.mutateAsync, isPending: createCase.isPending },
    deleteCase: { submit: deleteCase.mutateAsync, isPending: deleteCase.isPending },
    run: { submit: run.mutateAsync, isPending: run.isPending, result: run.data },
  };
}
