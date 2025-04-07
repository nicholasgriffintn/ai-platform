import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";

import { convertToMarkdownViaCloudflare } from "../lib/documentConverter";
import { StorageService } from "../lib/storage";
import { requireAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import type { IEnv } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import { errorResponseSchema } from "./schemas/shared";

const app = new Hono();
const routeLogger = createRouteLogger("UPLOADS");

// Require authentication for all routes
app.use("/*", requireAuth);

// Add route-specific logging
app.use("/*", (c, next) => {
  routeLogger.info(`Processing uploads route: ${c.req.path}`);
  return next();
});

const uploadResponseSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "document", "markdown_document"]),
  name: z.string().optional(),
  markdown: z.string().optional(),
});

app.post(
  "/",
  describeRoute({
    tags: ["uploads"],
    title: "Upload file",
    description: "Upload an image or document to the server",
    requestBody: {
      description: "Multipart form data containing file",
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.any().refine((file) => file && file instanceof File, {
              message: "File is required",
            }),
            file_type: z.enum(["image", "document"]),
          }),
        },
      },
    },
    responses: {
      200: {
        description: "File upload successful, returns the URL",
        content: {
          "application/json": {
            schema: resolver(uploadResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or invalid file",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error or storage failure",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    try {
      routeLogger.info("Starting file upload process");
      const env = context.env as IEnv;

      let formData;
      try {
        formData = await context.req.formData();
      } catch (formError) {
        routeLogger.error("Failed to parse form data", {
          error:
            formError instanceof Error ? formError.message : String(formError),
          stack: formError instanceof Error ? formError.stack : undefined,
        });
        throw new AssistantError(
          "Failed to parse upload data",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      const file = formData.get("file") as File | null;
      const fileType = formData.get("file_type") as "image" | "document" | null;

      routeLogger.info("File upload request", {
        fileExists: !!file,
        fileType,
        mimeType: file?.type,
        fileSize: file?.size,
      });

      const user = context.get("user");

      if (!user || !user.id) {
        throw new AssistantError(
          "Authentication required for file uploads",
          ErrorType.UNAUTHORIZED,
          401,
        );
      }

      if (!file) {
        throw new AssistantError(
          "No file uploaded",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      if (!fileType || !["image", "document"].includes(fileType)) {
        throw new AssistantError(
          "Invalid file type. Must be 'image' or 'document'",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      const allowedMimeTypes = {
        image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        document: [
          "application/pdf",
          "text/html",
          "application/xml",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel.sheet.macroenabled.12",
          "application/vnd.ms-excel.sheet.binary.macroenabled.12",
          "application/vnd.ms-excel",
          "application/vnd.oasis.opendocument.spreadsheet",
          "text/csv",
          "application/vnd.apple.numbers",
        ],
      };

      // Check if the file type is allowed
      if (!allowedMimeTypes[fileType].includes(file.type)) {
        throw new AssistantError(
          `Invalid file type. Allowed types for ${fileType}: ${allowedMimeTypes[fileType].join(", ")}`,
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      // Convert to markdown if needed - only for non-PDF documents
      let shouldConvertToMarkdown = false;
      let markdownContent = "";

      // For documents other than PDFs, or if the model doesn't support native documents
      const fileTypeParam = formData.get("convert_to_markdown") as
        | string
        | null;
      const convertToMarkdown = fileTypeParam === "true";
      const isPdf = file.type === "application/pdf";

      // Always convert non-PDF documents to markdown
      // Only convert PDFs if explicitly requested
      if (fileType === "document" && (!isPdf || convertToMarkdown)) {
        shouldConvertToMarkdown = true;
      }

      // Continue with normal upload for all files
      const fileExtension = file.type.split("/")[1];
      const userId = user?.id || "anonymous";
      const userIdSanitized =
        typeof userId === "string"
          ? userId.replace(/[^a-zA-Z0-9-_]/g, "_")
          : userId;
      const key = `uploads/${userIdSanitized}/${fileType}s/${crypto.randomUUID()}.${fileExtension}`;

      let arrayBuffer;
      try {
        arrayBuffer = await file.arrayBuffer();
        routeLogger.info("File converted to arrayBuffer", {
          size: arrayBuffer.byteLength,
        });
      } catch (bufferError) {
        routeLogger.error("Failed to convert file to arrayBuffer", {
          error:
            bufferError instanceof Error
              ? bufferError.message
              : String(bufferError),
          stack: bufferError instanceof Error ? bufferError.stack : undefined,
        });
        throw new AssistantError(
          "Failed to process file data",
          ErrorType.UNKNOWN_ERROR,
          500,
        );
      }

      try {
        const storageService = new StorageService(env.ASSETS_BUCKET);
        await storageService.uploadObject(key, arrayBuffer, {
          contentType: file.type,
        });
        routeLogger.info("File uploaded successfully", { key });
      } catch (storageError) {
        routeLogger.error("Failed to upload file to storage", {
          error:
            storageError instanceof Error
              ? storageError.message
              : String(storageError),
          stack: storageError instanceof Error ? storageError.stack : undefined,
          key,
        });
        throw new AssistantError(
          "Failed to store file",
          ErrorType.EXTERNAL_API_ERROR,
          500,
        );
      }

      const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";
      if (!baseAssetsUrl) {
        routeLogger.warn("PUBLIC_ASSETS_URL is not set");
      }

      const fileUrl = `${baseAssetsUrl}/${key}`;

      if (shouldConvertToMarkdown) {
        try {
          const { result, error } = await convertToMarkdownViaCloudflare(
            env,
            fileUrl,
            file.name,
          );

          if (error) {
            routeLogger.error("Failed to convert document to markdown", {
              error,
            });
          } else if (result) {
            markdownContent = result;
            routeLogger.info("Document converted to markdown successfully");
          }
        } catch (markdownError) {
          routeLogger.error("Error in markdown conversion", {
            error:
              markdownError instanceof Error
                ? markdownError.message
                : String(markdownError),
            stack:
              markdownError instanceof Error ? markdownError.stack : undefined,
          });
        }
      }

      routeLogger.info("File upload complete", {
        url: fileUrl,
        type: markdownContent ? "markdown_document" : fileType,
        convertedToMarkdown: !!markdownContent,
      });

      return context.json({
        url: fileUrl,
        type: markdownContent ? "markdown_document" : fileType,
        name: file.name,
        markdown: markdownContent || undefined,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorType =
        error instanceof AssistantError ? error.type : "UNKNOWN";

      routeLogger.error("Error uploading file", {
        errorMessage,
        errorStack,
        errorType,
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        `Failed to upload file: ${errorMessage}`,
        ErrorType.UNKNOWN_ERROR,
        500,
      );
    }
  },
);

export default app;
