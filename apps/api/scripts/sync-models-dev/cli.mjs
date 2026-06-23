import path from "node:path";
import process from "node:process";
import { API_URL_DEFAULT, POLYCHAT_API_BASE_URL_DEFAULT } from "./constants.mjs";
import { DEFAULT_MODELS_DIR } from "./paths.mjs";

export function parseArgs(argv) {
	const options = {
		apiUrl: API_URL_DEFAULT,
		modelsDir: DEFAULT_MODELS_DIR,
		write: false,
		verbose: false,
		help: false,
		providers: new Set(),
		triggerAnalysisTask: process.env.POLYCHAT_MODEL_ANALYSIS_TRIGGER === "true",
		polychatApiBaseUrl: process.env.POLYCHAT_API_BASE_URL || POLYCHAT_API_BASE_URL_DEFAULT,
		polychatApiKey: process.env.POLYCHAT_API_KEY,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];

		if (arg === "--write") {
			options.write = true;
			continue;
		}

		if (arg === "--verbose") {
			options.verbose = true;
			continue;
		}

		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}

		if (arg === "--provider") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("Missing value for --provider");
			}
			options.providers.add(value);
			i += 1;
			continue;
		}

		if (arg.startsWith("--provider=")) {
			options.providers.add(arg.slice("--provider=".length));
			continue;
		}

		if (arg === "--api-url") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("Missing value for --api-url");
			}
			options.apiUrl = value;
			i += 1;
			continue;
		}

		if (arg.startsWith("--api-url=")) {
			options.apiUrl = arg.slice("--api-url=".length);
			continue;
		}

		if (arg === "--models-dir") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("Missing value for --models-dir");
			}
			options.modelsDir = path.resolve(value);
			i += 1;
			continue;
		}

		if (arg.startsWith("--models-dir=")) {
			options.modelsDir = path.resolve(arg.slice("--models-dir=".length));
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

export function printHelp() {
	console.log(`Sync provider model configs from models.dev.

Usage:
  node scripts/sync-models-dev.mjs [options]

Options:
  --write                 Apply changes to files (default is dry run)
  --provider <id>         Only process a local provider (repeatable)
  --api-url <url>         Override models.dev API URL
  --models-dir <path>     Override model config directory
  --verbose               Print per-file details
  --help, -h              Show this help

Environment:
  POLYCHAT_API_BASE_URL   Polychat API base URL (defaults to ${POLYCHAT_API_BASE_URL_DEFAULT})
  POLYCHAT_API_KEY        API key used for cached Artificial Analysis data and the trigger
`);
}
