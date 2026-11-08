import {
  getPashiClient,
  PashiClient,
  PashiClientError,
} from "@ngriffin_uk/polychat-ai-integrations";
import { fileExtensionForMimeType, generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { readPashiLinkToken } from "~/modules/pashi-link/application/link";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import {
  run_pashi_tools as run_pashi_toolsDescriptor,
  search_pashi_tools as search_pashi_toolsDescriptor,
} from "./definitions/pashi";
import { runPashiOperations, searchPashiCatalog, type PashiFileStore } from "./pashi-tool-adapter";

const MAX_PASHI_FILE_BYTES = 100 * 1024 * 1024;

async function resolvePashiClient(context: ApiToolExecutionContext): Promise<PashiClient> {
  const { env, request, user } = context;
  const token = user
    ? await readPashiLinkToken(
        resolveServiceContext({ context: request.context, env, user }),
        user.id,
      )
    : null;

  return token
    ? new PashiClient({ apiKey: token, origin: env.PASHI_URL, supportsFiles: true })
    : getPashiClient(env);
}

function createPashiFileStore(context: ApiToolExecutionContext): PashiFileStore | undefined {
  const { user } = context;

  if (!user) {
    return undefined;
  }

  const storage = () =>
    StorageService.forPrivateAssets(
      resolveServiceContext({ context: context.request.context, env: context.env, user }),
    );

  return {
    read: async (url) => {
      const blob = await storage()
        .getPrivateAssetBlob(url, user.id, undefined, { maxBytes: MAX_PASHI_FILE_BYTES })
        .catch((error: unknown) => {
          if (error instanceof AssistantError) {
            return null;
          }

          throw error;
        });

      if (!blob) {
        throw new PashiClientError(
          "invalid_input",
          "file_url must be a file from this chat, up to 100 MB.",
        );
      }

      const extension = fileExtensionForMimeType(blob.type);

      return { blob, name: extension ? `upload.${extension}` : "upload" };
    },
    save: async ({ blob, name }, toolId) => {
      const data = await blob.arrayBuffer();
      const stored = await storage().storeOutputFile({
        key: `pashi/${user.id}/${generateId()}/${name}`,
        data,
        createdByUserId: user.id,
        capabilityId: "pashi",
        kind: "conversion",
        title: `Pashi ${toolId}`,
        mimeType: blob.type || "application/octet-stream",
        filename: name,
        byteSize: data.byteLength,
      });

      return { outputId: stored.outputId, url: stored.url };
    },
  };
}

export function createPashiFunctionTools(client?: PashiClient): {
  run_pashi_tools: ApiToolDefinition;
  search_pashi_tools: ApiToolDefinition;
} {
  const search_pashi_tools: ApiToolDefinition = {
    ...search_pashi_toolsDescriptor,
    execute: async (args, context) =>
      searchPashiCatalog(client ?? (await resolvePashiClient(context)), args),
  };

  const run_pashi_tools: ApiToolDefinition = {
    ...run_pashi_toolsDescriptor,
    execute: async (args, context) =>
      runPashiOperations(
        client ?? (await resolvePashiClient(context)),
        args,
        createPashiFileStore(context),
      ),
  };

  return {
    run_pashi_tools,
    search_pashi_tools,
  };
}

export const { run_pashi_tools, search_pashi_tools } = createPashiFunctionTools();
