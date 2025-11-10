#!/usr/bin/env node

import { Command } from "commander";
import { datasetCommand } from "./commands/dataset.js";
import { jobCommand } from "./commands/job.js";
import { modelCommand } from "./commands/model.js";
import { dbCommand } from "./commands/db.js";
import chalk from "chalk";

const program = new Command();

program
	.name("finetune")
	.description("AWS Bedrock Fine-Tuning Toolkit for Custom Model Training")
	.version("0.0.1");

console.log(chalk.blue.bold("\n🔧 Polychat - Bedrock Fine-Tuning Toolkit\n"));

program.addCommand(dbCommand);
program.addCommand(datasetCommand);
program.addCommand(jobCommand);
program.addCommand(modelCommand);

program.on("--help", () => {
	console.log("");
	console.log(chalk.blue("Examples:"));
	console.log(chalk.gray("  # Generate a dataset"));
	console.log(
		chalk.gray(
			"  $ finetune dataset generate --count 300 --output ./datasets/strudel",
		),
	);
	console.log("");
	console.log(chalk.gray("  # Validate dataset"));
	console.log(
		chalk.gray(
			"  $ finetune dataset validate --train ./datasets/strudel/train.jsonl",
		),
	);
	console.log("");
	console.log(chalk.gray("  # Upload to S3"));
	console.log(
		chalk.gray(
			"  $ finetune dataset upload --train ./datasets/strudel/train.jsonl --validation ./datasets/strudel/validation.jsonl",
		),
	);
	console.log("");
	console.log(chalk.gray("  # Create fine-tuning job"));
	console.log(
		chalk.gray(
			"  $ finetune job create --name my-strudel-model --base-model amazon.nova-pro-v1:0 --train-uri s3://...",
		),
	);
	console.log("");
	console.log(chalk.gray("  # Watch job progress"));
	console.log(chalk.gray("  $ finetune job watch <job-arn>"));
	console.log("");
	console.log(chalk.blue("Documentation:"));
	console.log(chalk.gray("  See README.md for complete documentation"));
	console.log("");
});

program.parse();
