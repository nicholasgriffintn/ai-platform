import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";

import { BedrockService } from "../services/BedrockService.js";
import { S3Service } from "../services/S3Service.js";
import { JobTracker } from "../services/JobTracker.js";
import { config, validateConfig } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";
import type { JobStatus } from "../types/index.js";

const logger = createLogger("job");

export const jobCommand = new Command("job").description(
	"Manage Bedrock fine-tuning jobs",
);

jobCommand
	.command("create")
	.description("Create a new fine-tuning job in AWS Bedrock")
	.requiredOption("--name <name>", "Job name")
	.requiredOption(
		"--base-model <model>",
		"Base model identifier (e.g., amazon.nova-pro-v1:0)",
	)
	.requiredOption("--train-uri <uri>", "S3 URI for training data")
	.option("--val-uri <uri>", "S3 URI for validation data")
	.option("--custom-name <name>", "Custom model name (defaults to job name)")
	.option("--epochs <count>", "Number of epochs (1-5)", "3")
	.option("--learning-rate <rate>", "Learning rate", "0.00001")
	.option("--batch-size <size>", "Batch size", "8")
	.option("--project <name>", "Project name for organization", "strudel")
	.action(async (options) => {
		const spinner = ora("Creating fine-tuning job...").start();

		try {
			// Validate required config
			validateConfig([
				"BEDROCK_ROLE_ARN",
				"BEDROCK_OUTPUT_BUCKET",
				"AWS_ACCESS_KEY_ID",
				"AWS_SECRET_ACCESS_KEY",
			]);

			const bedrockService = new BedrockService();
			const s3Service = new S3Service();

			const customModelName = options.customName || options.name;
			const outputS3Uri = s3Service.getOutputS3Uri(
				options.project,
				options.name,
			);

			spinner.text = "Submitting job to Bedrock...";

			const { jobArn } = await bedrockService.createFineTuningJob({
				jobName: options.name,
				customModelName,
				baseModelIdentifier: options.baseModel,
				trainingDataS3Uri: options.trainUri,
				validationDataS3Uri: options.valUri,
				roleArn: config.BEDROCK_ROLE_ARN!,
				outputDataS3Uri: outputS3Uri,
				hyperParameters: {
					epochCount: options.epochs,
					learningRate: options.learningRate,
					batchSize: options.batchSize,
				},
			});

			// Save to tracker
			const tracker = new JobTracker();
			tracker.saveJob({
				jobArn,
				jobName: options.name,
				baseModel: options.baseModel,
				customModelName,
				status: "InProgress",
				metadata: JSON.stringify({
					project: options.project,
					trainUri: options.trainUri,
					valUri: options.valUri,
					hyperParameters: {
						epochCount: options.epochs,
						learningRate: options.learningRate,
						batchSize: options.batchSize,
					},
				}),
			});
			tracker.close();

			spinner.succeed(chalk.green("Fine-tuning job created!"));

			console.log(chalk.blue("\n📋 Job Details:"));
			console.log(chalk.gray(`  Job ARN: ${jobArn}`));
			console.log(chalk.gray(`  Job Name: ${options.name}`));
			console.log(chalk.gray(`  Base Model: ${options.baseModel}`));
			console.log(chalk.gray(`  Custom Model: ${customModelName}`));
			console.log(chalk.blue("\n⚙️  Hyperparameters:"));
			console.log(chalk.gray(`  Epochs: ${options.epochs}`));
			console.log(chalk.gray(`  Learning Rate: ${options.learningRate}`));
			console.log(chalk.gray(`  Batch Size: ${options.batchSize}`));
			console.log(chalk.blue("\n📊 Next Steps:"));
			console.log(chalk.gray(`  Monitor: finetune job watch ${jobArn}`));
			console.log(chalk.gray(`  Status: finetune job status ${jobArn}`));
		} catch (error) {
			spinner.fail(chalk.red("Failed to create job"));
			logger.error("Job creation failed", error);
			process.exit(1);
		}
	});

/**
 * Get job status
 */
jobCommand
	.command("status <jobArn>")
	.description("Get the status of a fine-tuning job")
	.action(async (jobArn: string) => {
		const spinner = ora("Fetching job status...").start();

		try {
			validateConfig(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);

			const bedrockService = new BedrockService();
			const status = await bedrockService.getJobStatus(jobArn);

			spinner.stop();

			console.log(chalk.blue("\n📋 Job Status:"));
			console.log(chalk.gray(`  Job ARN: ${status.jobArn}`));
			console.log(chalk.gray(`  Job Name: ${status.jobName}`));
			console.log(chalk.gray(`  Status: ${getStatusColor(status.status)}`));

			if (status.message) {
				console.log(chalk.gray(`  Message: ${status.message}`));
			}

			console.log(chalk.blue("\n📅 Timestamps:"));
			if (status.creationTime) {
				console.log(
					chalk.gray(`  Created: ${status.creationTime.toLocaleString()}`),
				);
			}
			if (status.lastModifiedTime) {
				console.log(
					chalk.gray(
						`  Last Modified: ${status.lastModifiedTime.toLocaleString()}`,
					),
				);
			}
			if (status.endTime) {
				console.log(chalk.gray(`  Ended: ${status.endTime.toLocaleString()}`));
			}

			if (status.trainingMetrics) {
				console.log(chalk.blue("\n📊 Training Metrics:"));
				console.log(
					chalk.gray(
						`  Loss: ${status.trainingMetrics.trainingLoss?.toFixed(4) || "N/A"}`,
					),
				);
			}

			if (status.validationMetrics) {
				console.log(chalk.blue("\n📊 Validation Metrics:"));
				console.log(
					chalk.gray(
						`  Loss: ${status.validationMetrics.validationLoss?.toFixed(4) || "N/A"}`,
					),
				);
			}

			if (status.status === "Completed" && status.outputDataConfig) {
				console.log(chalk.blue("\n📦 Output:"));
				console.log(chalk.gray(`  S3 URI: ${status.outputDataConfig.s3Uri}`));
				console.log(
					chalk.green(
						"\n✓ Job completed! Next step: Provision throughput in AWS Console",
					),
				);
			}
		} catch (error) {
			spinner.fail(chalk.red("Failed to get job status"));
			logger.error("Status check failed", error);
			process.exit(1);
		}
	});

/**
 * Watch job progress
 */
jobCommand
	.command("watch <jobArn>")
	.description("Watch a fine-tuning job until completion")
	.option("--interval <seconds>", "Polling interval in seconds", "30")
	.action(async (jobArn: string, options) => {
		console.log(chalk.blue("👀 Watching job progress...\n"));

		try {
			validateConfig(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);

			const bedrockService = new BedrockService();
			const tracker = new JobTracker();
			const intervalMs = parseInt(options.interval) * 1000;

			const finalStatus = await bedrockService.waitForJobCompletion(
				jobArn,
				intervalMs,
				(status: JobStatus) => {
					// Update tracker
					tracker.updateJobStatus(jobArn, status.status);

					// Print progress
					console.log(
						chalk.gray(
							`[${new Date().toLocaleTimeString()}] Status: ${getStatusColor(status.status)}`,
						),
					);

					if (status.trainingMetrics?.trainingLoss) {
						console.log(
							chalk.gray(
								`  Training Loss: ${status.trainingMetrics.trainingLoss.toFixed(4)}`,
							),
						);
					}

					if (status.validationMetrics?.validationLoss) {
						console.log(
							chalk.gray(
								`  Validation Loss: ${status.validationMetrics.validationLoss.toFixed(4)}`,
							),
						);
					}

					console.log("");
				},
			);

			tracker.close();

			console.log(chalk.green("\n✓ Job completed successfully!"));
			console.log(chalk.blue("\n📦 Output:"));
			console.log(
				chalk.gray(`  S3 URI: ${finalStatus.outputDataConfig?.s3Uri}`),
			);
			console.log(chalk.blue("\n📋 Next Steps:"));
			console.log(
				chalk.gray("  1. Provision throughput in AWS Bedrock Console"),
			);
			console.log(
				chalk.gray(
					"  2. Test the model: finetune model test <provisioned-model-arn>",
				),
			);
		} catch (error) {
			logger.error("Job watch failed", error);
			process.exit(1);
		}
	});

/**
 * List all jobs
 */
jobCommand
	.command("list")
	.description("List all fine-tuning jobs")
	.option("--limit <number>", "Maximum number of jobs to list", "50")
	.option("--local", "Show only local tracked jobs")
	.action(async (options) => {
		const spinner = ora("Fetching jobs...").start();

		try {
			if (options.local) {
				const tracker = new JobTracker();
				const jobs = tracker.listJobs(parseInt(options.limit));
				tracker.close();

				spinner.stop();

				if (jobs.length === 0) {
					console.log(chalk.yellow("No jobs found in local database"));
					return;
				}

				console.log(chalk.blue(`\n📋 Local Jobs (${jobs.length}):\n`));
				jobs.forEach((job) => {
					console.log(chalk.bold(job.jobName));
					console.log(chalk.gray(`  ARN: ${job.jobArn}`));
					console.log(chalk.gray(`  Status: ${getStatusColor(job.status)}`));
					console.log(chalk.gray(`  Base Model: ${job.baseModel}`));
					console.log(
						chalk.gray(
							`  Created: ${new Date(job.createdAt).toLocaleString()}`,
						),
					);
					console.log("");
				});
			} else {
				validateConfig(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);

				const bedrockService = new BedrockService();
				const jobs = await bedrockService.listJobs(parseInt(options.limit));

				spinner.stop();

				if (jobs.length === 0) {
					console.log(chalk.yellow("No jobs found in Bedrock"));
					return;
				}

				console.log(chalk.blue(`\n📋 Bedrock Jobs (${jobs.length}):\n`));
				jobs.forEach((job) => {
					console.log(chalk.bold(job.jobName));
					console.log(chalk.gray(`  ARN: ${job.jobArn}`));
					console.log(
						chalk.gray(`  Status: ${getStatusColor(job.status || "Unknown")}`),
					);
					console.log(chalk.gray(`  Base Model: ${job.baseModelArn}`));
					if (job.creationTime) {
						console.log(
							chalk.gray(`  Created: ${job.creationTime.toLocaleString()}`),
						);
					}
					console.log("");
				});
			}
		} catch (error) {
			spinner.fail(chalk.red("Failed to list jobs"));
			logger.error("List failed", error);
			process.exit(1);
		}
	});

/**
 * Stop a running job
 */
jobCommand
	.command("stop <jobArn>")
	.description("Stop a running fine-tuning job")
	.action(async (jobArn: string) => {
		const spinner = ora("Stopping job...").start();

		try {
			validateConfig(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);

			const bedrockService = new BedrockService();
			await bedrockService.stopJob(jobArn);

			const tracker = new JobTracker();
			tracker.updateJobStatus(jobArn, "Stopping");
			tracker.close();

			spinner.succeed(chalk.green("Stop request sent"));
			console.log(
				chalk.gray(
					"\nThe job will stop shortly. Check status with: finetune job status " +
						jobArn,
				),
			);
		} catch (error) {
			spinner.fail(chalk.red("Failed to stop job"));
			logger.error("Stop failed", error);
			process.exit(1);
		}
	});

function getStatusColor(status: string): string {
	switch (status) {
		case "Completed":
			return chalk.green(status);
		case "InProgress":
			return chalk.blue(status);
		case "Failed":
			return chalk.red(status);
		case "Stopped":
		case "Stopping":
			return chalk.yellow(status);
		default:
			return chalk.gray(status);
	}
}
