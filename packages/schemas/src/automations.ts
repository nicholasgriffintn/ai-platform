import z from "zod/v4";

export const AUTOMATION_CREATE_TOOL_NAME = "create_automation";

const CRON_PATTERN = /^[\d*/, -]+ [\d*/, -]+ [\d*/, -]+ [\d*/, -]+ [\d*/, -]+$/;

export const createAutomationInputSchema = z.object({
  recipeId: z
    .string()
    .min(1)
    .describe("Which saved recipe runs. Use discover_capabilities first if you do not know it."),
  cronExpression: z
    .string()
    .trim()
    .regex(CRON_PATTERN, "A schedule is five cron fields, in UTC")
    .describe("When it runs, as five cron fields in UTC. 0 9 * * 1-5 is weekdays at nine."),
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .describe("What it should do each time it runs, written as an instruction to the runner."),
  notificationChannel: z
    .enum(["sms", "slack", "telegram"])
    .optional()
    .describe("Where the result should be sent, if anywhere."),
  notificationTarget: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe("The address or channel the result goes to."),
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe("Project this automation belongs to. Omit for a personal automation."),
});

export type CreateAutomationInput = z.infer<typeof createAutomationInputSchema>;

const CRON_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Says a five-field cron back in words, so a person can check the schedule they asked for is
 * the schedule that was saved.
 */
export function describeCronExpression(expression: string): string {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.trim().split(/\s+/u);

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return expression;
  }

  const time =
    minute.includes("*") || hour.includes("*")
      ? null
      : `${hour.padStart(2, "0")}:${minute.padStart(2, "0")} UTC`;

  if (dayOfWeek === "1-5") {
    return time ? `every weekday at ${time}` : "every weekday";
  }

  if (dayOfWeek !== "*") {
    const named = dayOfWeek
      .split(",")
      .map((day) => CRON_DAYS[Number(day) % 7] ?? day)
      .join(", ");

    return time ? `every ${named} at ${time}` : `every ${named}`;
  }

  if (dayOfMonth !== "*") {
    return time ? `on day ${dayOfMonth} of each month at ${time}` : `on day ${dayOfMonth} monthly`;
  }

  return time ? `every day at ${time}` : `on the schedule ${expression}`;
}
