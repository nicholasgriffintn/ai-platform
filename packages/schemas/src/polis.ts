import z from "zod/v4";

export const POLIS_ACTIONS = [
  "buy_home",
  "buy_to_let",
  "change_job",
  "start_business",
  "have_child",
  "couple_up",
  "retrain",
  "retire_early",
  "move_away",
  "protest",
] as const;
export const polisActionSchema = z.enum(POLIS_ACTIONS);
export type PolisAction = z.infer<typeof polisActionSchema>;

export const POLIS_ACTION_LABELS: Record<PolisAction, string> = {
  buy_home: "Buy a home",
  buy_to_let: "Buy to let",
  change_job: "Change job",
  start_business: "Start a business",
  have_child: "Have a child",
  couple_up: "Settle down",
  retrain: "Retrain",
  retire_early: "Retire early",
  move_away: "Move away",
  protest: "Protest",
};

export interface PolisParameterDefinition {
  label: string;
  group: "Tax" | "Welfare" | "Housing" | "Work" | "Society";
  min: number;
  max: number;
  step: number;
  initial: number;
  unit: "percent" | "money" | "age" | "rate";
  hint: string;
}

export const POLIS_NO_RENT_CAP = 25;

export const POLIS_PARAMETERS = {
  incomeTaxPct: {
    label: "Income tax",
    group: "Tax",
    min: 0,
    max: 70,
    step: 1,
    initial: 22,
    unit: "percent",
    hint: "Share of pay above the allowance",
  },
  salesTaxPct: {
    label: "Sales tax",
    group: "Tax",
    min: 0,
    max: 30,
    step: 1,
    initial: 10,
    unit: "percent",
    hint: "Added to everything people buy",
  },
  corporateTaxPct: {
    label: "Corporate tax",
    group: "Tax",
    min: 0,
    max: 60,
    step: 1,
    initial: 20,
    unit: "percent",
    hint: "Share of company profit",
  },
  propertyTaxPct: {
    label: "Property tax",
    group: "Tax",
    min: 0,
    max: 5,
    step: 0.1,
    initial: 0.4,
    unit: "percent",
    hint: "Share of a home's value each year",
  },
  universalIncome: {
    label: "Universal income",
    group: "Welfare",
    min: 0,
    max: 2500,
    step: 50,
    initial: 0,
    unit: "money",
    hint: "Monthly payment to every adult",
  },
  unemploymentBenefit: {
    label: "Unemployment benefit",
    group: "Welfare",
    min: 0,
    max: 2500,
    step: 50,
    initial: 700,
    unit: "money",
    hint: "Monthly payment while out of work",
  },
  statePension: {
    label: "State pension",
    group: "Welfare",
    min: 0,
    max: 3000,
    step: 50,
    initial: 1000,
    unit: "money",
    hint: "Monthly payment in retirement",
  },
  childBenefit: {
    label: "Child benefit",
    group: "Welfare",
    min: 0,
    max: 800,
    step: 25,
    initial: 75,
    unit: "money",
    hint: "Monthly payment per child",
  },
  rentCapPct: {
    label: "Rent cap",
    group: "Housing",
    min: 0,
    max: POLIS_NO_RENT_CAP,
    step: 1,
    initial: POLIS_NO_RENT_CAP,
    unit: "percent",
    hint: "Largest yearly rent rise. The top of the range means no cap",
  },
  interestRatePct: {
    label: "Interest rate",
    group: "Housing",
    min: 0,
    max: 20,
    step: 0.25,
    initial: 4,
    unit: "percent",
    hint: "Mortgage rate, and what savings earn a share of",
  },
  publicHousingRate: {
    label: "Public housing",
    group: "Housing",
    min: 0,
    max: 30,
    step: 1,
    initial: 2,
    unit: "rate",
    hint: "Homes built each year per 1,000 people",
  },
  minimumWage: {
    label: "Minimum wage",
    group: "Work",
    min: 0,
    max: 6000,
    step: 50,
    initial: 1500,
    unit: "money",
    hint: "Lowest monthly pay a firm can offer",
  },
  publicEmployeesPct: {
    label: "Public sector",
    group: "Work",
    min: 2,
    max: 50,
    step: 1,
    initial: 16,
    unit: "percent",
    hint: "Share of workers in schools, hospitals and the town hall",
  },
  retirementAge: {
    label: "Retirement age",
    group: "Society",
    min: 50,
    max: 80,
    step: 1,
    initial: 67,
    unit: "age",
    hint: "When the state pension starts",
  },
  schoolLeavingAge: {
    label: "School leaving age",
    group: "Society",
    min: 12,
    max: 22,
    step: 1,
    initial: 18,
    unit: "age",
    hint: "More years cost more and raise skill",
  },
  immigrationRate: {
    label: "Immigration",
    group: "Society",
    min: 0,
    max: 50,
    step: 1,
    initial: 6,
    unit: "rate",
    hint: "Arrivals each year per 1,000 people",
  },
} as const satisfies Record<string, PolisParameterDefinition>;

export type PolisParameterId = keyof typeof POLIS_PARAMETERS;
export type PolisParameters = Record<PolisParameterId, number>;

export const POLIS_PARAMETER_IDS = Object.keys(POLIS_PARAMETERS) as PolisParameterId[];

export const polisParameterIdSchema = z.enum(
  POLIS_PARAMETER_IDS as [PolisParameterId, ...PolisParameterId[]],
);

export const POLIS_EMPLOYMENT = ["employed", "unemployed", "retired", "student"] as const;
export const POLIS_TENURE = ["owner", "renter", "landlord", "homeless"] as const;
export const POLIS_WEALTH = ["in_debt", "poor", "comfortable", "rich"] as const;
export const POLIS_AGE_BANDS = ["young", "starting_out", "midlife", "older", "senior"] as const;
export const POLIS_ASPIRATIONS = ["family", "wealth", "career", "comfort", "community"] as const;
export const POLIS_LEVELS = ["low", "medium", "high"] as const;

export type PolisEmployment = (typeof POLIS_EMPLOYMENT)[number];
export type PolisTenure = (typeof POLIS_TENURE)[number];
export type PolisWealth = (typeof POLIS_WEALTH)[number];
export type PolisAgeBand = (typeof POLIS_AGE_BANDS)[number];
export type PolisAspiration = (typeof POLIS_ASPIRATIONS)[number];
export type PolisLevel = (typeof POLIS_LEVELS)[number];

export const polisCohortSchema = z
  .object({
    minAge: z.number().int().min(0).max(110).nullable(),
    maxAge: z.number().int().min(0).max(110).nullable(),
    employment: z.enum(POLIS_EMPLOYMENT).nullable(),
    tenure: z.enum(POLIS_TENURE).nullable(),
    wealth: z.enum(POLIS_WEALTH).nullable(),
  })
  .strict();
export type PolisCohort = z.infer<typeof polisCohortSchema>;

export const polisRuleEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("payment"), amountPerMonth: z.number().min(0).max(5000) }).strict(),
  z.object({ kind: z.literal("levy"), percentOfWealthPerYear: z.number().min(0).max(50) }).strict(),
  z.object({ kind: z.literal("ban"), action: polisActionSchema }).strict(),
  z
    .object({
      kind: z.literal("nudge"),
      action: polisActionSchema,
      multiplier: z.number().min(0.1).max(5),
    })
    .strict(),
]);
export type PolisRuleEffect = z.infer<typeof polisRuleEffectSchema>;

export const polisRuleSchema = z
  .object({ cohort: polisCohortSchema, effect: polisRuleEffectSchema })
  .strict();
export type PolisRule = z.infer<typeof polisRuleSchema>;

export const polisParameterChangeSchema = z
  .object({ parameter: polisParameterIdSchema, value: z.number() })
  .strict()
  .refine(
    ({ parameter, value }) =>
      value >= POLIS_PARAMETERS[parameter].min && value <= POLIS_PARAMETERS[parameter].max,
    { message: "That value is outside what the town can enact" },
  );
export type PolisParameterChange = z.infer<typeof polisParameterChangeSchema>;

export const POLIS_MAX_LAW_CHANGES = 6;
export const POLIS_MAX_LAW_RULES = 6;

export const polisLawSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    changes: z.array(polisParameterChangeSchema).max(POLIS_MAX_LAW_CHANGES),
    rules: z.array(polisRuleSchema).max(POLIS_MAX_LAW_RULES),
  })
  .strict();
export type PolisLaw = z.infer<typeof polisLawSchema>;

export const POLIS_SCENARIOS = [
  "recession",
  "boom",
  "epidemic",
  "factory_closures",
  "immigration_wave",
  "housing_crash",
  "flood",
  "baby_boom",
] as const;
export const polisScenarioKindSchema = z.enum(POLIS_SCENARIOS);
export type PolisScenarioKind = z.infer<typeof polisScenarioKindSchema>;

export const polisScenarioSchema = z
  .object({
    kind: polisScenarioKindSchema,
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    severity: z.number().min(0).max(1),
    months: z.number().int().min(1).max(60),
  })
  .strict();
export type PolisScenario = z.infer<typeof polisScenarioSchema>;

export const POLIS_DRAFT_MAX_LENGTH = 400;

export const polisDraftRequestSchema = z
  .object({
    text: z.string().trim().min(3).max(POLIS_DRAFT_MAX_LENGTH),
    parameters: z.partialRecord(polisParameterIdSchema, z.number()).optional(),
  })
  .strict();
export type PolisDraftRequest = z.infer<typeof polisDraftRequestSchema>;

export const polisLawDraftSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("enforceable"), law: polisLawSchema }),
  z.object({ status: z.literal("unenforceable"), reason: z.string().min(1).max(240) }),
]);
export type PolisLawDraft = z.infer<typeof polisLawDraftSchema>;

export const polisScenarioDraftSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("possible"), scenario: polisScenarioSchema }),
  z.object({ status: z.literal("impossible"), reason: z.string().min(1).max(240) }),
]);
export type PolisScenarioDraft = z.infer<typeof polisScenarioDraftSchema>;

export const polisBucketSchema = z
  .object({
    key: z.number().int().min(0),
    age: z.enum(POLIS_AGE_BANDS),
    wealth: z.enum(POLIS_WEALTH),
    employment: z.enum(POLIS_EMPLOYMENT),
    tenure: z.enum(POLIS_TENURE),
    aspiration: z.enum(POLIS_ASPIRATIONS),
    unemployment: z.enum(POLIS_LEVELS),
    housingCost: z.enum(POLIS_LEVELS),
    mood: z.enum(POLIS_LEVELS),
  })
  .strict();
export type PolisBucket = z.infer<typeof polisBucketSchema>;

export const POLIS_MAX_BUCKETS_PER_REQUEST = 12;
export const POLIS_MAX_LAW_LINES = 16;

export const polisDecisionRequestSchema = z
  .object({
    buckets: z.array(polisBucketSchema).min(1).max(POLIS_MAX_BUCKETS_PER_REQUEST),
    laws: z.array(z.string().trim().min(1).max(280)).max(POLIS_MAX_LAW_LINES),
    proposal: z.string().trim().min(1).max(320).optional(),
    model: z.string().trim().min(1).max(160).optional(),
  })
  .strict();
export type PolisDecisionRequest = z.infer<typeof polisDecisionRequestSchema>;

const probabilitySchema = z.number().min(0).max(1);

export const polisBucketAnswerSchema = z.object({
  key: z.number().int().min(0),
  inclinations: z.record(polisActionSchema, probabilitySchema),
  approval: probabilitySchema,
  support: probabilitySchema.optional(),
});
export type PolisBucketAnswer = z.infer<typeof polisBucketAnswerSchema>;

export const polisDecisionResponseSchema = z.object({
  answers: z.array(polisBucketAnswerSchema),
  failed: z.number().int().min(0),
  model: z.string().nullable(),
  inputTokens: z.number().int().min(0),
  error: z.string().optional(),
});
export type PolisDecisionResponse = z.infer<typeof polisDecisionResponseSchema>;

export const POLIS_MAX_POPULATION = 50_000;
export const POLIS_RECORDING_VERSION = 1;

export const polisWorldEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("law"), day: z.number().int().min(0), law: polisLawSchema }),
  z.object({ type: z.literal("repeal"), day: z.number().int().min(0), id: z.number().int() }),
  z.object({
    type: z.literal("parameters"),
    day: z.number().int().min(0),
    values: z.partialRecord(polisParameterIdSchema, z.number()),
  }),
  z.object({
    type: z.literal("scenario"),
    day: z.number().int().min(0),
    scenario: polisScenarioSchema,
  }),
  z.object({
    type: z.literal("answers"),
    day: z.number().int().min(0),
    epoch: z.number().int().min(0),
    answers: z.array(
      z.object({
        key: z.number().int().min(0),
        inclinations: z.array(probabilitySchema).length(POLIS_ACTIONS.length),
        approval: probabilitySchema,
      }),
    ),
  }),
]);
export type PolisWorldEvent = z.infer<typeof polisWorldEventSchema>;

export const polisRecordingSchema = z.object({
  version: z.literal(POLIS_RECORDING_VERSION),
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  population: z.number().int().min(200).max(POLIS_MAX_POPULATION),
  seed: z.number().int(),
  day: z.number().int().min(0),
  savedAt: z.number().int().min(0),
  log: z.array(polisWorldEventSchema),
});
export type PolisRecording = z.infer<typeof polisRecordingSchema>;

export const POLIS_SHARE_MAX_BYTES = 12 * 1024 * 1024;
export const POLIS_SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

export const polisShareParamsSchema = z.object({
  token: z.string().regex(POLIS_SHARE_TOKEN_PATTERN),
});

export const polisShareSchema = z.object({ token: z.string().regex(POLIS_SHARE_TOKEN_PATTERN) });
export type PolisShare = z.infer<typeof polisShareSchema>;
