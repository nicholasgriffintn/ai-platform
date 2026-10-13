import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

const assets = [
  {
    name: "sites-runtime/preview-runtime.js",
    path: "../../../packages/component-sites/dist/preview-runtime.global.js",
  },
  { name: "sites-runtime/styles.css", path: "../../../packages/component-sites/dist/styles.css" },
];

export function sitePreviewAssets(): Plugin {
  return {
    name: "site-preview-assets",
    apply: "build",
    async generateBundle() {
      if (this.environment.name !== "client") {
        return;
      }

      for (const asset of assets) {
        this.emitFile({
          type: "asset",
          fileName: asset.name,
          source: await readFile(fileURLToPath(new URL(asset.path, import.meta.url))),
        });
      }
    },
  };
}
