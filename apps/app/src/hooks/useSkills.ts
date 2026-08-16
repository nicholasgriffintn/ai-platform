import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SkillAvailabilityResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchPersonalSkills, setPersonalSkillEnabled } from "~/lib/api/skills";

export const PERSONAL_SKILLS_QUERY_KEY = ["personalSkills"];

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
