import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  ACCOUNT_EXPORT_NEXT_HEADER,
  NO_STORE,
  SITE_OUTPUT_KIND,
} from "@ngriffin_uk/polychat-schemas";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { encodeJsonArray, parseJsonColumn } from "@ngriffin_uk/polychat-utility-server/json";
import {
  redactSensitiveUrl,
  removeCredentials,
} from "@ngriffin_uk/polychat-utility-server/redaction";
import { toStringValue } from "@ngriffin_uk/polychat-utility-server/strings";
import {
  createZipStream,
  toArchiveName,
  type ZipStreamWriter,
} from "@ngriffin_uk/polychat-utility-server/zip";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { ACCOUNT_EXPORT_LEFT_OUT } from "~/modules/account/domain/export-coverage";
import {
  ACCOUNT_EXPORT_FILE_SECTIONS,
  ACCOUNT_EXPORT_MESSAGE_CONVERSATIONS,
  ACCOUNT_EXPORT_PAGE_SIZE,
  AccountExportRepository,
  type AccountExportFileSection,
  type AccountExportRow,
  type AccountExportSection,
} from "~/modules/account/infrastructure/AccountExportRepository";
import { listSiteCollectionIds } from "~/modules/sites/application/records";
import { readSiteRecordsCreatedBy } from "~/modules/sites/application/runtime";
import type { User } from "~/types";

const logger = getLogger({ prefix: "modules/account/export" });

const EXPORT_SCHEMA_VERSION = 1;
const MAX_PART_FILES = 800;
const MAX_PART_FILE_BYTES = 1024 ** 3;
const UNKNOWN_FILE_SIZE_ESTIMATE = 16 * 1024 ** 2;
const MAX_ZIP_BYTES = 4 * 1024 ** 3 - 1;

const SECTIONS: readonly AccountExportSection[] = [
  "conversations",
  "memory",
  "memory_syntheses",
  "sources",
  "outputs",
  "skills",
  "revisions",
  "collections",
  "comments",
  "tasks",
  "goals",
  "corrections",
  "teammates",
  "templates",
  "recipe_triggers",
  "routine_outcomes",
  "saved_items",
  "feedback",
  "output_reviews",
  "approvals",
  "message_approvals",
  "training_examples",
  "benchmark_runs",
  "benchmark_votes",
  "pets",
];

type ExportedSection = AccountExportSection | "messages";

const JSON_COLUMNS: Partial<Record<ExportedSection, readonly string[]>> = {
  messages: ["citations", "parts", "tool_calls", "tool_call_arguments"],
  memory: ["metadata"],
  revisions: ["content"],
  collections: ["guide"],
  tasks: ["acceptance_criteria", "assumptions", "kill_conditions", "retrospective", "constraints"],
  goals: ["progress"],
  teammates: ["few_shot_examples", "enabled_tools", "skill_ids"],
  templates: ["tags", "configuration"],
  recipe_triggers: ["configuration"],
  benchmark_runs: ["metrics"],
};

const CREDENTIAL_SCRUBBED_COLUMNS: Partial<Record<ExportedSection, readonly string[]>> = {
  messages: ["parts", "tool_calls", "tool_call_arguments"],
  templates: ["configuration"],
  recipe_triggers: ["configuration"],
};

type OmissionReason = "missing" | "too_large";

interface ExportFile {
  section: AccountExportFileSection;
  resourceId: string;
  storageKey: string;
  path: string;
}

interface OmittedFile {
  section: string;
  resource_id: string;
  reason: OmissionReason;
}

interface FileBatch {
  files: ExportFile[];
  nextAfter: string | null;
}

interface FileCursor {
  section: AccountExportFileSection;
  id: string;
}

interface SiteReference {
  id: string;
  revision: number;
  collectionIds: string[];
}

async function* readPages<Row extends { id?: unknown }>(
  load: (after: string) => Promise<Row[]>,
  start = "",
): AsyncGenerator<Row[]> {
  let after = start;

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

function prepareRow(section: ExportedSection, row: AccountExportRow): AccountExportRow {
  const jsonColumns = JSON_COLUMNS[section] ?? [];
  const scrubbedColumns = CREDENTIAL_SCRUBBED_COLUMNS[section] ?? [];
  const prepared = Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const parsed = jsonColumns.includes(key) ? parseJsonColumn<unknown>(value, null) : value;

      return [key, scrubbedColumns.includes(key) ? removeCredentials(parsed) : parsed];
    }),
  );

  if (typeof prepared.external_uri === "string") {
    prepared.external_uri = redactSensitiveUrl(prepared.external_uri);
  }

  if (section === "messages" && prepared.role === "tool") {
    prepared.content = removeCredentials(prepared.content);
  }

  return prepared;
}

function parseFileCursor(after: string): FileCursor {
  const separator = after.indexOf(":");
  const section = ACCOUNT_EXPORT_FILE_SECTIONS.find(
    (candidate) => candidate === after.slice(0, separator),
  );

  if (!section) {
    throw new AssistantError("Invalid export cursor", ErrorType.PARAMS_ERROR, 400);
  }

  return { section, id: after.slice(separator + 1) };
}

async function selectFileBatch(
  repository: AccountExportRepository,
  userId: number,
  after: FileCursor | null,
): Promise<FileBatch> {
  const files: ExportFile[] = [];
  const firstSection = after ? ACCOUNT_EXPORT_FILE_SECTIONS.indexOf(after.section) : 0;
  let bytes = 0;
  let last: string | null = null;

  for (const section of ACCOUNT_EXPORT_FILE_SECTIONS.slice(firstSection)) {
    const start = after?.section === section ? after.id : "";

    for await (const page of readPages(
      (cursor) => repository.listFiles(section, userId, cursor),
      start,
    )) {
      for (const row of page) {
        const size = row.byte_size ?? UNKNOWN_FILE_SIZE_ESTIMATE;

        if (
          files.length >= MAX_PART_FILES ||
          (files.length > 0 && bytes + size > MAX_PART_FILE_BYTES)
        ) {
          return { files, nextAfter: last };
        }

        files.push({
          section,
          resourceId: row.id,
          storageKey: row.storage_key,
          path: `files/${section}/${toArchiveName(row.id)}/${toArchiveName(row.name)}`,
        });
        bytes += size;
        last = `${section}:${row.id}`;
      }
    }
  }

  return { files, nextAfter: null };
}

async function addFiles(
  zip: ZipStreamWriter,
  storage: StorageService,
  files: readonly ExportFile[],
): Promise<{ included: number; omitted: OmittedFile[] }> {
  const omitted: OmittedFile[] = [];
  const omit = (file: ExportFile, reason: OmissionReason) =>
    omitted.push({ section: file.section, resource_id: file.resourceId, reason });
  let included = 0;
  let totalBytes = 0;

  for (const file of files) {
    const object = await storage.getObjectBody(file.storageKey);

    if (!object) {
      omit(file, "missing");
      continue;
    }

    if (object.size >= MAX_ZIP_BYTES) {
      await object.body.cancel();
      omit(file, "too_large");
      continue;
    }

    totalBytes += object.size;

    if (totalBytes >= MAX_ZIP_BYTES) {
      await object.body.cancel();
      throw new AssistantError("Export part exceeds the archive size limit");
    }

    await zip.addEntry(file.path, object.body);
    included += 1;
  }

  return { included, omitted };
}

async function* readSiteRecords(
  context: ServiceContext,
  user: User,
  sites: readonly SiteReference[],
  unavailable: string[],
) {
  for (const site of sites) {
    try {
      const collections = await readSiteRecordsCreatedBy(context.env, site, user.id);

      yield collections.map((collection) => ({ site_id: site.id, ...collection }));
    } catch (error) {
      logger.warn("Could not read app records for export", { error, siteId: site.id });
      unavailable.push(site.id);
    }
  }
}

async function writeData(context: ServiceContext, user: User, zip: ZipStreamWriter) {
  const repository = context.repositories.get(AccountExportRepository);
  const sections: Record<string, { file: string; count: number }> = {};
  const conversationIds: string[] = [];
  const sites: SiteReference[] = [];
  const unavailableSites: string[] = [];

  for (const section of SECTIONS) {
    const file = `data/${section}.json`;
    const summary = { file, count: 0 };

    sections[section] = summary;

    async function* rows() {
      for await (const page of readPages((after) =>
        repository.listSection(section, user.id, after),
      )) {
        summary.count += page.length;

        for (const row of page) {
          if (section === "conversations") {
            conversationIds.push(toStringValue(row.id, ""));
          }

          if (section === "outputs" && row.kind === SITE_OUTPUT_KIND) {
            sites.push({
              id: toStringValue(row.id, ""),
              revision: Number(row.revision),
              collectionIds: listSiteCollectionIds(row.content),
            });
          }
        }

        yield page.map((row) => prepareRow(section, row));
      }
    }

    await zip.addEntry(file, encodeJsonArray(rows()), { compress: true });
  }

  const messages = { file: "data/messages.json", count: 0 };

  sections.messages = messages;

  async function* messageRows() {
    for (const ids of chunkArray(conversationIds, ACCOUNT_EXPORT_MESSAGE_CONVERSATIONS)) {
      for await (const page of readPages((after) => repository.listMessages(ids, after))) {
        messages.count += page.length;
        yield page.map((row) => prepareRow("messages", row));
      }
    }
  }

  await zip.addEntry(messages.file, encodeJsonArray(messageRows()), { compress: true });

  const siteRecords = { file: "data/site_records.json", count: 0 };

  sections.site_records = siteRecords;

  async function* siteRecordPages() {
    for await (const page of readSiteRecords(context, user, sites, unavailableSites)) {
      siteRecords.count += page.reduce((total, { records }) => total + records.length, 0);
      yield page;
    }
  }

  await zip.addEntry(siteRecords.file, encodeJsonArray(siteRecordPages()), { compress: true });

  return { sections, unavailableSites };
}

async function writeManifest(zip: ZipStreamWriter, manifest: Record<string, unknown>) {
  const content = {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    ...manifest,
  };

  await zip.addEntry("manifest.json", [new TextEncoder().encode(JSON.stringify(content, null, 2))]);
}

function toExportResponse(
  stream: ReadableStream<Uint8Array>,
  nextAfter: string | null,
  name: string,
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="polychat-export-${name}${timestamp}.zip"`,
      "Cache-Control": NO_STORE,
      ...(nextAfter ? { [ACCOUNT_EXPORT_NEXT_HEADER]: nextAfter } : {}),
    },
  });
}

function trackExport(context: ServiceContext, user: User, done: Promise<void>) {
  context.waitUntil(
    done.catch((error: unknown) => {
      logger.error("Account export failed", { error, userId: user.id });
    }),
  );
}

export async function exportAccountData(context: ServiceContext, user: User): Promise<Response> {
  const repository = context.repositories.get(AccountExportRepository);
  const batch = await selectFileBatch(repository, user.id, null);
  const { stream, done } = createZipStream(async (zip) => {
    const { sections, unavailableSites } = await writeData(context, user, zip);
    const files = await addFiles(zip, StorageService.forPrivateAssets(context), batch.files);

    await writeManifest(zip, {
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        company: user.company,
        site: user.site,
        location: user.location,
        bio: user.bio,
        github_username: user.github_username,
        twitter_username: user.twitter_username,
        created_at: user.created_at,
      },
      sections,
      files: { ...files, next_after: batch.nextAfter },
      unavailable_apps: unavailableSites,
      left_out: ACCOUNT_EXPORT_LEFT_OUT.map(({ data, reason }) => ({ data, reason })),
    });
  });

  trackExport(context, user, done);

  return toExportResponse(stream, batch.nextAfter, "");
}

export async function exportAccountFiles(
  context: ServiceContext,
  user: User,
  after: string,
): Promise<Response> {
  const repository = context.repositories.get(AccountExportRepository);
  const batch = await selectFileBatch(repository, user.id, parseFileCursor(after));
  const { stream, done } = createZipStream(async (zip) => {
    const files = await addFiles(zip, StorageService.forPrivateAssets(context), batch.files);

    await writeManifest(zip, { files: { ...files, next_after: batch.nextAfter } });
  });

  trackExport(context, user, done);

  return toExportResponse(stream, batch.nextAfter, "files-");
}
