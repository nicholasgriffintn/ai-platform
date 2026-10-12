#!/usr/bin/env node
import { createRequire } from "node:module";
import { hostname } from "node:os";
import { parseArgs } from "node:util";

import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { resolveApiBaseUrl } from "./api-base-url.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { status } from "./commands/status.js";
import { token } from "./commands/token.js";
import type { CommandContext } from "./context.js";
import { credentialsPath } from "./credentials.js";
import { CliError } from "./errors.js";

const CLIENT_NAME_MAX_LENGTH = 80;

const HELP = `Usage: polychat <command> [options]

Commands
  login     Pair this machine with your account using a device code
  status    Show which account the saved key belongs to
  token     Print the saved API key, for scripts and gateway config
  logout    Forget the saved key on this machine

Options
  --api <url>      Polychat API address (default: $POLYCHAT_API_URL or https://api.polychat.app)
  --name <name>    Name for the key, shown when you approve it (login only)
  --no-browser     Print the approval link instead of opening it (login only)
  -h, --help       Show this help
  -v, --version    Show the version`;

function readVersion(): string {
  const manifest: unknown = createRequire(import.meta.url)("../package.json");

  return typeof manifest === "object" && manifest && "version" in manifest
    ? String(manifest.version)
    : "unknown";
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      api: { type: "string" },
      name: { type: "string" },
      "no-browser": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (values.version) {
    process.stdout.write(`${readVersion()}\n`);

    return;
  }

  const [command] = positionals;

  if (values.help || !command) {
    process.stdout.write(`${HELP}\n`);

    return;
  }

  const context: CommandContext = {
    apiBaseUrl: resolveApiBaseUrl(values.api ?? process.env.POLYCHAT_API_URL),
    credentialsPath: credentialsPath(),
    fetch: globalThis.fetch,
    out: (line) => process.stdout.write(`${line}\n`),
    info: (line) => process.stderr.write(`${line}\n`),
  };

  switch (command) {
    case "login":
      return login(context, {
        clientName: (values.name?.trim() || `polychat CLI on ${hostname()}`).slice(
          0,
          CLIENT_NAME_MAX_LENGTH,
        ),
        openBrowser: !values["no-browser"],
      });
    case "status":
      return status(context);
    case "token":
      return token(context);
    case "logout":
      return logout(context);
    default:
      throw new CliError(`Unknown command "${command}". Run polychat --help for the list.`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`polychat: ${getErrorMessage(error, "something went wrong")}\n`);
  process.exitCode = 1;
});
