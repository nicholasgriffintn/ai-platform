import {
  errorResponseSchema,
  generateUserPetSchema,
  successResponseSchema,
  userPetResponseSchema,
  userPetsResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import * as z from "zod/v4";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { createPet, deletePet, generatePetImage, listPets, readPetSheet } from "~/services/pets";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const petParamsSchema = z.object({
  petId: z.string().min(1),
});

addRoute(app, "get", "/", {
  tags: ["user"],
  summary: "List pets",
  description: "List the pets the user has uploaded or generated",
  auth: true,
  responses: {
    200: {
      description: "Pets fetched successfully",
      schema: userPetsResponseSchema,
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ serviceContext }) => {
    const pets = await listPets(serviceContext);

    return { pets };
  },
});

addRoute(app, "post", "/", {
  tags: ["user"],
  summary: "Create a pet",
  description: "Store an uploaded or generated sprite sheet as a pet",
  auth: true,
  responses: {
    201: {
      description: "Pet created successfully",
      schema: userPetResponseSchema,
    },
    400: {
      description: "Bad request or invalid sheet",
      schema: errorResponseSchema,
    },
    403: {
      description: "A Pro plan is required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw, serviceContext }) => {
    let formData: FormData;

    try {
      formData = await raw.req.formData();
    } catch {
      throw new AssistantError("Failed to parse pet upload", ErrorType.PARAMS_ERROR, 400);
    }

    const pet = await createPet(serviceContext, formData);

    return ResponseFactory.success(raw, { pet }, 201);
  },
});

addRoute(app, "post", "/generate", {
  tags: ["user"],
  summary: "Generate a pet image",
  description: "Generate a mascot image from a description, ready to be composed into a sheet",
  auth: true,
  bodySchema: generateUserPetSchema,
  responses: {
    200: {
      description: "Pet image generated successfully",
      schema: z.object({ image: z.string() }),
    },
    403: {
      description: "A Pro plan is required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ body, serviceContext }) => generatePetImage(serviceContext, body.prompt),
});

addRoute(app, "get", "/:petId/sheet", {
  tags: ["user"],
  summary: "Read a pet sheet",
  description: "Stream the sprite sheet for one of the user's pets",
  auth: true,
  paramSchema: petParamsSchema,
  responses: {
    200: {
      description: "Sheet streamed successfully",
      schema: successResponseSchema,
    },
    404: {
      description: "Pet not found",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ params, raw, serviceContext }) => {
    const { data, contentType } = await readPetSheet(serviceContext, params.petId);

    return raw.newResponse(data, 200, {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
  },
});

addRoute(app, "delete", "/:petId", {
  tags: ["user"],
  summary: "Delete a pet",
  description: "Delete one of the user's pets and its sprite sheet",
  auth: true,
  paramSchema: petParamsSchema,
  responses: {
    200: {
      description: "Pet deleted successfully",
      schema: successResponseSchema,
    },
    404: {
      description: "Pet not found",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ params, serviceContext }) => {
    await deletePet(serviceContext, params.petId);

    return { message: "Pet deleted successfully" };
  },
});

export default app;
