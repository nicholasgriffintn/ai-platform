import { writeFileSync, mkdirSync, existsSync } from "node:fs";

import type { TrainingExample } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("DatasetFormatter");

export class DatasetFormatter {
	splitAndFormat(
		examples: TrainingExample[],
		trainRatio: number = 0.8,
	): { train: TrainingExample[]; validation: TrainingExample[] } {
		logger.info(
			`Splitting ${examples.length} examples (${trainRatio * 100}% train)`,
		);

		const shuffled = [...examples];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		const trainCount = Math.floor(examples.length * trainRatio);
		const train = shuffled.slice(0, trainCount);
		const validation = shuffled.slice(trainCount);

		logger.success(
			`Split complete: ${train.length} train, ${validation.length} validation`,
		);

		return { train, validation };
	}

	validateDataset(examples: TrainingExample[]): {
		valid: boolean;
		errors: string[];
		warnings: string[];
	} {
		logger.info(`Validating ${examples.length} examples...`);

		const errors: string[] = [];
		const warnings: string[] = [];

		if (examples.length < 100) {
			warnings.push(
				`Dataset has ${examples.length} examples. Amazon Nova Pro requires minimum 100 examples for fine-tuning.`,
			);
		}

		examples.forEach((example, index) => {
			if (example.schemaVersion !== "bedrock-conversation-2024") {
				errors.push(
					`Example ${index}: Invalid schema version. Expected 'bedrock-conversation-2024', got '${example.schemaVersion}'`,
				);
			}

			if (!example.system || example.system.length === 0) {
				errors.push(`Example ${index}: Missing system prompt`);
			}

			if (!example.messages || example.messages.length === 0) {
				errors.push(`Example ${index}: Missing messages array`);
			} else {
				if (example.messages[0]?.role !== "user") {
					errors.push(
						`Example ${index}: First message should be 'user', got '${example.messages[0]?.role}'`,
					);
				}

				const lastMessage = example.messages[example.messages.length - 1];
				if (lastMessage?.role !== "assistant") {
					errors.push(
						`Example ${index}: Last message should be 'assistant', got '${lastMessage?.role}'`,
					);
				}

				const totalText = example.messages
					.map((msg) => msg.content.map((c) => c.text).join(" "))
					.join(" ");
				const estimatedTokens = totalText.split(/\s+/).length;

				if (estimatedTokens > 2000) {
					warnings.push(
						`Example ${index}: Estimated ${estimatedTokens} tokens (may exceed limits)`,
					);
				}
			}
		});

		const valid = errors.length === 0;

		if (valid) {
			logger.success("Validation passed");
		} else {
			logger.error(`Validation failed with ${errors.length} errors`);
		}

		if (warnings.length > 0) {
			logger.warn(`Found ${warnings.length} warnings`);
		}

		return { valid, errors, warnings };
	}

	toJSONL(examples: TrainingExample[]): string {
		return examples.map((example) => JSON.stringify(example)).join("\n");
	}

	async saveDataset(
		outputDir: string,
		train: TrainingExample[],
		validation: TrainingExample[],
	): Promise<{ trainPath: string; validationPath: string }> {
		logger.info(`Saving dataset to ${outputDir}...`);

		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}

		const trainPath = `${outputDir}/train.jsonl`;
		const validationPath = `${outputDir}/validation.jsonl`;

		const trainJSONL = this.toJSONL(train);
		const validationJSONL = this.toJSONL(validation);

		writeFileSync(trainPath, trainJSONL, "utf-8");
		writeFileSync(validationPath, validationJSONL, "utf-8");

		logger.success(
			`Saved training set: ${trainPath} (${train.length} examples)`,
		);
		logger.success(
			`Saved validation set: ${validationPath} (${validation.length} examples)`,
		);

		return { trainPath, validationPath };
	}

	analyzeDataset(examples: TrainingExample[]): {
		totalExamples: number;
		avgTokensPerExample: number;
		styleDistribution: Record<string, number>;
		complexityDistribution: Record<string, number>;
	} {
		logger.info("Analyzing dataset distribution...");

		const styleDistribution: Record<string, number> = {};
		const complexityDistribution: Record<string, number> = {};
		let totalTokens = 0;

		examples.forEach((example) => {
			const systemText = example.system[0]?.text || "";
			const styleMatch = systemText.match(/STYLE:\s*(\w+)/);
			const complexityMatch = systemText.match(/COMPLEXITY:\s*(\w+)/);

			if (styleMatch) {
				const style = styleMatch[1];
				styleDistribution[style] = (styleDistribution[style] || 0) + 1;
			}

			if (complexityMatch) {
				const complexity = complexityMatch[1];
				complexityDistribution[complexity] =
					(complexityDistribution[complexity] || 0) + 1;
			}

			const totalText = example.messages
				.map((msg) => msg.content.map((c) => c.text).join(" "))
				.join(" ");
			totalTokens += totalText.split(/\s+/).length;
		});

		const avgTokensPerExample = Math.round(totalTokens / examples.length);

		logger.info("Distribution analysis:", {
			styleDistribution,
			complexityDistribution,
			avgTokensPerExample,
		});

		return {
			totalExamples: examples.length,
			avgTokensPerExample,
			styleDistribution,
			complexityDistribution,
		};
	}
}
