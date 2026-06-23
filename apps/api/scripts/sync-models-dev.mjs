#!/usr/bin/env node

import process from "node:process";
import { parseArgs, printHelp } from "./sync-models-dev/cli.mjs";
import { runSyncModelsDev } from "./sync-models-dev/run-sync.mjs";

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	await runSyncModelsDev(options);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`sync-models-dev failed: ${message}`);
	process.exitCode = 1;
});
