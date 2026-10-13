import type { Plugin } from "vite";

const VERSION_FILE = "version.json";

function resolveBuildId(): string {
  return (
    process.env.POLYCHAT_BUILD_ID ??
    process.env.WORKERS_CI_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    new Date().toISOString()
  );
}

export function buildVersion(): Plugin {
  const buildId = resolveBuildId();

  return {
    name: "polychat-build-version",
    config() {
      return { define: { __POLYCHAT_BUILD_ID__: JSON.stringify(buildId) } };
    },
    generateBundle() {
      if (this.environment.name !== "client") {
        return;
      }

      this.emitFile({
        type: "asset",
        fileName: VERSION_FILE,
        source: JSON.stringify({ buildId }),
      });
    },
  };
}
