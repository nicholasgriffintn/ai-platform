import { authorise } from "@ngriffin_uk/polychat-library-policy";
import { validateSiteCollectionValues } from "@ngriffin_uk/polychat-library-sites";
import {
  siteCollectionRecordSchema,
  siteCollectionSchema,
  siteDataActionSchema,
  siteDataIdentifierSchema,
  type SiteCollection,
  type SiteCollectionRecord,
  type SiteDataAction,
  type SiteRuntimeActor,
  siteRuntimeActorSchema,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

const definitionSchema = z
  .object({
    revision: z.number().int().positive(),
    enabled: z.boolean().default(true),
    collections: z.record(siteDataIdentifierSchema, siteCollectionSchema),
  })
  .strict();

export class SiteCollectionStore {
  constructor(private readonly sql: Pick<SqlStorage, "exec">) {
    sql.exec(
      "CREATE TABLE IF NOT EXISTS site_runtime (id INTEGER PRIMARY KEY CHECK (id = 1), definition TEXT NOT NULL)",
    );
    sql.exec(
      "CREATE TABLE IF NOT EXISTS site_records (collection_id TEXT NOT NULL, record_id TEXT NOT NULL, content TEXT NOT NULL, PRIMARY KEY (collection_id, record_id))",
    );
  }

  status() {
    const definition = this.definition();

    return {
      enabled: definition?.enabled ?? false,
      revision: definition?.enabled ? definition.revision : null,
    };
  }

  activate(revision: number, collections: Record<string, SiteCollection>) {
    const next = definitionSchema.parse({ revision, collections });
    const current = this.definition();

    if (current && current.revision > revision) {
      throw new AssistantError("A newer app revision is active", ErrorType.CONFLICT_ERROR, 409);
    }

    for (const [id, collection] of Object.entries(next.collections)) {
      const records = this.list(id);

      if (
        records.length > collection.maxRecords ||
        records.some((record) => validateSiteCollectionValues(collection, record.values))
      ) {
        throw new AssistantError(
          "Existing records are incompatible with the new collection schema",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }
    }

    this.sql.exec(
      "INSERT INTO site_runtime (id, definition) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET definition = excluded.definition",
      JSON.stringify(next),
    );

    return this.status();
  }

  read(revision: number, collectionId: string): SiteCollectionRecord[] {
    this.requireCollection(revision, collectionId);

    return this.list(collectionId);
  }

  operate(revision: number, input: SiteDataAction, inputActor: SiteRuntimeActor): void {
    const action = siteDataActionSchema.parse(input);
    const actor = siteRuntimeActorSchema.parse(inputActor);

    if (action.action === "refreshData") {
      return;
    }

    const collection = this.requireCollection(revision, action.collectionId);

    if (action.action === "createRecord") {
      const records = this.list(action.collectionId);
      const count =
        [...this.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM site_records")][0]
          ?.count ?? 0;

      if (records.length >= collection.maxRecords || count >= 5000) {
        throw new AssistantError(
          "The app's record limit has been reached",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      this.requireValues(collection, action.values);
      const now = new Date().toISOString();
      const record = {
        id: generateId(),
        revision: 1,
        values: action.values,
        createdAt: now,
        updatedAt: now,
        createdByUserId: actor.userId,
      };

      this.sql.exec(
        "INSERT INTO site_records (collection_id, record_id, content) VALUES (?, ?, ?)",
        action.collectionId,
        record.id,
        JSON.stringify(record),
      );

      return;
    }

    const row = [
      ...this.sql.exec<{ content: string }>(
        "SELECT content FROM site_records WHERE collection_id = ? AND record_id = ?",
        action.collectionId,
        action.recordId,
      ),
    ][0];
    const record = row ? siteCollectionRecordSchema.parse(safeParseJson(row.content)) : null;

    if (!record || record.revision !== action.expectedRecordRevision) {
      throw new AssistantError("The record changed or was deleted", ErrorType.CONFLICT_ERROR, 409);
    }

    if (
      !authorise("resource.write", {
        actorId: String(actor.userId),
        ownerId: String(record.createdByUserId),
        scope: actor.scope,
        member: true,
        role: actor.role,
      }).allowed
    ) {
      throw new AssistantError(
        "Only the record creator or a project admin can change it",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    if (action.action === "deleteRecord") {
      this.sql.exec(
        "DELETE FROM site_records WHERE collection_id = ? AND record_id = ?",
        action.collectionId,
        action.recordId,
      );

      return;
    }

    const values = { ...record.values, ...action.values };

    this.requireValues(collection, values);
    this.sql.exec(
      "UPDATE site_records SET content = ? WHERE collection_id = ? AND record_id = ?",
      JSON.stringify({
        ...record,
        values,
        revision: record.revision + 1,
        updatedAt: new Date().toISOString(),
      }),
      action.collectionId,
      action.recordId,
    );
  }

  disable(revision: number): void {
    const definition = this.definition();

    if (definition && definition.revision > revision) {
      throw new AssistantError("A newer app revision is active", ErrorType.CONFLICT_ERROR, 409);
    }

    this.sql.exec(
      "INSERT INTO site_runtime (id, definition) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET definition = excluded.definition",
      JSON.stringify({ revision, enabled: false, collections: definition?.collections ?? {} }),
    );
  }

  deleteData(): void {
    this.sql.exec("DELETE FROM site_records");
    this.sql.exec("DELETE FROM site_runtime");
  }

  private definition() {
    const row = [
      ...this.sql.exec<{ definition: string }>("SELECT definition FROM site_runtime WHERE id = 1"),
    ][0];

    return row ? definitionSchema.parse(safeParseJson(row.definition)) : null;
  }

  private requireCollection(revision: number, collectionId: string): SiteCollection {
    const definition = this.definition();
    const collection = definition?.collections[collectionId];

    if (!definition?.enabled || definition.revision !== revision || !collection) {
      throw new AssistantError(
        "App storage is unavailable for this revision",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return collection;
  }

  private list(collectionId: string): SiteCollectionRecord[] {
    return [
      ...this.sql.exec<{ content: string }>(
        "SELECT content FROM site_records WHERE collection_id = ? ORDER BY record_id LIMIT 1001",
        collectionId,
      ),
    ].map((row) => siteCollectionRecordSchema.parse(safeParseJson(row.content)));
  }

  private requireValues(collection: SiteCollection, values: SiteCollectionRecord["values"]): void {
    const error = validateSiteCollectionValues(collection, values);

    if (error || JSON.stringify(values).length > 16000) {
      throw new AssistantError(error ?? "The record is too large", ErrorType.PARAMS_ERROR, 400);
    }
  }
}
