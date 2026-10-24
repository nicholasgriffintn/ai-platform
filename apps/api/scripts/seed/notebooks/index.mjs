import { OWNER } from "../identity.mjs";
import { at, insert, seedId, shift } from "../sql.mjs";
import { buildThread } from "../thread.mjs";
import { FILMS_NOTEBOOK } from "./films.mjs";
import { HABITS_NOTEBOOK } from "./habits.mjs";
import { LAUNCH_NOTEBOOK } from "./launch.mjs";
import { PROGRESS_NOTEBOOK } from "./progress.mjs";

const NOTEBOOKS = [FILMS_NOTEBOOK, PROGRESS_NOTEBOOK, HABITS_NOTEBOOK, LAUNCH_NOTEBOOK];

const OUTPUT_SHAPES = {
  report: { capabilityId: "document-writer", kind: "document" },
  deck: { capabilityId: "deck-writer", kind: "deck" },
  sheet: { capabilityId: "sheet-writer", kind: "sheet" },
  mind_map: { capabilityId: "notebook-studio", kind: "mind_map" },
  flashcards: { capabilityId: "notebook-studio", kind: "flashcards" },
  quiz: { capabilityId: "notebook-studio", kind: "quiz" },
  video: { capabilityId: "notebook-studio", kind: "video_overview" },
};

const CITATION_PATTERN = /\{\{cite:([a-z0-9-]+)\}\}/g;

function scopeOf(notebook) {
  return notebook.projectId
    ? { scope_type: "project", scope_id: notebook.projectId }
    : { scope_type: "personal", scope_id: String(OWNER.id) };
}

function sourceId(notebook, key) {
  return seedId("source", notebook.key, key);
}

function fileFields(file) {
  return file
    ? {
        storage_key: file.key,
        mime_type: file.contentType,
        filename: file.filename,
        byte_size: file.byteSize,
      }
    : {};
}

function citeSources(notebook, text) {
  return text.replaceAll(CITATION_PATTERN, (_match, key) => {
    const source = notebook.sources.find((candidate) => candidate.key === key);

    if (!source) {
      throw new Error(`Notebook ${notebook.key} cites unknown source ${key}`);
    }

    return `[${source.title.replaceAll(/[[\]]/g, "")}](#source-${encodeURIComponent(sourceId(notebook, key))})`;
  });
}

function sourceRow(notebook, entry, metadata) {
  return insert("resource", {
    resource_type: "source",
    id: sourceId(notebook, entry.key),
    created_by_user_id: OWNER.id,
    ...scopeOf(notebook),
    kind: entry.kind,
    title: entry.title,
    status: "available",
    content: entry.content ?? null,
    external_uri: entry.externalUri,
    provider: entry.provider,
    mime_type: entry.mimeType,
    filename: entry.filename,
    byte_size: entry.content && !entry.file ? Buffer.byteLength(entry.content) : undefined,
    ...fileFields(entry.file),
    metadata,
    created_at: at(entry.created),
    updated_at: at(entry.created),
  });
}

function linkRow(notebook, entry) {
  return insert("resource_link", {
    kind: "source_collection",
    collection_id: seedId("notebook", notebook.key),
    source_id: sourceId(notebook, entry.key),
    created_at: at(entry.created),
  });
}

function outputRows(notebook, entry, sourceIds) {
  const shape = OUTPUT_SHAPES[entry.kind];
  const id = seedId("output", notebook.key, entry.key);
  const createdAt = at(entry.created);
  const sensitivity = notebook.projectId ? "internal" : "personal";

  return [
    insert("resource", {
      resource_type: "output",
      id,
      created_by_user_id: OWNER.id,
      ...scopeOf(notebook),
      collection_id: seedId("notebook", notebook.key),
      capability_id: shape.capabilityId,
      kind: shape.kind,
      title: entry.title,
      status: "ready",
      sensitivity,
      content: entry.content,
      ...fileFields(entry.file),
      metadata: entry.progress ? { viewerState: { [OWNER.id]: entry.progress } } : {},
      provenance_json: {
        protocolVersion: 1,
        capturedAt: createdAt,
        completeness: "partial",
        origin: "generated",
        run: null,
        model: null,
        skills: [],
        sources: sourceIds.map((id) => ({ id, name: null, state: "referenced" })),
        approvals: [],
      },
      revision: 1,
      created_at: createdAt,
      updated_at: createdAt,
      revision_created_by_user_id: OWNER.id,
      revision_created_at: createdAt,
      revision_operation: "created",
    }),
    insert("resource_revision", {
      resource_type: "output",
      output_id: id,
      revision: 1,
      title: entry.title,
      status: "ready",
      sensitivity,
      content: entry.content,
      created_by_user_id: OWNER.id,
      created_at: createdAt,
      operation: "created",
    }),
    ...sourceIds.map((source) =>
      insert("resource_link", { kind: "output_source", output_id: id, source_id: source }),
    ),
  ];
}

function notebookRows(notebook) {
  const sourceIds = notebook.sources.map((entry) => sourceId(notebook, entry.key));
  const statements = [
    insert("resource_collection", {
      collection_type: "conversation",
      id: seedId("notebook", notebook.key),
      owner_user_id: notebook.projectId ? null : OWNER.id,
      project_id: notebook.projectId ?? null,
      title: notebook.title,
      normalised_name: notebook.title.toLowerCase(),
      created_by_user_id: OWNER.id,
      instructions: notebook.instructions,
      settings: notebook.settings,
      guide: {
        summary: notebook.guide.summary,
        questions: notebook.guide.questions,
        sourceIds,
        generatedAt: at(notebook.guide.generated),
      },
      created_at: at(notebook.created),
      updated_at: at(notebook.guide.generated),
    }),
  ];

  for (const entry of notebook.sources) {
    statements.push(sourceRow(notebook, entry, entry.metadata ?? {}), linkRow(notebook, entry));
  }

  for (const entry of notebook.notes ?? []) {
    statements.push(
      sourceRow(notebook, { ...entry, kind: "text" }, { note: true }),
      linkRow(notebook, entry),
    );
  }

  for (const entry of notebook.media ?? []) {
    statements.push(
      sourceRow(notebook, entry, {
        ...entry.metadata,
        generation: { ...entry.generation, sourceIds },
      }),
      linkRow(notebook, entry),
    );
  }

  for (const entry of notebook.outputs ?? []) {
    statements.push(...outputRows(notebook, entry, sourceIds));
  }

  for (const chat of notebook.chats ?? []) {
    const createdAt = at(chat.created);

    statements.push(
      ...buildThread(
        {
          userId: OWNER.id,
          id: seedId("chat", notebook.key, chat.key),
          title: chat.title,
          projectId: notebook.projectId ?? null,
          groupId: seedId("notebook", notebook.key),
          createdAt,
          minutesBetween: 1,
        },
        chat.messages.map((message, index) => ({
          ...message,
          at: shift(createdAt, { minutes: index + 1 }),
          content: citeSources(notebook, message.content),
        })),
      ).statements,
    );
  }

  return statements;
}

export function notebookStatements() {
  return NOTEBOOKS.flatMap(notebookRows);
}

export const NOTEBOOK_FILES = NOTEBOOKS.flatMap((notebook) => [
  ...(notebook.media ?? []).map((entry) => entry.file),
  ...(notebook.outputs ?? []).flatMap((entry) => [entry.file, ...(entry.sceneFiles ?? [])]),
]).filter(Boolean);
