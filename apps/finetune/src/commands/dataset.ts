import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { readFileSync, existsSync } from "node:fs";

import { StrudelGenerator } from "../generators/StrudelGenerator.js";
import { DatasetFormatter } from "../formatters/DatasetFormatter.js";
import { S3Service } from "../services/S3Service.js";
import { JobTracker } from "../services/JobTracker.js";
import { config, validateConfig } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";
import type { TrainingExample } from "../types/index.js";

const logger = createLogger("dataset");

export const datasetCommand = new Command("dataset").description(
	"Manage training datasets",
);

datasetCommand
	.command("generate")
	.description("Generate synthetic Strudel training data by calling your API")
	.option("-c, --count <number>", "Number of examples to generate", "300")
	.option("-o, --output <path>", "Output directory", "./datasets/strudel")
	.option(
		"-m, --model <model>",
		"Model to use for generation",
		"claude-sonnet-4-20250514",
	)
	.option("--api-url <url>", "API URL", config.API_URL)
	.option("--api-key <key>", "API key", config.API_KEY)
	.option(
		"--styles <styles>",
		"Comma-separated list of styles",
		"techno,house,ambient,jazz,drums,experimental",
	)
	.option(
		"--complexities <complexities>",
		"Comma-separated list of complexities",
		"simple,medium,complex",
	)
	.option("--resume", "Resume from existing progress file if available", false)
	.action(async (options) => {
		const spinner = ora("Initializing dataset generation...").start();

		let isInterrupted = false;
		const handleInterrupt = () => {
			if (!isInterrupted) {
				isInterrupted = true;
				spinner.warn(chalk.yellow("\n\nInterrupted! Progress has been saved."));
				console.log(
					chalk.gray(
						`Run the same command with --resume to continue from where you left off.`,
					),
				);
				process.exit(0);
			}
		};
		process.on("SIGINT", handleInterrupt);

		try {
			const count = parseInt(options.count);
			const styles = options.styles.split(",").map((s: string) => s.trim());
			const complexities = options.complexities
				.split(",")
				.map((c: string) => c.trim());

			const progressFile = `${options.output}/.progress.jsonl`;
			if (options.resume && existsSync(progressFile)) {
				spinner.text = "Found existing progress, resuming...";
			} else {
				spinner.text = `Generating ${count} examples via ${options.apiUrl}...`;
			}

			const generator = new StrudelGenerator();
			const examples = await generator.generate({
				apiUrl: options.apiUrl,
				apiKey: options.apiKey,
				count,
				styles,
				complexities,
				model: options.model,
				outputDir: options.output,
			});

			process.removeListener("SIGINT", handleInterrupt);

			spinner.text = "Analyzing dataset...";
			const formatter = new DatasetFormatter();
			const analysis = formatter.analyzeDataset(examples);

			spinner.text = "Splitting into train/validation sets...";
			const { train, validation } = formatter.splitAndFormat(examples, 0.8);

			spinner.text = "Saving to disk...";
			const { trainPath, validationPath } = await formatter.saveDataset(
				options.output,
				train,
				validation,
			);

			spinner.succeed(chalk.green("Dataset generation complete!"));

			console.log(chalk.blue("\n📊 Dataset Summary:"));
			console.log(chalk.gray(`  Total examples: ${analysis.totalExamples}`));
			console.log(chalk.gray(`  Training: ${train.length} examples`));
			console.log(chalk.gray(`  Validation: ${validation.length} examples`));
			console.log(
				chalk.gray(`  Avg tokens/example: ${analysis.avgTokensPerExample}`),
			);
			console.log(chalk.blue("\n📁 Files:"));
			console.log(chalk.gray(`  Training: ${trainPath}`));
			console.log(chalk.gray(`  Validation: ${validationPath}`));

			const tracker = new JobTracker();
			tracker.saveDataset({
				project: "strudel",
				trainPath,
				validationPath,
			});
			tracker.close();
		} catch (error) {
			spinner.fail(chalk.red("Failed to generate dataset"));
			logger.error("Generation failed", error);
			process.exit(1);
		}
	});

datasetCommand
	.command("validate")
	.description("Validate dataset format for Bedrock")
	.requiredOption("--train <path>", "Path to training JSONL file")
	.option("--validation <path>", "Path to validation JSONL file")
	.action(async (options) => {
		const spinner = ora("Validating dataset...").start();

		try {
			const trainContent = readFileSync(options.train, "utf-8");
			const trainExamples: TrainingExample[] = trainContent
				.split("\n")
				.filter((line) => line.trim())
				.map((line) => JSON.parse(line));

			let validationExamples: TrainingExample[] = [];
			if (options.validation) {
				const validationContent = readFileSync(options.validation, "utf-8");
				validationExamples = validationContent
					.split("\n")
					.filter((line) => line.trim())
					.map((line) => JSON.parse(line));
			}

			const formatter = new DatasetFormatter();

			spinner.text = "Validating training set...";
			const trainValidation = formatter.validateDataset(trainExamples);

			let validationValidation = null;
			if (validationExamples.length > 0) {
				spinner.text = "Validating validation set...";
				validationValidation = formatter.validateDataset(validationExamples);
			}

			const analysis = formatter.analyzeDataset([
				...trainExamples,
				...validationExamples,
			]);

			if (
				trainValidation.valid &&
				(!validationValidation || validationValidation.valid)
			) {
				spinner.succeed(chalk.green("Validation passed!"));
			} else {
				spinner.fail(chalk.red("Validation failed"));
			}

			console.log(chalk.blue("\n📊 Dataset Statistics:"));
			console.log(chalk.gray(`  Total examples: ${analysis.totalExamples}`));
			console.log(chalk.gray(`  Training: ${trainExamples.length}`));
			if (validationExamples.length > 0) {
				console.log(chalk.gray(`  Validation: ${validationExamples.length}`));
			}
			console.log(
				chalk.gray(`  Avg tokens/example: ${analysis.avgTokensPerExample}`),
			);

			if (Object.keys(analysis.styleDistribution).length > 0) {
				console.log(chalk.blue("\n🎵 Style Distribution:"));
				for (const [style, count] of Object.entries(
					analysis.styleDistribution,
				)) {
					console.log(chalk.gray(`  ${style}: ${count}`));
				}
			}

			if (Object.keys(analysis.complexityDistribution).length > 0) {
				console.log(chalk.blue("\n📈 Complexity Distribution:"));
				for (const [complexity, count] of Object.entries(
					analysis.complexityDistribution,
				)) {
					console.log(chalk.gray(`  ${complexity}: ${count}`));
				}
			}

			if (trainValidation.errors.length > 0) {
				console.log(chalk.red("\n❌ Errors:"));
				trainValidation.errors.forEach((error) =>
					console.log(chalk.red(`  ${error}`)),
				);
			}

			if (trainValidation.warnings.length > 0) {
				console.log(chalk.yellow("\n⚠️  Warnings:"));
				trainValidation.warnings.forEach((warning) =>
					console.log(chalk.yellow(`  ${warning}`)),
				);
			}

			if (!trainValidation.valid) {
				process.exit(1);
			}
		} catch (error) {
			spinner.fail(chalk.red("Validation failed"));
			logger.error("Validation error", error);
			process.exit(1);
		}
	});

datasetCommand
	.command("upload")
	.description("Upload dataset to S3 for Bedrock fine-tuning")
	.requiredOption("--train <path>", "Path to training JSONL file")
	.requiredOption("--validation <path>", "Path to validation JSONL file")
	.option("--project <name>", "Project name", "strudel")
	.action(async (options) => {
		const spinner = ora("Uploading dataset to S3...").start();

		try {
			validateConfig([
				"BEDROCK_TRAINING_BUCKET",
				"AWS_ACCESS_KEY_ID",
				"AWS_SECRET_ACCESS_KEY",
			]);

			const s3Service = new S3Service();

			const { trainS3Uri, validationS3Uri } = await s3Service.uploadDatasets(
				options.train,
				options.validation,
				options.project,
			);

			spinner.succeed(chalk.green("Upload complete!"));

			console.log(chalk.blue("\n📦 S3 URIs:"));
			console.log(chalk.gray(`  Training: ${trainS3Uri}`));
			console.log(chalk.gray(`  Validation: ${validationS3Uri}`));

			const tracker = new JobTracker();
			tracker.saveDataset({
				project: options.project,
				trainPath: options.train,
				validationPath: options.validation,
				s3Uri: trainS3Uri,
			});
			tracker.close();

			console.log(
				chalk.green("\n✓ Use these URIs when creating a fine-tuning job"),
			);
		} catch (error) {
			spinner.fail(chalk.red("Upload failed"));
			logger.error("Upload error", error);
			process.exit(1);
		}
	});

datasetCommand
	.command("export")
	.description("Export training examples from D1 database")
	.option("-o, --output <path>", "Output directory", "./datasets/production")
	.option("--db <name>", "D1 database name", "personal-assistant")
	.option("--remote", "Export from remote database (default: local)")
	.option("--source <source>", "Filter by source (chat or app)")
	.option("--app-name <name>", "Filter by app name (e.g., strudel)")
	.option("--min-rating <rating>", "Minimum feedback rating")
	.option("--since <date>", "Export examples since date (ISO format)")
	.option("--limit <number>", "Maximum number of examples to export")
	.option("--project <name>", "Project name for tracking", "production")
	.action(async (options) => {
		const spinner = ora("Querying D1 database...").start();

		try {
			const { execSync } = await import("node:child_process");

			let query = `SELECT * FROM training_examples WHERE exported = 0 AND include_in_training = 1`;
			const conditions: string[] = [];

			if (options.source) {
				conditions.push(`source = '${options.source}'`);
			}
			if (options.appName) {
				conditions.push(`app_name = '${options.appName}'`);
			}
			if (options.minRating) {
				conditions.push(`feedback_rating >= ${options.minRating}`);
			}
			if (options.since) {
				conditions.push(`created_at >= '${options.since}'`);
			}

			if (conditions.length > 0) {
				query += ` AND ${conditions.join(" AND ")}`;
			}

			query += " ORDER BY created_at DESC";

			if (options.limit) {
				query += ` LIMIT ${options.limit}`;
			}

			const remoteFlag = options.remote ? "--remote" : "--local";
			const cmd = `wrangler d1 execute ${options.db} ${remoteFlag} --command="${query}" --json`;

			spinner.text = `Executing query on ${options.remote ? "remote" : "local"} database...`;

			const result = execSync(cmd, { encoding: "utf-8" });
			const data = JSON.parse(result);

			const examples = data[0]?.results || [];

			if (examples.length === 0) {
				spinner.warn(chalk.yellow("No training examples found"));
				return;
			}

			spinner.text = `Processing ${examples.length} examples...`;

			const bedrockExamples = examples.map((ex: any) => ({
				schemaVersion: "bedrock-conversation-2024",
				system: ex.system_prompt
					? [{ text: ex.system_prompt }]
					: [{ text: "You are a helpful AI assistant." }],
				messages: [
					{ role: "user", content: [{ text: ex.user_prompt }] },
					{ role: "assistant", content: [{ text: ex.assistant_response }] },
				],
			}));

			spinner.text = "Analyzing dataset...";
			const formatter = new DatasetFormatter();
			const analysis = formatter.analyzeDataset(bedrockExamples);

			spinner.text = "Splitting into train/validation sets...";
			const { train, validation } = formatter.splitAndFormat(
				bedrockExamples,
				0.8,
			);

			spinner.text = "Saving to disk...";
			const { trainPath, validationPath } = await formatter.saveDataset(
				options.output,
				train,
				validation,
			);

			spinner.succeed(chalk.green("Export complete!"));

			console.log(chalk.blue("\n📊 Dataset Summary:"));
			console.log(chalk.gray(`  Total examples: ${analysis.totalExamples}`));
			console.log(chalk.gray(`  Training: ${train.length} examples`));
			console.log(chalk.gray(`  Validation: ${validation.length} examples`));
			console.log(
				chalk.gray(`  Avg tokens/example: ${analysis.avgTokensPerExample}`),
			);

			if (options.source) {
				console.log(chalk.gray(`  Source: ${options.source}`));
			}
			if (options.appName) {
				console.log(chalk.gray(`  App: ${options.appName}`));
			}

			console.log(chalk.blue("\n📁 Files:"));
			console.log(chalk.gray(`  Training: ${trainPath}`));
			console.log(chalk.gray(`  Validation: ${validationPath}`));

			const tracker = new JobTracker();
			tracker.saveDataset({
				project: options.project,
				trainPath,
				validationPath,
			});
			tracker.close();

			const exampleIds = examples.map((ex: any) => ex.id).join("','");
			if (exampleIds) {
				spinner.start("Marking examples as exported...");
				const updateCmd = `wrangler d1 execute ${options.db} ${remoteFlag} --command="UPDATE training_examples SET exported = 1, exported_at = datetime('now') WHERE id IN ('${exampleIds}')"`;
				execSync(updateCmd, { encoding: "utf-8" });
				spinner.succeed(chalk.green("Examples marked as exported"));
			}
		} catch (error) {
			spinner.fail(chalk.red("Export failed"));
			logger.error("Export error", error);
			process.exit(1);
		}
	});
