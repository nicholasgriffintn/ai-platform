export interface SiteRecordExportRuntime {
  apiBaseUrl: string;
  siteId: string;
  siteRevision: number;
}

export const RECORD_CONTRACTS_SOURCE = `import { isRecord } from "./record-utils";

export type RecordValue = string | number | boolean | null;
export type RecordValues = Record<string, RecordValue>;
export interface RecordColumn { id: string; name: string; type: "text" | "number" | "boolean" | "date" | "select"; required: boolean; options: string[]; maxLength?: number; minimum?: number; maximum?: number; }
export interface RecordRow { id: string; createdByUserId: number; revision: number; values: RecordValues; }
export interface RecordQuery {
  view: { id: string; title: string; editable: boolean; presentation: "table" | "board" | "checklist"; columns?: string[]; groupColumnId?: string; checkedColumnId?: string; };
  table: { output: { revision: number; status: string; }; definition: { columns: RecordColumn[]; }; permissions: { actorUserId: number; canCreate: boolean; canEditAllRows: boolean; }; };
  result: { records: RecordRow[]; hasMore: boolean; };
}

function parseColumn(value: unknown): RecordColumn {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" ||
    (value.type !== "text" && value.type !== "number" && value.type !== "boolean" && value.type !== "date" && value.type !== "select")) throw new Error("Invalid record column");
  return { id: value.id, name: value.name, type: value.type, required: value.required === true,
    options: Array.isArray(value.options) ? value.options.filter((entry): entry is string => typeof entry === "string") : [],
    maxLength: typeof value.maxLength === "number" ? value.maxLength : undefined,
    minimum: typeof value.minimum === "number" ? value.minimum : undefined,
    maximum: typeof value.maximum === "number" ? value.maximum : undefined };
}
function parseRow(value: unknown): RecordRow {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.createdByUserId !== "number" || typeof value.revision !== "number" || !isRecord(value.values)) throw new Error("Invalid record row");
  const values: RecordValues = {};
  for (const [key, entry] of Object.entries(value.values)) {
    if (entry !== null && typeof entry !== "string" && typeof entry !== "boolean" && (typeof entry !== "number" || !Number.isFinite(entry))) throw new Error("Invalid record value");
    values[key] = entry;
  }
  return { id: value.id, createdByUserId: value.createdByUserId, revision: value.revision, values };
}
export function parseRecordQuery(payload: unknown, viewId: string): RecordQuery {
  if (!isRecord(payload) || !isRecord(payload.data)) throw new Error("Invalid records response");
  const { view, table, result, operation } = payload.data;
  if (operation !== "query" || !isRecord(view) || !isRecord(table) || !isRecord(result) || !isRecord(table.output) || !isRecord(table.definition) || !isRecord(table.permissions) ||
    view.id !== viewId || typeof view.title !== "string" || typeof view.editable !== "boolean" || (view.presentation !== "table" && view.presentation !== "board" && view.presentation !== "checklist") ||
    typeof table.output.revision !== "number" || typeof table.output.status !== "string" || !Array.isArray(table.definition.columns) || typeof table.permissions.actorUserId !== "number" ||
    typeof table.permissions.canCreate !== "boolean" || typeof table.permissions.canEditAllRows !== "boolean" || !Array.isArray(result.records) || typeof result.hasMore !== "boolean") throw new Error("Invalid records response");
  return {
    view: { id: viewId, title: view.title, editable: view.editable, presentation: view.presentation,
      columns: Array.isArray(view.columns) ? view.columns.filter((entry): entry is string => typeof entry === "string") : undefined,
      groupColumnId: typeof view.groupColumnId === "string" ? view.groupColumnId : undefined,
      checkedColumnId: typeof view.checkedColumnId === "string" ? view.checkedColumnId : undefined },
    table: { output: { revision: table.output.revision, status: table.output.status }, definition: { columns: table.definition.columns.map(parseColumn) },
      permissions: { actorUserId: table.permissions.actorUserId, canCreate: table.permissions.canCreate, canEditAllRows: table.permissions.canEditAllRows } },
    result: { records: result.records.map(parseRow), hasMore: result.hasMore },
  };
}
`;

export const RECORD_UTILS_SOURCE = `export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Records are unavailable";
}
export function csrfToken(): string | undefined {
  const cookie = document.cookie.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith("_csrf="));
  return cookie ? decodeURIComponent(cookie.slice(6)) : undefined;
}
`;

export function renderSiteRecordTransport(runtime?: SiteRecordExportRuntime): string {
  return `import { isRecord, csrfToken } from "./record-utils";

const RUNTIME: { apiBaseUrl: string; siteId: string; siteRevision: number } | null = ${JSON.stringify(runtime ?? null)};

export async function recordOperation(viewId: string, operation: Record<string, unknown>): Promise<unknown> {
  if (!RUNTIME) throw new Error("Configure the saved Site record runtime before accessing live data");
  const csrf = csrfToken();
  const response = await fetch(RUNTIME.apiBaseUrl.replace(/\\/$/, "") + "/sites/" + encodeURIComponent(RUNTIME.siteId) + "/record-operations", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
    body: JSON.stringify({ ...operation, viewId, siteRevision: RUNTIME.siteRevision }), signal: AbortSignal.timeout(30_000),
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error(isRecord(payload) && typeof payload.message === "string" ? payload.message : "Sign in to Polychat and check your access to this saved Site");
  return payload;
}
`;
}

export const RECORD_HOOK_SOURCE = `"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseRecordQuery, type RecordQuery, type RecordRow, type RecordValues } from "./record-contracts";
import { recordOperation } from "./record-transport";
import { errorMessage } from "./record-utils";

export function useSiteRecords(viewId: string) {
  const [data, setData] = useState<RecordQuery | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ requestId: string; row: RecordRow | null; table: RecordQuery["table"] } | null>(null);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);
  const version = useRef(0);
  const refresh = useCallback(async (offset = 0) => {
    const current = ++version.current;
    try {
      const next = parseRecordQuery(await recordOperation(viewId, { operation: "query", offset, limit: 100 }), viewId);
      if (current !== version.current) return;
      setData(next); setRows((previous) => offset === 0 ? next.result.records : [...previous, ...next.result.records]); setError(undefined);
    } catch (cause) { if (current === version.current) { setData(null); setRows([]); setError(errorMessage(cause)); } }
  }, [viewId]);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 15_000);
    return () => { clearInterval(timer); version.current += 1; }; }, [refresh]);
  const mutate = async (operation: Record<string, unknown>) => {
    setBusy(true); setError(undefined);
    try { await recordOperation(viewId, operation); await refresh(); return true; }
    catch (cause) { setError(errorMessage(cause)); return false; }
    finally { setBusy(false); }
  };
  const open = (row: RecordRow | null) => { if (data) setDraft({ row, table: data.table, requestId: crypto.randomUUID() }); };
  const save = async (values: RecordValues) => {
    if (!draft) return;
    const input = { tableRevision: draft.table.output.revision, values };
    if (await mutate(draft.row
      ? { operation: "update", recordId: draft.row.id, input: { ...input, expectedRevision: draft.row.revision } }
      : { operation: "create", input: { ...input, requestId: draft.requestId } })) setDraft(null);
  };
  const change = async (row: RecordRow, key: string, value: boolean) => { if (data) await mutate({ operation: "update", recordId: row.id,
    input: { tableRevision: data.table.output.revision, expectedRevision: row.revision, values: { ...row.values, [key]: value } } }); };
  const remove = async () => { if (deleting && data && await mutate({ operation: "delete", recordId: deleting.id,
    input: { tableRevision: data.table.output.revision, expectedRevision: deleting.revision } })) setDeleting(null); };
  return { data, rows, error, busy, draft, deleting, open, save, change, remove, refresh, setDraft, setDeleting };
}
`;

export const RECORD_FORM_SOURCE = `"use client";

import { useState } from "react";
import type { RecordColumn, RecordValues } from "@/lib/record-contracts";

export default function RecordForm({ columns, initial, busy, onSave, onCancel }: { columns: RecordColumn[]; initial: RecordValues; busy: boolean; onSave: (values: RecordValues) => Promise<void>; onCancel: () => void }) {
  const [values, setValues] = useState<RecordValues>(initial);
  return <form className="space-y-3 rounded-lg border p-3" onSubmit={(event) => {
    event.preventDefault();
    const parsed: RecordValues = {};
    for (const column of columns) {
      const value = values[column.id];
      parsed[column.id] = column.type === "boolean" ? value === true : value === undefined || value === "" ? null : column.type === "number" ? Number(value) : value;
    }
    void onSave(parsed);
  }}>
    {columns.map((column) => <label className="block space-y-1 text-sm" key={column.id}><span>{column.name}{column.required ? " *" : ""}</span>
      {column.type === "boolean" ? <input type="checkbox" checked={values[column.id] === true} onChange={(event) => setValues((current) => ({ ...current, [column.id]: event.target.checked }))} /> :
      column.type === "select" ? <select className="block w-full rounded border bg-background p-2" required={column.required} value={String(values[column.id] ?? "")}
        onChange={(event) => setValues((current) => ({ ...current, [column.id]: event.target.value }))}><option value="">Choose…</option>{column.options.map((option) => <option key={option}>{option}</option>)}</select> :
      <input className="block w-full rounded border bg-background p-2" type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"} step={column.type === "number" ? "any" : undefined}
        required={column.required} min={column.minimum} max={column.maximum} maxLength={column.maxLength} value={String(values[column.id] ?? "")}
        onChange={(event) => setValues((current) => ({ ...current, [column.id]: event.target.value }))} />}</label>)}
    <div className="flex gap-2"><button className="rounded bg-primary px-3 py-2 text-primary-foreground" disabled={busy}>Save record</button>
      <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
`;

export const RECORD_COMPONENT_SOURCE = `"use client";

import { useSiteRecords } from "@/lib/use-site-records";
import type { RecordRow } from "@/lib/record-contracts";
import RecordForm from "./RecordForm";

export default function Records({ viewId }: { viewId: string }) {
  const work = useSiteRecords(viewId);
  const data = work.data;
  const columns = data?.table.definition.columns.filter((column) => !data.view.columns || data.view.columns.includes(column.id)) ?? [];
  const title = columns.find((column) => column.type === "text") ?? columns[0];
  const group = data?.table.definition.columns.find((column) => column.id === data.view.groupColumnId);
  const checked = data?.table.definition.columns.find((column) => column.id === data.view.checkedColumnId);
  const editable = (row: RecordRow) => Boolean(data?.view.editable && data.table.output.status === "ready" && (data.table.permissions.canEditAllRows || row.createdByUserId === data.table.permissions.actorUserId));
  const actions = (row: RecordRow) => editable(row) ? <span className="flex gap-2"><button disabled={work.busy} onClick={() => work.open(row)}>Edit</button><button disabled={work.busy} onClick={() => work.setDeleting(row)}>Delete</button></span> : null;
  return <section className="space-y-3 rounded-lg border p-4">
    <div className="flex items-center gap-3"><h3 className="flex-1 text-lg font-semibold">{data?.view.title ?? "Live records"}</h3>
      <button disabled={work.busy} onClick={() => void work.refresh()}>Refresh</button>
      {data?.view.editable && data.table.permissions.canCreate && <button disabled={work.busy} onClick={() => work.open(null)}>Add record</button>}</div>
    {work.error && <p role="alert" className="text-sm text-destructive">{work.error}</p>}
    {work.draft && <RecordForm key={work.draft.requestId} columns={work.draft.table.definition.columns} initial={work.draft.row?.values ?? {}} busy={work.busy} onSave={work.save} onCancel={() => work.setDraft(null)} />}
    {work.deleting && <div className="flex gap-3"><span>Delete this record?</span><button disabled={work.busy} onClick={() => void work.remove()}>Delete</button><button onClick={() => work.setDeleting(null)}>Cancel</button></div>}
    {data && (data.view.presentation === "board" && group?.type === "select" ? <div className="flex gap-3 overflow-x-auto">
      {[...group.options, ""].map((option) => <section className="min-w-64 flex-1 space-y-3 rounded border p-3" key={option}><h4>{option || "Unassigned"}</h4>
        {work.rows.filter((row) => String(row.values[group.id] ?? "") === option).map((row) => <article className="space-y-2 rounded border p-3 text-sm" key={row.id}>
          {columns.map((column) => <div key={column.id}>{column.name}: {String(row.values[column.id] ?? "—")}</div>)}{actions(row)}</article>)}</section>)}</div> :
      data.view.presentation === "checklist" && checked?.type === "boolean" ? <ul className="divide-y">{work.rows.map((row) => <li className="flex items-center gap-3 py-3" key={row.id}>
        <input type="checkbox" aria-label={checked.name} checked={row.values[checked.id] === true} disabled={work.busy || !editable(row)} onChange={(event) => void work.change(row, checked.id, event.target.checked)} />
        <span className="flex-1">{String(title ? row.values[title.id] ?? "—" : row.id)}</span>{actions(row)}</li>)}</ul> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{data.view.title}</caption>
        <thead><tr>{columns.map((column) => <th className="p-2" key={column.id}>{column.name}</th>)}<th>Actions</th></tr></thead>
        <tbody>{work.rows.map((row) => <tr className="border-t" key={row.id}>{columns.map((column) => <td className="p-2" key={column.id}>
          {column.type === "boolean" ? <input type="checkbox" aria-label={column.name} checked={row.values[column.id] === true} disabled={work.busy || !editable(row)} onChange={(event) => void work.change(row, column.id, event.target.checked)} /> : String(row.values[column.id] ?? "—")}</td>)}<td>{actions(row)}</td></tr>)}</tbody>
      </table></div>)}
    {data?.result.hasMore && <button disabled={work.busy} onClick={() => void work.refresh(work.rows.length)}>Load more</button>}
  </section>;
}
`;
