import {
  createMemoryImportSchema,
  memoryImportResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import { startMemoryImport } from "~/modules/memory-documents/application/import";

const app = new Hono();

defineResource(app, { idParam: "import_id", tags: ["memory"] }, (imports) => {
  imports.create({
    auth: true,
    summary: "Import memory from another assistant",
    description:
      "Takes your messages from a ChatGPT or Claude export, or a summary another assistant wrote about you, and files lasting memories with the quotes they came from in the background.",
    bodySchema: createMemoryImportSchema,
    responses: { 200: { description: "The queued import", schema: memoryImportResponseSchema } },
    handler: ({ serviceContext, body }) => startMemoryImport(serviceContext, body),
  });
});

export default app;
