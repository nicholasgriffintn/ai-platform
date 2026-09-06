import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export const SANDBOX_IMAGE = "polychat-e2e-sandbox:0.12.9";
export const SANDBOX_REPOSITORY = "nicholasgriffintn/polychat-e2e-fixture";
export const SANDBOX_REPOSITORIES = [
  SANDBOX_REPOSITORY,
  "nicholasgriffintn/polychat-e2e-fixture-v2",
  "nicholasgriffintn/polychat-e2e-fixture-malformed",
  "nicholasgriffintn/polychat-e2e-fixture-oversized",
];
export const SANDBOX_INSTALLATION_ID = 987654;
export const SANDBOX_WORKER_NAME = `polychat-e2e-sandbox-${randomUUID().slice(0, 8)}`;

export function stopSandboxContainers() {
  const names = execFileSync("docker", ["ps", "-a", "--format", "{{.Names}}"], { encoding: "utf8" })
    .split("\n")
    .filter((name) => name.startsWith(`workerd-${SANDBOX_WORKER_NAME}-Sandbox-`));

  if (names.length === 0) {
    return;
  }

  execFileSync("docker", ["stop", "--timeout", "2", ...names], { stdio: "ignore" });
  execFileSync("docker", ["rm", ...names], { stdio: "ignore" });
}

export function resolveSandboxContainerEngine() {
  execFileSync("docker", ["image", "inspect", SANDBOX_IMAGE], { stdio: "ignore" });

  return execFileSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], {
    encoding: "utf8",
  }).trim();
}

export function createSandboxWorkerOptions(
  bundle,
  appBaseUrl,
  apiBaseUrl,
  jwtSecret,
  outboundService,
) {
  return {
    name: SANDBOX_WORKER_NAME,
    modules: [{ type: "ESModule", path: "sandbox.js", contents: bundle.script }],
    compatibilityDate: "2026-08-08",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      APP_BASE_URL: appBaseUrl,
      ENV: "development",
      JWT_SECRET: jwtSecret,
      SANDBOX_INSTANCE_TYPE: "standard-1",
      SANDBOX_TRANSPORT: "rpc",
      SANDBOX_PREVIEW_HOST: `localhost:${new URL(apiBaseUrl).port}`,
    },
    durableObjects: {
      Sandbox: { className: "Sandbox", useSQLite: true, container: { imageName: SANDBOX_IMAGE } },
    },
    r2Buckets: { BACKUP_BUCKET: "PRIVATE_ASSETS_BUCKET" },
    serviceBindings: { POLYCHAT_API: { name: "api" } },
    outboundService,
  };
}

export function mockSandboxGitHubRequest(request) {
  const url = new URL(request.url);

  if (url.hostname !== "api.github.com") {
    return null;
  }

  if (
    request.method === "POST" &&
    url.pathname === `/app/installations/${SANDBOX_INSTALLATION_ID}/access_tokens`
  ) {
    return Response.json({
      token: "ghs_polychat_e2e_fixture_only",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }

  if (request.method === "GET" && url.pathname === "/installation/repositories") {
    return Response.json({
      total_count: SANDBOX_REPOSITORIES.length,
      repositories: SANDBOX_REPOSITORIES.map((repository, index) => {
        const name = repository.split("/").at(-1);

        return {
          id: 987654 + index,
          name,
          full_name: repository,
          private: true,
          default_branch: "main",
          permissions: { admin: true, push: true, pull: true },
        };
      }),
    });
  }

  throw new Error(`Unexpected mocked GitHub request: ${request.method} ${url.pathname}`);
}

export function resolveSandboxModelTool(body) {
  const latestContent = body.messages?.at(-1)?.content;

  if (typeof latestContent === "string" && latestContent.startsWith("Polychat sandbox E2E:")) {
    const repository =
      SANDBOX_REPOSITORIES.toSorted((left, right) => right.length - left.length).find((candidate) =>
        latestContent.includes(candidate.split("/").at(-1)),
      ) ?? SANDBOX_REPOSITORY;

    return {
      id: "e2e-sandbox-dispatch",
      type: "function",
      function: {
        name: "run_sandbox_task",
        arguments: JSON.stringify({
          repo: repository,
          task: latestContent,
          taskType: "documentation",
          shouldCommit: false,
        }),
      },
    };
  }

  if (!body.tools?.some((tool) => tool.function?.name === "run_script")) {
    return null;
  }

  const edited = body.messages?.some(
    (message) =>
      typeof message.content === "string" && message.content.includes("E2E_SANDBOX_EDITED"),
  );
  const python = body.messages?.some(
    (message) => typeof message.content === "string" && message.content.includes("use Python"),
  );
  const failing = body.messages?.some(
    (message) => typeof message.content === "string" && message.content.includes("fail validation"),
  );
  const multiFile = body.messages?.some(
    (message) => typeof message.content === "string" && message.content.includes("multi-file"),
  );
  const content = failing ? "Sandbox E2E invalid." : "Sandbox E2E verified.";
  const holdForControls = body.messages?.some(
    (message) =>
      typeof message.content === "string" && message.content.includes("wait for controls"),
  );
  const holdForServiceControls = body.messages?.some(
    (message) =>
      typeof message.content === "string" && message.content.includes("during service review"),
  );
  const javascriptCode = multiFile
    ? [
        "const fs = require('node:fs')",
        `fs.writeFileSync('config/schema.json', ${JSON.stringify('{\n  "version": 2,\n  "status": "verified"\n}\n')})`,
        `fs.writeFileSync('src/consumer.js', ${JSON.stringify('export const releaseStatus = "verified";\n')})`,
        `fs.writeFileSync('tests/consumer.test.js', ${JSON.stringify('import assert from "node:assert/strict";\n\nimport { releaseStatus } from "../src/consumer.js";\n\nassert.equal(releaseStatus, "verified");\n')})`,
        "fs.writeFileSync('assets/logo.bin', Buffer.from([0, 80, 79, 76, 89, 67, 72, 65, 84]))",
        `fs.appendFileSync('README.md', ${JSON.stringify(`\n${content}\n`)})`,
        "console.log('E2E_SANDBOX_EDITED')",
      ].join("; ")
    : `${holdForControls ? `await new Promise(resolve => setTimeout(resolve, ${holdForServiceControls ? 40000 : 20000})); ` : ""}require('node:fs').appendFileSync('README.md', ${JSON.stringify(`\n${content}\n`)}); console.log('E2E_SANDBOX_EDITED');`;

  return {
    id: edited ? "e2e-sandbox-finish" : "e2e-sandbox-edit",
    type: "function",
    function: edited
      ? {
          name: "finish",
          arguments: JSON.stringify({
            summary: "Updated README for the sandbox validation scenario.",
          }),
        }
      : {
          name: "run_script",
          arguments: JSON.stringify({
            language: python ? "python" : "javascript",
            code: python
              ? `from pathlib import Path\nwith Path('README.md').open('a') as report:\n    report.write(${JSON.stringify(`\n${content}\n`)})\nprint('E2E_SANDBOX_EDITED')`
              : javascriptCode,
          }),
        },
  };
}
