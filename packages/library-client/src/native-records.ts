import {
  nativeRecordTableResponseSchema,
  nativeRecordSchema,
  nativeRecordListResponseSchema,
  nativeRecordChangesResponseSchema,
  type CreateNativeRecordTableInput,
  type UpdateNativeRecordTableInput,
  type CreateNativeRecordInput,
  type UpdateNativeRecordInput,
  type DeleteNativeRecordInput,
  type NativeRecordQuery,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function createNativeRecordTable(input: CreateNativeRecordTableInput) {
  const response = await fetchApiOrThrow("/records", {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return nativeRecordTableResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function getNativeRecordTable(tableId: string) {
  const response = await fetchApiOrThrow(`/records/${encodeURIComponent(tableId)}`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return nativeRecordTableResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function updateNativeRecordTable(
  tableId: string,
  input: UpdateNativeRecordTableInput,
) {
  const response = await fetchApiOrThrow(`/records/${encodeURIComponent(tableId)}`, {
    method: "PUT",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return nativeRecordTableResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function listNativeRecords(tableId: string, query: NativeRecordQuery) {
  const response = await fetchApiOrThrow(`/records/${encodeURIComponent(tableId)}/query`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: query,
  });

  return nativeRecordListResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function listNativeRecordChanges(tableId: string, after: number) {
  const query = new URLSearchParams({ after: String(after) });
  const response = await fetchApiOrThrow(
    `/records/${encodeURIComponent(tableId)}/changes?${query}`,
    { method: "GET", headers: await apiService.getHeaders() },
  );

  return nativeRecordChangesResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function createNativeRecord(tableId: string, input: CreateNativeRecordInput) {
  const response = await fetchApiOrThrow(`/records/${encodeURIComponent(tableId)}/rows`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return nativeRecordSchema.parse(await returnFetchedData<unknown>(response));
}

export async function updateNativeRecord(
  tableId: string,
  recordId: string,
  input: UpdateNativeRecordInput,
) {
  const response = await fetchApiOrThrow(
    `/records/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(recordId)}`,
    { method: "PUT", headers: await apiService.getHeaders(), body: input },
  );

  return nativeRecordSchema.parse(await returnFetchedData<unknown>(response));
}

export async function deleteNativeRecord(
  tableId: string,
  recordId: string,
  input: DeleteNativeRecordInput,
) {
  const response = await fetchApiOrThrow(
    `/records/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(recordId)}`,
    { method: "DELETE", headers: await apiService.getHeaders(), body: input },
  );

  return nativeRecordSchema.parse(await returnFetchedData<unknown>(response));
}
