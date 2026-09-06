import type { SandboxEnvironmentSetup } from "@ngriffin_uk/polychat-schemas";

export const SUPERVISED_SANDBOX_ENVIRONMENT = {
  source: "polychat",
  definition: {
    version: 1,
    setupCommands: ["node --version"],
    resumeCommands: [],
    runtimes: [{ name: "node", version: "22" }],
    setupTimeoutSeconds: 30,
    services: [
      {
        name: "watcher",
        workingDirectory: ".",
        command: "node -e 'setInterval(() => {}, 1000)'",
        dependencies: [],
        startupTimeoutSeconds: 10,
        restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
      },
      {
        name: "fixture",
        workingDirectory: ".",
        command: "node service.cjs",
        dependencies: ["watcher"],
        expectedPort: 4000,
        healthCheck: { type: "http", path: "/", expectedStatus: { min: 200, max: 200 } },
        startupTimeoutSeconds: 10,
        restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
      },
    ],
  },
} satisfies SandboxEnvironmentSetup;
