import { runInNewContext } from "node:vm";

import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import ts from "typescript";

import { setStatePath } from "../../src/state.js";

interface TransportOptions {
  baseUrl: string;
  siteId: string;
  projectId?: string;
  getRevision: () => number;
  fetchAuthenticated: (url: string, init: RequestInit) => Promise<Response>;
}

interface Transport {
  read(): Promise<Record<string, unknown>>;
  perform(action: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export function loadGeneratedDataModule(source: string): {
  createSiteDataTransport: (options: TransportOptions) => Transport;
} {
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const exports: { createSiteDataTransport?: (options: TransportOptions) => Transport } = {};
  const require = (name: string) =>
    name === "./utils" ? { isRecord } : name === "./site-state" ? { setPath: setStatePath } : {};

  if (result.diagnostics?.length) {
    throw new Error("Generated module did not compile");
  }

  runInNewContext(result.outputText, { require, exports, URL });
  if (!exports.createSiteDataTransport) {
    throw new Error("Missing data transport");
  }

  return { createSiteDataTransport: exports.createSiteDataTransport };
}
