export type FocusRole =
  | "design"
  | "education"
  | "engineering"
  | "leadership"
  | "research"
  | "writing";

const FOCUS_ROLE_KEYWORDS: Array<{ role: FocusRole; keywords: string[] }> = [
  {
    role: "engineering",
    keywords: ["engineer", "developer", "software", "technical", "programmer"],
  },
  { role: "design", keywords: ["design", "creative", "artist", "illustrator"] },
  {
    role: "leadership",
    keywords: ["manager", "founder", "leader", "product", "director", "executive"],
  },
  { role: "writing", keywords: ["writer", "editor", "content", "marketing", "communications"] },
  { role: "research", keywords: ["research", "scientist", "analyst", "academic"] },
  { role: "education", keywords: ["student", "teacher", "educator"] },
];

export function resolveFocusRole(jobRole: string | null | undefined): FocusRole | null {
  const normalisedRole = jobRole?.trim().toLocaleLowerCase();

  if (!normalisedRole) {
    return null;
  }

  return (
    FOCUS_ROLE_KEYWORDS.find(({ keywords }) =>
      keywords.some((keyword) => normalisedRole.includes(keyword)),
    )?.role ?? null
  );
}
