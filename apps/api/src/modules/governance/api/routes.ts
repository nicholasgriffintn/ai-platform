import { governanceReportSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";

import { readGovernanceReport } from "../application/report";

const app = new Hono();
const reportParamsSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month such as 2026-10"),
});

defineResource(app, { path: "/reports", idParam: "period", tags: ["governance"] }, (reports) => {
  reports.read({
    auth: true,
    summary: "Read a monthly governance report",
    description:
      "What ran on your behalf in a month: runs by who started them, connector approvals and how they were decided, standing approvals in force and teammate spend against caps.",
    paramSchema: reportParamsSchema,
    responses: { 200: { description: "Governance report", schema: governanceReportSchema } },
    handler: ({ serviceContext, params }) => readGovernanceReport(serviceContext, params.period),
    cache: "no-store",
  });
});

export default app;
