import z from "zod/v4";

export const INCIDENT_BRIEF_RECIPE_ID = "service-incident-brief";
export const incidentBriefConfigurationSchema = z
  .object({
    serviceName: z.string().trim().min(1).max(120),
    environment: z.string().trim().min(1).max(80),
    windowHours: z.number().int().min(1).max(168),
    pagerDutyServiceId: z.string().trim().max(200).optional(),
    sentryOrganisation: z.string().trim().max(200).optional(),
    sentryProject: z.string().trim().max(200).optional(),
    githubOwner: z
      .string()
      .regex(/^[A-Za-z0-9-]+$/)
      .max(100)
      .optional(),
    githubRepository: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+$/)
      .max(100)
      .optional(),
  })
  .refine((value) => Boolean(value.sentryOrganisation) === Boolean(value.sentryProject), {
    error: "Provide both the Sentry organisation and project",
  })
  .refine((value) => Boolean(value.githubOwner) === Boolean(value.githubRepository), {
    error: "Provide both the GitHub owner and repository",
  })
  .refine(
    (value) => Boolean(value.pagerDutyServiceId || value.sentryProject || value.githubRepository),
    { error: "Map at least one connected service" },
  );

export type IncidentBriefConfiguration = z.infer<typeof incidentBriefConfigurationSchema>;
