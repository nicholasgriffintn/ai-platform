import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const id = randomUUID().slice(0, 8);
const engine = `polychat-e2e-engine-${id}`;
const runner = `polychat-e2e-runner-${id}`;
const staging = mkdtempSync(path.join(tmpdir(), "polychat-e2e-"));
const image = "polychat-e2e-runner:1.62.1";

function command(program, args, options = {}) {
  const result = spawnSync(program, args, { cwd: root, stdio: "inherit", ...options });

  if (result.status !== 0) {
    throw new Error(`${program} failed (${result.status ?? result.error?.message})`);
  }
}

function cleanup() {
  spawnSync("docker", ["rm", "-f", runner, engine], { stdio: "ignore" });
  rmSync(staging, { recursive: true, force: true });
}

process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  command("docker", ["build", "-t", image, "apps/app/tests/e2e/runtime/container"]);
  const tracked = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" },
  );

  if (tracked.status !== 0) {
    throw new Error("Could not snapshot the repository");
  }

  const files = tracked.stdout
    .split("\0")
    .filter((file) => file && existsSync(path.join(root, file)));

  writeFileSync(path.join(staging, "files"), files.join("\0"));
  command(
    "tar",
    ["--null", "-T", path.join(staging, "files"), "-czf", path.join(staging, "source.tar.gz")],
    { env: { ...process.env, COPYFILE_DISABLE: "1" } },
  );
  command("docker", [
    "run",
    "-d",
    "--name",
    engine,
    "--privileged",
    "-e",
    "DOCKER_TLS_CERTDIR=",
    "docker:28-dind",
  ]);
  command("docker", [
    "run",
    "-d",
    "--name",
    runner,
    "--network",
    `container:${engine}`,
    "--shm-size=1g",
    "-e",
    "DOCKER_HOST=tcp://127.0.0.1:2375",
    "-e",
    "CI=1",
    "-e",
    "GIT_AUTHOR_NAME",
    "-e",
    "GIT_AUTHOR_EMAIL",
    "-e",
    "GIT_COMMITTER_NAME",
    "-e",
    "GIT_COMMITTER_EMAIL",
    "-v",
    "polychat-e2e-pnpm:/pnpm-store",
    image,
    "sleep",
    "infinity",
  ]);
  command("docker", ["cp", path.join(staging, "source.tar.gz"), `${runner}:/tmp/source.tar.gz`]);
  command("docker", ["exec", runner, "tar", "-xzf", "/tmp/source.tar.gz", "-C", "/workspace"]);
  command("docker", [
    "exec",
    runner,
    "pnpm",
    "install",
    "--frozen-lockfile",
    "--store-dir",
    "/pnpm-store",
  ]);
  command("docker", ["exec", runner, "pnpm", "build:e2e"]);
  if (process.env.POLYCHAT_E2E_LIVE_RUNTIMES) {
    command("docker", [
      "exec",
      runner,
      "docker",
      "run",
      "-d",
      "--name",
      "ollama",
      "--network",
      "host",
      "ollama/ollama:latest",
    ]);
    command("docker", ["exec", runner, "docker", "exec", "ollama", "ollama", "pull", "gemma3:1b"]);
  }

  const child = spawn(
    "docker",
    [
      "exec",
      "-e",
      `POLYCHAT_E2E_LIVE_RUNTIMES=${process.env.POLYCHAT_E2E_LIVE_RUNTIMES ?? ""}`,
      runner,
      "pnpm",
      "test:e2e",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
  const status = await new Promise((resolve) => child.once("exit", resolve));

  const results = path.join(root, "test-results", "container", id);

  mkdirSync(results, { recursive: true });
  spawnSync("docker", ["cp", `${runner}:/workspace/test-results/.`, results], { stdio: "inherit" });
  if (status !== 0) {
    process.exitCode = 1;
  }
} finally {
  cleanup();
}
