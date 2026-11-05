import z from "zod/v4";

import { recipeInstallationTriggerSchema } from "./apps.js";

export const POLY_ROUTINE_TEMPLATES = [
  {
    id: "poly-morning-brief",
    title: "Morning brief",
    summary: "Your day in a few lines: meetings, what changed and what is waiting on you.",
    bounds: "Reads your mail and calendar. Changes nothing.",
    cadence: "Weekdays",
    weekdays: "1-5",
    time: "07:30",
  },
  {
    id: "poly-inbox-triage",
    title: "Inbox triage",
    summary: "Sorts new mail into what needs you, then proposes drafts for the replies.",
    bounds: "Reads your mail. Saves a draft only when you approve it, and never sends.",
    cadence: "Weekdays",
    weekdays: "1-5",
    time: "08:30",
  },
  {
    id: "poly-meeting-prep",
    title: "Meeting prep",
    summary: "Who is in today's meetings, what you last discussed and what to bring.",
    bounds: "Reads your mail and calendar. Changes nothing.",
    cadence: "Weekdays",
    weekdays: "1-5",
    time: "07:45",
  },
  {
    id: "poly-follow-ups",
    title: "Follow-ups",
    summary: "Finds sent mail that never got a reply and proposes a nudge for each.",
    bounds: "Reads your mail. Saves a draft only when you approve it, and never sends.",
    cadence: "Weekdays",
    weekdays: "1-5",
    time: "16:00",
  },
  {
    id: "poly-week-ahead",
    title: "Week ahead",
    summary: "What happened this week, what slipped and what next week holds.",
    bounds: "Reads your mail and calendar. Changes nothing.",
    cadence: "Fridays",
    weekdays: "5",
    time: "16:30",
  },
] as const;

export type PolyRoutineTemplate = (typeof POLY_ROUTINE_TEMPLATES)[number];
export type PolyRoutineTemplateId = PolyRoutineTemplate["id"];

const POLY_ROUTINE_TEMPLATE_IDS = POLY_ROUTINE_TEMPLATES.map((template) => template.id);

export const polyRoutineTemplateIdSchema = z.custom<PolyRoutineTemplateId>(
  (value) => typeof value === "string" && isPolyRoutineTemplateId(value),
  "Choose one of Poly's routines",
);

export function isPolyRoutineTemplateId(id: string): id is PolyRoutineTemplateId {
  return POLY_ROUTINE_TEMPLATE_IDS.some((templateId) => templateId === id);
}

export function polyRoutineCron(template: PolyRoutineTemplate, time: string = template.time) {
  const [hours, minutes] = time.split(":").map(Number);

  return `${minutes} ${hours} * * ${template.weekdays}`;
}

export const polyRoutineSchema = z.object({
  id: polyRoutineTemplateIdSchema,
  title: z.string(),
  summary: z.string(),
  bounds: z.string(),
  cadence: z.string(),
  time: z.string(),
  timezone: z.string().nullable(),
  installation_id: z.string().nullable(),
  sms_target: z.string().nullable(),
});

export const polyRoutineBriefSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  needs_you: z.boolean(),
  conversation_id: z.string().nullable(),
  created_at: z.string(),
});

export const polyRoutinesSchema = z.object({
  routines: z.array(polyRoutineSchema),
  briefs: z.array(polyRoutineBriefSchema),
  approval_channels: z.array(z.string()),
});

export const setupPolyRoutineSchema = z.object({
  template_id: polyRoutineTemplateIdSchema,
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "Use a 24-hour time such as 07:30")
    .optional(),
  timezone: z.string().trim().min(1).max(120).optional(),
  sms_target: recipeInstallationTriggerSchema.shape.notificationTarget.optional(),
});

export const polyRoutineSetupSchema = z.object({
  routine: polyRoutineSchema,
  ready: z.boolean(),
  missing_connections: z.array(z.string()),
});

export const polyRoutineParamsSchema = z.object({ template_id: polyRoutineTemplateIdSchema });

export type PolyRoutine = z.infer<typeof polyRoutineSchema>;
export type PolyRoutineBrief = z.infer<typeof polyRoutineBriefSchema>;
export type PolyRoutines = z.infer<typeof polyRoutinesSchema>;
export type SetupPolyRoutine = z.infer<typeof setupPolyRoutineSchema>;
export type PolyRoutineSetup = z.infer<typeof polyRoutineSetupSchema>;
