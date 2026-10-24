import { listSkillGuides } from "@ngriffin_uk/polychat-library-client";
import type { PolyPlace, SkillGuide } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

export const SKILL_GUIDES_QUERY_KEY = ["skillGuides"] as const;

export function useSkillGuides() {
  return useQuery({
    queryKey: SKILL_GUIDES_QUERY_KEY,
    queryFn: listSkillGuides,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSkillGuide(place: PolyPlace | undefined): SkillGuide | null {
  const { data } = useSkillGuides();

  return place ? (data?.find((guide) => guide.place === place) ?? null) : null;
}
