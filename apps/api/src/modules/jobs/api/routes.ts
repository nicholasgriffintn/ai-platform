import {
  createJobRequestSchema,
  errorResponseSchema,
  jobListSchema,
  jobParamsSchema,
  jobSchema,
  listJobsQuerySchema,
  readJobQuerySchema,
  startedJobListSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";

import { cancelJob, listJobs, readJob, startJobs } from "../application/jobs";

const app = new Hono();

defineResource(app, { idParam: "job_id", tags: ["jobs"] }, (jobs) => {
  jobs
    .list({
      auth: true,
      summary: "List jobs",
      description:
        "Lists generations, predictions, OCR batches, research runs and evaluations, newest first. Filter by kind, project or the provider's external ID.",
      querySchema: listJobsQuerySchema,
      responses: { 200: { description: "A page of jobs", schema: jobListSchema } },
      handler: ({ serviceContext, user, query }) => listJobs(serviceContext, user, query),
    })
    .create({
      auth: true,
      summary: "Start a job",
      description:
        "Starts long-running work of the given kind. The response lists every job started and any that were rejected.",
      bodySchema: createJobRequestSchema,
      responses: {
        200: { description: "The jobs started", schema: startedJobListSchema },
        400: { description: "Nothing could be started", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, user, body }) => startJobs(serviceContext, user, body),
    })
    .read({
      auth: true,
      summary: "Get a job",
      description: "Returns the job's status and result. Research jobs refresh from the provider.",
      paramSchema: jobParamsSchema,
      querySchema: readJobQuerySchema,
      responses: {
        200: { description: "The job", schema: jobSchema },
        404: { description: "Job not found", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, user, params, query }) =>
        readJob(serviceContext, user, params.job_id, query),
    })
    .action("cancel", {
      auth: true,
      summary: "Cancel a job",
      paramSchema: jobParamsSchema,
      querySchema: readJobQuerySchema,
      responses: {
        200: { description: "The job after cancellation was requested", schema: jobSchema },
        409: {
          description: "The job finished or cannot be cancelled",
          schema: errorResponseSchema,
        },
      },
      handler: ({ serviceContext, user, params, query }) =>
        cancelJob(serviceContext, user, params.job_id, query),
    });
});

export default app;
