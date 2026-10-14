import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const jobsTagDescription = md`
# Jobs

Long-running work that outlives a request: generations, predictions, OCR batches, research runs and evaluations.

Start a job by kind, then read \`GET /jobs/{job_id}\` for its status and result. Some kinds fan out, so the create response lists every job started and any that were rejected.
`;
