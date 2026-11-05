import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { encodeJsonArray, parseJsonColumn } from "@ngriffin_uk/polychat-utility-server/json";
import { redactSensitiveUrl } from "@ngriffin_uk/polychat-utility-server/redaction";
import { toStringValue } from "@ngriffin_uk/polychat-utility-server/strings";
import {
  createZipStream,
  toArchiveName,
  type ZipStreamWriter,
} from "@ngriffin_uk/polychat-utility-server/zip";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import {
  ACCOUNT_EXPORT_MESSAGE_CONVERSATIONS,
  ACCOUNT_EXPORT_PAGE_SIZE,
  AccountExportRepository,
  type AccountExportRow,
  type AccountExportSection,
} from "~/modules/account/infrastructure/AccountExportRepository";
import type { User } from "~/types";

const logger = getLogger({ prefix: "modules/account/export" });

const EXPORT_SCHEMA_VERSION = 1;
const MAX_EXPORT_FILES = 800;
const MAX_EXPORT_FILE_BYTES = 3 * 1024 ** 3;

const SECTIONS: readonly AccountExportSection[] = [
  "conversations",
  "memory",
  "memory_syntheses",
  "sources",
  "outputs",
  "skills",
  "collections",
  "comments",
  "goals",
  "corrections",
  "teammates",
  "templates",
];

const JSON_COLUMNS: Partial<Record<AccountExportSection | "messages", readonly string[]>> = {
  messages: ["citations"],
  memory: ["metadata"],
  collections: ["guide"],
  goals: ["progress"],
  teammates: ["few_shot_examples", "enabled_tools", "skill_ids"],
  templates: ["tags"],
};

const FILE_SECTIONS: Partial<Record<AccountExportSection, string>> = {
  sources: "sources",
  outputs: "outputs",
  skills: "skills",
};

const NOT_INCLUDED = [
  "Passwords, API keys, provider keys and connection tokens",
  "MCP server settings on teammates, and template configuration, which can hold credentials",
  "Work other people created, and projects you no longer belong to",
  "Earlier revisions, tool call traces and usage records",
  "Project tasks, recipes and site data",
];

type FileOmissionReason = "missing" | "file_limit" | "size_limit";

interface ExportFile {
  section: string;
  resourceId: string;
  storageKey: string;
  path: string;
}

interface OmittedFile {
  section: string;
  resource_id: string;
  reason: FileOmissionReason;
}

async function* readPages(
  load: (after: string) => Promise<AccountExportRow[]>,
): AsyncGenerator<AccountExportRow[]> {
  let after = "";

  while (true) {
    const rows = await load(after);

    if (rows.length > 0) {
      yield rows;
    }

    if (rows.length < ACCOUNT_EXPORT_PAGE_SIZE) {
      return;
    }

    after = toStringValue(rows[rows.length - 1].id, "");
  }
}

function parseJsonColumns(
  section: AccountExportSection | "messages",
  row: AccountExportRow,
): AccountExportRow {
  const columns = JSON_COLUMNS[section] ?? [];

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      columns.includes(key) ? parseJsonColumn<unknown>(value, null) : value,
    ]),
  );
}

function toFile(
  section: AccountExportSection,
  folder: string,
  row: AccountExportRow,
): ExportFile | null {
  const storageKey = toStringValue(row.storage_key, "");

  if (!storageKey) {
    return null;
  }

  const resourceId = toStringValue(row.id, "");
  const name = toStringValue(row.filename, "") || toStringValue(row.title ?? row.name, "");

  return {
    section,
    resourceId,
    storageKey,
    path: `files/${folder}/${toArchiveName(resourceId)}/${toArchiveName(name)}`,
  };
}

function prepareRow(section: AccountExportSection, row: AccountExportRow): AccountExportRow {
  const { storage_key: _storageKey, ...exported } = parseJsonColumns(section, row);

  if (typeof exported.external_uri === "string") {
    exported.external_uri = redactSensitiveUrl(exported.external_uri);
  }

  return exported;
}

async function addFiles(
  zip: ZipStreamWriter,
  storage: StorageService,
  files: readonly ExportFile[],
): Promise<{ included: number; omitted: OmittedFile[] }> {
  const omitted: OmittedFile[] = [];
  const omit = (file: ExportFile, reason: FileOmissionReason) =>
    omitted.push({ section: file.section, resource_id: file.resourceId, reason });
  let included = 0;
  let totalBytes = 0;

  for (const file of files) {
    if (included >= MAX_EXPORT_FILES) {
      omit(file, "file_limit");
      continue;
    }

    const object = await storage.getObjectBody(file.storageKey);

    if (!object) {
      omit(file, "missing");
      continue;
    }

    if (totalBytes + object.size > MAX_EXPORT_FILE_BYTES) {
      await object.body.cancel();
      omit(file, "size_limit");
      continue;
    }

    await zip.addEntry(file.path, object.body);
    totalBytes += object.size;
    included += 1;
  }

  return { included, omitted };
}

async function writeExport(context: ServiceContext, user: User, zip: ZipStreamWriter) {
  const repository = context.repositories.get(AccountExportRepository);
  const counts: Record<string, number> = {};
  const conversationIds: string[] = [];
  const files: ExportFile[] = [];

  for (const section of SECTIONS) {
    const folder = FILE_SECTIONS[section];

    counts[section] = 0;

    async function* rows() {
      for await (const page of readPages((after) =>
        repository.listSection(section, user.id, after),
      )) {
        counts[section] += page.length;

        for (const row of page) {
          const file = folder ? toFile(section, folder, row) : null;

          if (file) {
            files.push(file);
          }

          if (section === "conversations") {
            conversationIds.push(toStringValue(row.id, ""));
          }
        }

        yield page.map((row) => prepareRow(section, row));
      }
    }

    await zip.addEntry(`data/${section}.json`, encodeJsonArray(rows()), { compress: true });
  }

  counts.messages = 0;

  async function* messages() {
    for (const ids of chunkArray(conversationIds, ACCOUNT_EXPORT_MESSAGE_CONVERSATIONS)) {
      for await (const page of readPages((after) => repository.listMessages(ids, after))) {
        counts.messages += page.length;
        yield page.map((row) => parseJsonColumns("messages", row));
      }
    }
  }

  await zip.addEntry("data/messages.json", encodeJsonArray(messages()), { compress: true });

  const { included, omitted } = await addFiles(
    zip,
    StorageService.forPrivateAssets(context),
    files,
  );

  const manifest = {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    account: { id: user.id, name: user.name, email: user.email },
    counts,
    files: { included, omitted },
    not_included: NOT_INCLUDED,
  };

  await zip.addEntry("manifest.json", [
    new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  ]);
}

export function streamAccountExport(context: ServiceContext, user: User) {
  const { stream, done } = createZipStream((zip) => writeExport(context, user, zip));

  context.waitUntil(
    done.catch((error: unknown) => {
      logger.error("Account export failed", { error, userId: user.id });
    }),
  );

  return stream;
}
