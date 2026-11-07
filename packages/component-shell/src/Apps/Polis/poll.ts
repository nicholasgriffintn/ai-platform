import type { PolisBucket, PolisBucketAnswer } from "@ngriffin_uk/polychat-schemas";

export interface PollGroup {
  label: string;
  support: number;
  people: number;
}

export interface PollResult {
  support: number;
  people: number;
  groups: PollGroup[];
}

const GROUPS: { label: string; matches: (bucket: PolisBucket) => boolean }[] = [
  { label: "Homeowners", matches: (bucket) => bucket.tenure === "owner" },
  { label: "Renters", matches: (bucket) => bucket.tenure === "renter" },
  { label: "Landlords", matches: (bucket) => bucket.tenure === "landlord" },
  { label: "In work", matches: (bucket) => bucket.employment === "employed" },
  { label: "Out of work", matches: (bucket) => bucket.employment === "unemployed" },
  { label: "Retired", matches: (bucket) => bucket.employment === "retired" },
  { label: "Rich", matches: (bucket) => bucket.wealth === "rich" },
  {
    label: "Struggling",
    matches: (bucket) => bucket.wealth === "poor" || bucket.wealth === "in_debt",
  },
  {
    label: "Under 35",
    matches: (bucket) => bucket.age === "young" || bucket.age === "starting_out",
  },
];

export function summarisePoll(
  buckets: readonly { bucket: PolisBucket; people: number }[],
  answers: readonly PolisBucketAnswer[],
): PollResult {
  const support = new Map(answers.map((answer) => [answer.key, answer.support ?? 0]));
  const answered = buckets.filter(({ bucket }) => support.has(bucket.key));
  const weigh = (rows: typeof answered) => {
    const people = rows.reduce((sum, row) => sum + row.people, 0);
    const weighted = rows.reduce(
      (sum, row) => sum + row.people * (support.get(row.bucket.key) ?? 0),
      0,
    );

    return { people, support: people === 0 ? 0 : weighted / people };
  };

  return {
    ...weigh(answered),
    groups: GROUPS.map(({ label, matches }) => ({
      label,
      ...weigh(answered.filter(({ bucket }) => matches(bucket))),
    })).filter((group) => group.people > 0),
  };
}
