import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { JobTracker } from "../services/JobTracker.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("db");

export const dbCommand = new Command("db").description(
	"Database management commands",
);

dbCommand
	.command("init")
	.description("Initialize the SQLite database with required tables")
	.option("-p, --path <path>", "Database file path", "./datasets/.finetune.db")
	.option(
		"-f, --force",
		"Reinitialize database even if it already exists",
		false,
	)
	.action(async (options) => {
		try {
			const dbPath = resolve(options.path);
			const dbExists = existsSync(dbPath);

			if (dbExists && !options.force) {
				console.log(
					chalk.yellow(`\n⚠️  Database already exists at: ${dbPath}`),
				);
				console.log(chalk.gray("   Use --force to reinitialize\n"));
				return;
			}

			if (dbExists && options.force) {
				console.log(
					chalk.yellow(`\n🔄 Reinitializing existing database at: ${dbPath}\n`),
				);
			} else {
				console.log(
					chalk.blue(`\n📦 Initializing new database at: ${dbPath}\n`),
				);
			}

			const tracker = new JobTracker(dbPath);

			console.log(chalk.green("✓ Created table: jobs"));
			console.log(chalk.green("✓ Created table: datasets"));
			console.log(chalk.green("✓ Created indexes"));

			tracker.close();

			console.log(chalk.green.bold("\n✓ Database initialized successfully!\n"));
			console.log(chalk.gray("You can now use the finetune CLI to:"));
			console.log(
				chalk.gray("  • Generate datasets: finetune dataset generate"),
			);
			console.log(chalk.gray("  • Upload to S3: finetune dataset upload"));
			console.log(chalk.gray("  • Create jobs: finetune job create"));
			console.log("");
		} catch (error) {
			console.error(chalk.red("\n✗ Failed to initialize database:"));
			console.error(
				chalk.red(
					`  ${error instanceof Error ? error.message : String(error)}\n`,
				),
			);
			logger.error("Database initialization failed", error);
			process.exit(1);
		}
	});
