import type { ModelAssetKind } from "@ngriffin_uk/polychat-schemas";
import { encodePathSegments, isGitCommitSha, isRecord } from "@ngriffin_uk/polychat-utility-core";

import { ModelSourceError, modelSourceErrorFromStatus } from "./errors.js";

export const HUGGINGFACE_BASE_URL = "https://huggingface.co";
export const HUGGINGFACE_DATASETS_SERVER_URL = "https://datasets-server.huggingface.co";

const REPO_PATTERN = /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/;
const REVISION_PATTERN = /^[\w./-]{1,120}$/;
const MAX_TREE_PAGES = 20;

const DATASET_INFO_EXPAND = [
  "sha",
  "gated",
  "cardData",
  "tags",
  "lastModified",
  "downloads",
  "likes",
];
const MODEL_INFO_EXPAND = [
  ...DATASET_INFO_EXPAND,
  "config",
  "pipeline_tag",
  "library_name",
  "baseModels",
  "safetensors",
  "gguf",
  "inferenceProviderMapping",
  "evalResults",
];
const DATASET_SEARCH_EXPAND = ["gated", "cardData", "downloads", "likes", "lastModified", "tags"];
const MODEL_SEARCH_EXPAND = [...DATASET_SEARCH_EXPAND, "pipeline_tag"];

export type HubFileScanStatus =
  | "safe"
  | "unsafe"
  | "suspicious"
  | "caution"
  | "unscanned"
  | "unknown";

export interface HubPickleImport {
  module: string;
  name: string;
  safety: string;
}

export interface HubFile {
  path: string;
  size: number;
  sha256: string | null;
  scanStatus: HubFileScanStatus;
  scanFindings: string[];
  pickleImports: HubPickleImport[];
}

export interface HubInferenceProvider {
  provider: string;
  providerModelId: string;
  status: string;
}

export type HubEvalProvenance = "author" | "community" | "verified";

export interface HubPublicEval {
  benchmark: string;
  task: string | null;
  value: number;
  date: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  provenance: HubEvalProvenance;
}

export interface HubRepoInfo {
  kind: ModelAssetKind;
  id: string;
  sha: string;
  gated: boolean;
  licence: unknown;
  cardData: Record<string, unknown>;
  config: Record<string, unknown> | null;
  pipelineTag: string | null;
  libraryName: string | null;
  tags: string[];
  baseModels: string[];
  parameterCount: number | null;
  ggufArchitecture: string | null;
  lastModified: string | null;
  downloads: number;
  likes: number;
  inferenceProviders: HubInferenceProvider[];
  publicEvals: HubPublicEval[];
}

export interface HubSearchItem {
  kind: ModelAssetKind;
  id: string;
  gated: boolean;
  licence: unknown;
  pipelineTag: string | null;
  tags: string[];
  downloads: number;
  likes: number;
  lastModified: string | null;
}

export interface HubIdentity {
  account: string;
  canWrite: boolean;
  organisations: Array<{ name: string; canWrite: boolean }>;
}

const WRITE_ROLES = new Set(["admin", "write", "contributor"]);

function readIdentity(body: unknown): HubIdentity {
  if (!isRecord(body) || typeof body.name !== "string") {
    throw new ModelSourceError("upstream_error", "The Hub did not identify this token");
  }

  const auth = isRecord(body.auth) && isRecord(body.auth.accessToken) ? body.auth.accessToken : {};
  const tokenRole = readString(auth.role);
  const tokenCanWrite = tokenRole === "write" || tokenRole === "fineGrained";

  return {
    account: body.name,
    canWrite: tokenCanWrite,
    organisations: Array.isArray(body.orgs)
      ? body.orgs.flatMap((org) =>
          isRecord(org) && typeof org.name === "string"
            ? [
                {
                  name: org.name,
                  canWrite: tokenCanWrite && WRITE_ROLES.has(readString(org.roleInOrg) ?? ""),
                },
              ]
            : [],
        )
      : [],
  };
}

export interface HubRepoReference {
  kind: ModelAssetKind;
  repo: string;
  revision: string;
}

export interface HuggingFaceHubClientOptions {
  token?: string;
  fetcher?: typeof fetch;
  baseUrl?: string;
  datasetsServerUrl?: string;
}

export function assertHubRepo(repo: string): string {
  if (!REPO_PATTERN.test(repo)) {
    throw new ModelSourceError("invalid_reference", `"${repo}" is not an owner/name repository`);
  }

  return repo;
}

function assertRevision(revision: string): string {
  if (!REVISION_PATTERN.test(revision) || revision.includes("..")) {
    throw new ModelSourceError("invalid_reference", `"${revision}" is not a valid revision`);
  }

  return revision;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readGated(value: unknown): boolean {
  return value === "auto" || value === "manual" || value === true;
}

function readBaseModels(value: unknown, cardData: Record<string, unknown>): string[] {
  if (isRecord(value) && Array.isArray(value.models)) {
    return value.models.flatMap((model) =>
      isRecord(model) && typeof model.id === "string" ? [model.id] : [],
    );
  }

  const fromCard = cardData.base_model;

  return typeof fromCard === "string" ? [fromCard] : readStrings(fromCard);
}

function readInferenceProviders(value: unknown): HubInferenceProvider[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([provider, mapping]) =>
    isRecord(mapping) && typeof mapping.providerId === "string"
      ? [
          {
            provider,
            providerModelId: mapping.providerId,
            status: typeof mapping.status === "string" ? mapping.status : "unknown",
          },
        ]
      : [],
  );
}

const KNOWN_SCAN_STATUSES = ["safe", "unsafe", "suspicious", "caution", "unscanned"] as const;

function readPublicEvals(value: unknown): HubPublicEval[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.data) || typeof entry.data.value !== "number") {
      return [];
    }

    const dataset = isRecord(entry.data.dataset) ? entry.data.dataset : {};
    const source = isRecord(entry.data.source) ? entry.data.source : {};

    if (typeof dataset.id !== "string") {
      return [];
    }

    return [
      {
        benchmark: dataset.id,
        task: readString(dataset.task_id),
        value: entry.data.value,
        date: readString(entry.data.date),
        sourceName: readString(source.name),
        sourceUrl: readString(source.url),
        provenance:
          entry.verified === true
            ? "verified"
            : entry.pullRequest !== undefined
              ? "community"
              : "author",
      },
    ];
  });
}

function readScanStatus(value: unknown): HubFileScanStatus {
  return KNOWN_SCAN_STATUSES.find((status) => status === value) ?? "unknown";
}

function readFile(entry: unknown): HubFile | null {
  if (!isRecord(entry) || entry.type !== "file" || typeof entry.path !== "string") {
    return null;
  }

  const lfs = isRecord(entry.lfs) ? entry.lfs : null;
  const security = isRecord(entry.securityFileStatus) ? entry.securityFileStatus : null;
  const scanFindings: string[] = [];
  let pickleImports: HubPickleImport[] = [];

  if (security) {
    for (const [scanner, result] of Object.entries(security)) {
      if (
        isRecord(result) &&
        typeof result.status === "string" &&
        result.status !== "safe" &&
        result.status !== "unscanned"
      ) {
        scanFindings.push(
          `${scanner}: ${result.status}${typeof result.message === "string" ? ` (${result.message})` : ""}`,
        );
      }
    }

    const pickleScan = security.pickleImportScan;

    if (isRecord(pickleScan) && Array.isArray(pickleScan.pickleImports)) {
      pickleImports = pickleScan.pickleImports.flatMap((item) =>
        isRecord(item) && typeof item.module === "string" && typeof item.name === "string"
          ? [
              {
                module: item.module,
                name: item.name,
                safety: typeof item.safety === "string" ? item.safety : "unknown",
              },
            ]
          : [],
      );
    }
  }

  return {
    path: entry.path,
    size: readNumber(lfs?.size ?? entry.size),
    sha256: lfs && typeof lfs.oid === "string" ? lfs.oid : null,
    scanStatus: readScanStatus(security?.status),
    scanFindings,
    pickleImports,
  };
}

async function readUpstreamError(response: Response): Promise<string | undefined> {
  const text = (await response.text().catch(() => "")).slice(0, 500);

  try {
    const body: unknown = JSON.parse(text);

    return isRecord(body) && typeof body.error === "string" ? body.error : text || undefined;
  } catch {
    return text || undefined;
  }
}

function nextLink(header: string | null): string | null {
  const match = header?.match(/<([^>]+)>;\s*rel="next"/);

  return match ? match[1] : null;
}

export class HuggingFaceHubClient {
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private readonly datasetsServerUrl: string;
  private readonly token?: string;

  constructor(options: HuggingFaceHubClientOptions = {}) {
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    this.baseUrl = options.baseUrl ?? HUGGINGFACE_BASE_URL;
    this.datasetsServerUrl = options.datasetsServerUrl ?? HUGGINGFACE_DATASETS_SERVER_URL;
    this.token = options.token;
  }

  async whoAmI(): Promise<HubIdentity> {
    return readIdentity(await this.getJson(`${this.baseUrl}/api/whoami-v2`, "Checking the token"));
  }

  async search({
    kind,
    query,
    limit,
  }: {
    kind: ModelAssetKind;
    query: string;
    limit: number;
  }): Promise<HubSearchItem[]> {
    const params = new URLSearchParams({
      limit: String(Math.min(Math.max(limit, 1), 50)),
      sort: "downloads",
      direction: "-1",
    });

    if (query.trim()) {
      params.set("search", query.trim());
    }

    for (const field of kind === "model" ? MODEL_SEARCH_EXPAND : DATASET_SEARCH_EXPAND) {
      params.append("expand[]", field);
    }

    const body = await this.getJson(`${this.apiRoot(kind)}?${params}`, `Searching ${kind}s`);

    if (!Array.isArray(body)) {
      throw new ModelSourceError("upstream_error", "Hub search did not return a list");
    }

    return body.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string") {
        return [];
      }

      const cardData = isRecord(item.cardData) ? item.cardData : {};

      return [
        {
          kind,
          id: item.id,
          gated: readGated(item.gated),
          licence: cardData.license,
          pipelineTag: readString(item.pipeline_tag),
          tags: readStrings(item.tags),
          downloads: readNumber(item.downloads),
          likes: readNumber(item.likes),
          lastModified: readString(item.lastModified),
        },
      ];
    });
  }

  async getRepoInfo({ kind, repo, revision }: HubRepoReference): Promise<HubRepoInfo> {
    const params = new URLSearchParams();

    for (const field of kind === "model" ? MODEL_INFO_EXPAND : DATASET_INFO_EXPAND) {
      params.append("expand[]", field);
    }

    const path = `${this.apiRoot(kind)}/${encodePathSegments(assertHubRepo(repo))}/revision/${encodeURIComponent(assertRevision(revision))}`;
    const body = await this.getJson(`${path}?${params}`, `${repo}@${revision}`);

    if (!isRecord(body) || typeof body.sha !== "string" || !isGitCommitSha(body.sha)) {
      throw new ModelSourceError("upstream_error", `${repo} did not report a commit sha`);
    }

    const cardData = isRecord(body.cardData) ? body.cardData : {};
    const safetensors = isRecord(body.safetensors) ? body.safetensors : null;
    const gguf = isRecord(body.gguf) ? body.gguf : null;

    return {
      kind,
      id: typeof body.id === "string" ? body.id : repo,
      sha: body.sha,
      gated: readGated(body.gated),
      licence: cardData.license,
      cardData,
      config: isRecord(body.config) ? body.config : null,
      pipelineTag: readString(body.pipeline_tag),
      libraryName: readString(body.library_name),
      tags: readStrings(body.tags),
      baseModels: readBaseModels(body.baseModels, cardData),
      parameterCount:
        safetensors && typeof safetensors.total === "number"
          ? safetensors.total
          : gguf && typeof gguf.total === "number"
            ? gguf.total
            : null,
      ggufArchitecture: gguf ? readString(gguf.architecture) : null,
      lastModified: readString(body.lastModified),
      downloads: readNumber(body.downloads),
      likes: readNumber(body.likes),
      inferenceProviders: readInferenceProviders(body.inferenceProviderMapping),
      publicEvals: readPublicEvals(body.evalResults),
    };
  }

  async listFiles({ kind, repo, revision }: HubRepoReference): Promise<HubFile[]> {
    let url: string | null =
      `${this.apiRoot(kind)}/${encodePathSegments(assertHubRepo(repo))}/tree/${encodeURIComponent(assertRevision(revision))}?recursive=true&expand=true`;
    const files: HubFile[] = [];

    for (let page = 0; url && page < MAX_TREE_PAGES; page += 1) {
      const response = await this.request(url, `Listing files in ${repo}`);
      const body: unknown = await response.json();

      if (!Array.isArray(body)) {
        throw new ModelSourceError("upstream_error", `${repo} file listing was not a list`);
      }

      files.push(...body.flatMap((entry) => readFile(entry) ?? []));
      url = nextLink(response.headers.get("link"));
    }

    return files;
  }

  async fetchRange({
    kind,
    repo,
    revision,
    path,
    start,
    end,
  }: HubRepoReference & { path: string; start: number; end: number }): Promise<Uint8Array> {
    const response = await this.request(
      this.fileUrl({ kind, repo, revision, path }),
      `Reading ${path}`,
      {
        Range: `bytes=${start}-${end - 1}`,
      },
    );

    return new Uint8Array(await response.arrayBuffer());
  }

  async fetchText({
    kind,
    repo,
    revision,
    path,
    maxBytes = 512 * 1024,
  }: HubRepoReference & { path: string; maxBytes?: number }): Promise<string | null> {
    try {
      const bytes = await this.fetchRange({ kind, repo, revision, path, start: 0, end: maxBytes });

      return new TextDecoder().decode(bytes);
    } catch (error) {
      if (error instanceof ModelSourceError && error.code === "not_found") {
        return null;
      }

      throw error;
    }
  }

  async openFile(
    reference: HubRepoReference & { path: string },
    range?: { start: number; end: number },
  ): Promise<Response> {
    return this.request(
      this.fileUrl(reference),
      `Downloading ${reference.path}`,
      range ? { Range: `bytes=${range.start}-${range.end - 1}` } : undefined,
    );
  }

  async sampleDatasetRows({
    repo,
    limit,
  }: {
    repo: string;
    limit: number;
  }): Promise<{ rows: string[]; totalRows: number | null }> {
    const dataset = encodeURIComponent(assertHubRepo(repo));
    const splits = await this.getJson(
      `${this.datasetsServerUrl}/splits?dataset=${dataset}`,
      `Listing splits for ${repo}`,
    );
    const first = isRecord(splits) && Array.isArray(splits.splits) ? splits.splits[0] : null;

    if (!isRecord(first) || typeof first.config !== "string" || typeof first.split !== "string") {
      return { rows: [], totalRows: null };
    }

    const params = new URLSearchParams({ dataset: repo, config: first.config, split: first.split });
    const [rowsBody, sizeBody] = await Promise.all([
      this.getJson(`${this.datasetsServerUrl}/first-rows?${params}`, `Sampling ${repo}`),
      this.getJson(`${this.datasetsServerUrl}/size?dataset=${dataset}`, `Sizing ${repo}`).catch(
        () => null,
      ),
    ]);
    const rows =
      isRecord(rowsBody) && Array.isArray(rowsBody.rows)
        ? rowsBody.rows
            .slice(0, limit)
            .flatMap((row) => (isRecord(row) && isRecord(row.row) ? [JSON.stringify(row.row)] : []))
        : [];
    const size = isRecord(sizeBody) && isRecord(sizeBody.size) ? sizeBody.size : null;
    const datasetSize = size && isRecord(size.dataset) ? size.dataset : null;

    return {
      rows,
      totalRows:
        datasetSize && typeof datasetSize.num_rows === "number" ? datasetSize.num_rows : null,
    };
  }

  fileUrl({ kind, repo, revision, path }: HubRepoReference & { path: string }): string {
    const prefix = kind === "dataset" ? `${this.baseUrl}/datasets` : this.baseUrl;

    return `${prefix}/${encodePathSegments(assertHubRepo(repo))}/resolve/${encodeURIComponent(assertRevision(revision))}/${encodePathSegments(path)}`;
  }

  private apiRoot(kind: ModelAssetKind): string {
    return `${this.baseUrl}/api/${kind === "dataset" ? "datasets" : "models"}`;
  }

  private async getJson(url: string, context: string): Promise<unknown> {
    return (await this.request(url, context)).json();
  }

  private async request(
    url: string,
    context: string,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const response = await this.fetcher(url, {
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...headers,
      },
    });

    if (!response.ok) {
      throw modelSourceErrorFromStatus(response.status, context, await readUpstreamError(response));
    }

    return response;
  }
}
