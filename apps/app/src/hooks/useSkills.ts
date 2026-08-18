import type { SkillAvailabilityResponse } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { capabilityCatalogQueryKey } from "~/hooks/useCapabilityCatalog";
import { projectQueryKey } from "~/hooks/useWorkspaces";
import {
  createSkill,
  deleteSkill,
  fetchPersonalSkills,
  setPersonalSkillEnabled,
} from "~/lib/api/skills";

export const PERSONAL_SKILLS_QUERY_KEY = ["personalSkills"];

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
  const query = useQuery({
    queryKey: PERSONAL_SKILLS_QUERY_KEY,
    queryFn: fetchPersonalSkills,
    enabled,
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

export function useDeleteSkill(projectId?: string) {
  const invalidateSkillScope = useInvalidateSkillScope(projectId);

  return useMutation({
    mutationFn: (skillId: string) => deleteSkill(skillId, projectId),
    onSuccess: invalidateSkillScope,
  });
}
