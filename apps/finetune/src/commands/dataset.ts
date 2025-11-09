import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { readFileSync } from "node:fs";

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
	.action(async (options) => {
		const spinner = ora("Initializing dataset generation...").start();

		try {
			const count = parseInt(options.count);
			const styles = options.styles.split(",").map((s: string) => s.trim());
			const complexities = options.complexities
				.split(",")
				.map((c: string) => c.trim());

			spinner.text = `Generating ${count} examples via ${options.apiUrl}...`;

			const generator = new StrudelGenerator();
			const examples = await generator.generate({
				apiUrl: options.apiUrl,
				apiKey: options.apiKey,
				count,
				styles,
				complexities,
				model: options.model,
			});

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
