import {
  createSkill,
  createTeachingSkillDraft,
  deleteSkill,
  fetchPersonalSkills,
  getSkill,
  getSkillHistory,
  promoteSkillDraft,
  rollbackSkill,
  saveSkillDraft,
  setPersonalSkillEnabled,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type {
  AuthoredSkillDraftInput,
  AuthoredSkillPromotionInput,
  AuthoredSkillRollbackInput,
  SkillAvailabilityResponse,
  TeachingSkillDraftInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { capabilityCatalogQueryKey } from "../hooks/useCapabilityCatalog.js";
import { projectQueryKey } from "../hooks/useWorkspaces.js";

export const PERSONAL_SKILLS_QUERY_KEY = ["personalSkills"];

export const authoredSkillQueryKey = (skillId: string, projectId?: string) =>
  ["authoredSkill", projectId ?? "personal", skillId] as const;

export const authoredSkillHistoryQueryKey = (skillId: string, projectId?: string) =>
  ["authoredSkillHistory", projectId ?? "personal", skillId] as const;

function useInvalidateSkillScope(projectId?: string) {
  const queryClient = useQueryClient();

  return async () => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: capabilityCatalogQueryKey(projectId) }),
    ];

    if (projectId) {
      invalidations.push(queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) }));
    } else {
      invalidations.push(queryClient.invalidateQueries({ queryKey: PERSONAL_SKILLS_QUERY_KEY }));
    }

    await Promise.all(invalidations);
  };
}

export function usePersonalSkills(enabled = true) {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const query = useQuery({
    queryKey: PERSONAL_SKILLS_QUERY_KEY,
    queryFn: fetchPersonalSkills,
    staleTime: 1000 * 60 * 5,
    enabled: enabled && isAuthenticated,
  });
  const setEnabled = useMutation({
    mutationFn: ({ skillId, enabled: nextEnabled }: { skillId: string; enabled: boolean }) =>
      setPersonalSkillEnabled(skillId, nextEnabled),
    onSuccess: (saved) => {
      queryClient.setQueryData<SkillAvailabilityResponse>(
        PERSONAL_SKILLS_QUERY_KEY,
        (current) =>
          current && {
            skills: current.skills.map((skill) => (skill.id === saved.id ? saved : skill)),
          },
      );
    },
  });

  return { query, setEnabled };
}

export function useAddSkill(projectId?: string) {
  const invalidateSkillScope = useInvalidateSkillScope(projectId);

  return useMutation({
    mutationFn: (content: string) => createSkill(content, projectId),
    onSuccess: invalidateSkillScope,
  });
}

export function useCreateTeachingSkillDraft() {
  const invalidateSkillScope = useInvalidateSkillScope();

  return useMutation({
    mutationFn: (input: TeachingSkillDraftInput) => createTeachingSkillDraft(input),
    onSuccess: invalidateSkillScope,
  });
}

export function useDeleteSkill(projectId?: string) {
  const invalidateSkillScope = useInvalidateSkillScope(projectId);

  return useMutation({
    mutationFn: (skillId: string) => deleteSkill(skillId, projectId),
    onSuccess: invalidateSkillScope,
  });
}

export function useAuthoredSkill(skillId: string, projectId?: string) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: authoredSkillQueryKey(skillId, projectId),
    queryFn: () => getSkill(skillId, projectId),
    enabled: isAuthenticated && Boolean(skillId),
    staleTime: 1000 * 30,
  });
}

export function useAuthoredSkillHistory(skillId: string, projectId?: string) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: authoredSkillHistoryQueryKey(skillId, projectId),
    queryFn: () => getSkillHistory(skillId, projectId),
    enabled: isAuthenticated && Boolean(skillId),
    staleTime: 1000 * 30,
  });
}

function useInvalidateAuthoredSkill(skillId: string, projectId?: string) {
  const queryClient = useQueryClient();
  const invalidateSkillScope = useInvalidateSkillScope(projectId);

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: authoredSkillQueryKey(skillId, projectId) }),
      queryClient.invalidateQueries({
        queryKey: authoredSkillHistoryQueryKey(skillId, projectId),
      }),
      invalidateSkillScope(),
    ]);
  };
}

export function useSaveSkillDraft(skillId: string, projectId?: string) {
  const invalidate = useInvalidateAuthoredSkill(skillId, projectId);

  return useMutation({
    mutationFn: (input: AuthoredSkillDraftInput) => saveSkillDraft(skillId, input, projectId),
    onSuccess: invalidate,
  });
}

export function usePromoteSkillDraft(skillId: string, projectId?: string) {
  const invalidate = useInvalidateAuthoredSkill(skillId, projectId);

  return useMutation({
    mutationFn: (input: AuthoredSkillPromotionInput) =>
      promoteSkillDraft(skillId, input, projectId),
    onSuccess: invalidate,
  });
}

export function useRollbackSkill(skillId: string, projectId?: string) {
  const invalidate = useInvalidateAuthoredSkill(skillId, projectId);

  return useMutation({
    mutationFn: (input: AuthoredSkillRollbackInput) => rollbackSkill(skillId, input, projectId),
    onSuccess: invalidate,
  });
}
