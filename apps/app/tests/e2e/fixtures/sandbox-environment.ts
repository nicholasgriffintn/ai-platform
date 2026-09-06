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
        command: "node -e \"console.log('E2E_WATCHER_READY'),setInterval(() => {}, 1000)\"",
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

export const BOUNDED_LOG_SANDBOX_ENVIRONMENT = {
  ...SUPERVISED_SANDBOX_ENVIRONMENT,
  definition: {
    ...SUPERVISED_SANDBOX_ENVIRONMENT.definition,
    services: [
      {
        name: "watcher",
        workingDirectory: ".",
        command:
          "node -e \"console.log('E2E_WATCHER_READY' + 'x'.repeat(40000)),setInterval(() => {}, 1000)\"",
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

export const INVALID_SERVICE_SANDBOX_ENVIRONMENTS = [
  {
    name: "duplicate ports",
    error: /Port is already declared/,
    setup: {
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: ["node --version"],
        resumeCommands: [],
        runtimes: [],
        setupTimeoutSeconds: 30,
        services: [
          {
            name: "first",
            workingDirectory: ".",
            command: "node service.cjs",
            dependencies: [],
            expectedPort: 4000,
            healthCheck: { type: "tcp" },
            startupTimeoutSeconds: 10,
            restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
          },
          {
            name: "second",
            workingDirectory: ".",
            command: "node service.cjs",
            dependencies: [],
            expectedPort: 4000,
            healthCheck: { type: "tcp" },
            startupTimeoutSeconds: 10,
            restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
          },
        ],
      },
    },
  },
  {
    name: "dependency cycle",
    error: /must not contain a cycle/,
    setup: {
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: ["node --version"],
        resumeCommands: [],
        runtimes: [],
        setupTimeoutSeconds: 30,
        services: [
          {
            name: "first",
            workingDirectory: ".",
            command: "node --version",
            dependencies: ["second"],
            startupTimeoutSeconds: 10,
            restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
          },
          {
            name: "second",
            workingDirectory: ".",
            command: "node --version",
            dependencies: ["first"],
            startupTimeoutSeconds: 10,
            restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
          },
        ],
      },
    },
  },
  {
    name: "outside working directory",
    error: /Working directory cannot leave the repository/,
    setup: {
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: ["node --version"],
        resumeCommands: [],
        runtimes: [],
        setupTimeoutSeconds: 30,
        services: [
          {
            name: "outside",
            workingDirectory: "../private",
            command: "node --version",
            dependencies: [],
            startupTimeoutSeconds: 10,
            restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
          },
        ],
      },
    },
  },
  {
    name: "inline credential",
    error: /configured environment variable/,
    setup: {
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: ["node --version"],
        resumeCommands: [],
        runtimes: [],
        setupTimeoutSeconds: 30,
        services: [
          {
            name: "credential",
            workingDirectory: ".",
            command: "API_KEY=fixture-secret-value node --version",
            dependencies: [],
            startupTimeoutSeconds: 10,
            restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
          },
        ],
      },
    },
  },
] satisfies Array<{ name: string; error: RegExp; setup: SandboxEnvironmentSetup }>;

export const OCCUPIED_PORT_SANDBOX_ENVIRONMENT = {
  source: "polychat",
  definition: {
    version: 1,
    setupCommands: ["node --version"],
    resumeCommands: [],
    runtimes: [],
    setupTimeoutSeconds: 30,
    services: [
      {
        name: "occupant",
        workingDirectory: ".",
        command: "node occupy.cjs",
        dependencies: [],
        expectedPort: 4001,
        healthCheck: { type: "tcp" },
        startupTimeoutSeconds: 10,
        restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
      },
      {
        name: "fixture",
        workingDirectory: ".",
        command: "node service.cjs",
        dependencies: ["occupant"],
        expectedPort: 4000,
        healthCheck: { type: "tcp" },
        startupTimeoutSeconds: 10,
        restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
      },
    ],
  },
} satisfies SandboxEnvironmentSetup;

export const UNHEALTHY_SANDBOX_ENVIRONMENT = {
  source: "polychat",
  definition: {
    version: 1,
    setupCommands: ["node --version"],
    resumeCommands: [],
    runtimes: [],
    setupTimeoutSeconds: 30,
    services: [
      {
        name: "fixture",
        workingDirectory: ".",
        command: "node service.cjs",
        dependencies: [],
        expectedPort: 4000,
        healthCheck: { type: "http", path: "/", expectedStatus: { min: 204, max: 204 } },
        startupTimeoutSeconds: 15,
        restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
      },
    ],
  },
} satisfies SandboxEnvironmentSetup;
