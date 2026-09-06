import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { SANDBOX_IMAGE } from "./sandbox-runtime.mjs";

execFileSync(
  "docker",
  [
    "build",
    "--platform",
    "linux/amd64",
    "--tag",
    "polychat-e2e-sandbox-base:0.12.9",
    fileURLToPath(new URL("../../../../sandbox-worker", import.meta.url)),
  ],
  { stdio: "inherit" },
);

execFileSync(
  "docker",
  [
    "build",
    "--platform",
    "linux/amd64",
    "--tag",
    SANDBOX_IMAGE,
    "--build-arg",
    "GIT_AUTHOR_NAME",
    "--build-arg",
    "GIT_AUTHOR_EMAIL",
    "--build-arg",
    "GIT_COMMITTER_NAME",
    "--build-arg",
    "GIT_COMMITTER_EMAIL",
    fileURLToPath(new URL("./sandbox", import.meta.url)),
  ],
  { stdio: "inherit" },
);
