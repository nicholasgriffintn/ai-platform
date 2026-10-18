import {
  generatedPetImageSchema,
  generatedPetPosesSchema,
  generatePetPosesSchema,
  importPetSchema,
  generateUserPetSchema,
  userPetSchema,
  userPetsQuerySchema,
  userPetsResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import * as z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import {
  createPet,
  deletePet,
  generatePetImage,
  generatePetPoses,
  getPet,
  importPet,
  listPets,
  readPetSheet,
} from "~/modules/pets/application/pets";

const app = new Hono();
const petParamsSchema = z.object({ pet_id: z.string().min(1) });
const SHEET_CACHE_CONTROL = "private, max-age=3600, stale-while-revalidate=86400";

defineResource(app, { idParam: "pet_id", tags: ["pets"] }, (pets) => {
  pets
    .list({
      auth: true,
      summary: "List pets",
      description: "The pets the user has uploaded or generated, newest first.",
      querySchema: userPetsQuerySchema,
      responses: { 200: { description: "Pets", schema: userPetsResponseSchema } },
      handler: ({ query, serviceContext }) => listPets(serviceContext, query),
    })
    .create({
      auth: true,
      summary: "Create a pet",
      description:
        "Stores an uploaded or generated sprite sheet as a pet. Send multipart form data.",
      responses: { 201: { description: "The pet", schema: userPetSchema } },
      handler: async ({ raw, serviceContext }) => {
        let formData: FormData;

        try {
          formData = await raw.req.formData();
        } catch {
          throw new AssistantError("Failed to parse pet upload", ErrorType.PARAMS_ERROR, 400);
        }

        return ResponseFactory.success(raw, await createPet(serviceContext, formData), 201);
      },
    })
    .collectionAction("generate", {
      auth: true,
      summary: "Generate a pet image",
      description: "Generates a mascot image from a description, ready to compose into a sheet.",
      bodySchema: generateUserPetSchema,
      responses: {
        200: { description: "The generated image and its seed", schema: generatedPetImageSchema },
      },
      handler: ({ body, serviceContext }) => generatePetImage(serviceContext, body.prompt),
    })
    .collectionAction("import", {
      auth: true,
      summary: "Import a pet from a pet.json address",
      description:
        "Fetches a Codex or Polychat pet.json manifest and the sprite sheet beside it from a public address and keeps them as your pet.",
      bodySchema: importPetSchema,
      responses: { 201: { description: "The pet", schema: userPetSchema } },
      handler: async ({ body, raw, serviceContext }) =>
        ResponseFactory.success(raw, await importPet(serviceContext, body), 201),
    })
    .collectionAction("poses", {
      auth: true,
      summary: "Draw a generated pet in each pose",
      description:
        "Redraws a generated pet in the greet, think, work, speak, cheer, fret and doze poses with the same seed, so each row of its sheet shows a real expression. Poses that fail are left out.",
      bodySchema: generatePetPosesSchema,
      responses: { 200: { description: "Pose images by clip", schema: generatedPetPosesSchema } },
      handler: ({ body, serviceContext }) => generatePetPoses(serviceContext, body),
    })
    .read({
      auth: true,
      summary: "Read a pet",
      paramSchema: petParamsSchema,
      responses: { 200: { description: "The pet", schema: userPetSchema } },
      handler: ({ params, serviceContext }) => getPet(serviceContext, params.pet_id),
    })
    .delete({
      auth: true,
      summary: "Delete a pet",
      description: "Deletes the pet and its sprite sheet.",
      paramSchema: petParamsSchema,
      handler: async ({ params, serviceContext }) => {
        await deletePet(serviceContext, params.pet_id);

        return { deleted: true };
      },
    });

  pets.singleton("sheet").read({
    auth: true,
    summary: "Read a pet's sprite sheet",
    paramSchema: petParamsSchema,
    responses: { 200: { description: "The sprite sheet image" } },
    handler: async ({ params, raw, serviceContext }) => {
      const { data, contentType, etag } = await readPetSheet(serviceContext, params.pet_id);

      if (raw.req.header("If-None-Match") === etag) {
        return raw.newResponse(null, 304, { ETag: etag, "Cache-Control": SHEET_CACHE_CONTROL });
      }

      return raw.newResponse(data, 200, {
        "Content-Type": contentType,
        "Cache-Control": SHEET_CACHE_CONTROL,
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
      });
    },
  });
});

export default app;
