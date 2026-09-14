import {
  useAuthoredSkill,
  useAuthoredSkillHistory,
  usePromoteSkillDraft,
  useRollbackSkill,
  useSaveSkillDraft,
} from "@ngriffin_uk/polychat-library-react";
import type {
  AuthoredSkillDocument,
  AuthoredSkillHistoryResponse,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface SkillEditorControllerOptions {
  skillId: string;
  projectId?: string;
  canManage: boolean;
}

export interface SkillEditorController {
  canManage: boolean;
  changeNote: string;
  content: string;
  hasUnpublishedDraft: boolean;
  history?: AuthoredSkillHistoryResponse;
  isDirty: boolean;
  isLoading: boolean;
  isPublishing: boolean;
  isRestoring: boolean;
  isSaving: boolean;
  loadError: Error | null;
  publish: () => void;
  restore: (revisionId: string) => void;
  save: () => void;
  setChangeNote: (value: string) => void;
  setContent: (value: string) => void;
  skill?: AuthoredSkillDocument;
}

export function useSkillEditorController({
  skillId,
  projectId,
  canManage,
}: SkillEditorControllerOptions): SkillEditorController {
  const skillQuery = useAuthoredSkill(skillId, projectId);
  const historyQuery = useAuthoredSkillHistory(skillId, projectId);
  const saveDraft = useSaveSkillDraft(skillId, projectId);
  const promoteDraft = usePromoteSkillDraft(skillId, projectId);
  const rollback = useRollbackSkill(skillId, projectId);
  const [content, setContent] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const lastServerContentRef = useRef<string | null>(null);

  const serverContent = skillQuery.data?.content ?? "";
  const resolvedContent = content ?? serverContent;
  const state = historyQuery.data?.state;
  const hasUnpublishedDraft = Boolean(state && state.draftRevisionId !== state.stableRevisionId);
  const isDirty = resolvedContent !== serverContent;

  useEffect(() => {
    const nextContent = skillQuery.data?.content;

    if (nextContent !== undefined && lastServerContentRef.current !== nextContent) {
      lastServerContentRef.current = nextContent;
      setContent(nextContent);
    }
  }, [skillQuery.data?.content]);

  const save = async () => {
    if (!state) {
      return;
    }

    try {
      await saveDraft.mutateAsync({
        content: resolvedContent,
        expectedStateVersion: state.stateVersion,
        ...(changeNote.trim() ? { changeNote: changeNote.trim() } : {}),
      });
      setChangeNote("");
      toast.success("Draft saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save the draft."));
    }
  };

  const publish = async () => {
    if (!state || !hasUnpublishedDraft) {
      return;
    }

    try {
      await promoteDraft.mutateAsync({
        revisionId: state.draftRevisionId,
        expectedStateVersion: state.stateVersion,
      });
      toast.success("Revision published");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not publish the revision."));
    }
  };

  const restore = async (revisionId: string) => {
    if (!state) {
      return;
    }

    try {
      await rollback.mutateAsync({
        revisionId,
        expectedStateVersion: state.stateVersion,
      });
      toast.success("Revision restored");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not restore the revision."));
    }
  };

  return {
    canManage,
    changeNote,
    content: resolvedContent,
    hasUnpublishedDraft,
    ...(historyQuery.data ? { history: historyQuery.data } : {}),
    isDirty,
    isLoading: skillQuery.isLoading || historyQuery.isLoading,
    isPublishing: promoteDraft.isPending,
    isRestoring: rollback.isPending,
    isSaving: saveDraft.isPending,
    loadError: skillQuery.error ?? historyQuery.error ?? null,
    publish: () => {
      void publish();
    },
    restore: (revisionId: string) => {
      void restore(revisionId);
    },
    save: () => {
      void save();
    },
    setChangeNote,
    setContent: (value: string) => setContent(value),
    ...(skillQuery.data ? { skill: skillQuery.data } : {}),
  };
}
