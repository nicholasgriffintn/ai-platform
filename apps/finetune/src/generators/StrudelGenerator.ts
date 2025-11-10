import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type { TrainingExample, GenerateOptions } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { RateLimiter } from "../utils/rateLimiter.js";
import { TokenEstimator } from "../utils/tokenEstimator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger("StrudelGenerator");

interface PromptConfig {
	baseSystemPrompt: string;
	styleGuides: Record<string, string>;
	complexityGuides: Record<string, string>;
	promptTemplates: Record<string, string[]>;
}

export class StrudelGenerator {
	private promptConfig: PromptConfig;
	private rateLimiter: RateLimiter;

	constructor() {
		const configPath = join(__dirname, "../../configs/strudel-prompts.json");
		this.promptConfig = JSON.parse(readFileSync(configPath, "utf-8"));

		this.rateLimiter = new RateLimiter({
			maxRequests: 45,
			maxTokens: 28000,
			windowMs: 60000,
		});
	}

	async generate(
		options: GenerateOptions & { outputDir?: string },
	): Promise<TrainingExample[]> {
		logger.info(`Starting dataset generation via ${options.apiUrl}`);
		logger.info(`Target: ${options.count} examples`);

		const progressFile = options.outputDir
			? join(options.outputDir, ".progress.jsonl")
			: null;

		const examples: TrainingExample[] = [];
		if (progressFile && existsSync(progressFile)) {
			const progressContent = readFileSync(progressFile, "utf-8");
			const lines = progressContent.split("\n").filter((line) => line.trim());
			for (const line of lines) {
				examples.push(JSON.parse(line));
			}
			logger.info(`Resuming from ${examples.length} existing examples`);
		}

		const combinations = this.buildCombinations(
			options.styles,
			options.complexities,
		);
		const examplesPerCombo = Math.ceil(options.count / combinations.length);

		logger.info(
			`Generating ${examplesPerCombo} examples for each of ${combinations.length} combinations`,
		);

		let consecutiveErrors = 0;
		const maxConsecutiveErrors = 5;

		for (const combo of combinations) {
			logger.info(`Processing ${combo.style}/${combo.complexity}...`);

			for (let i = 0; i < examplesPerCombo; i++) {
				if (examples.length >= options.count) {
					break;
				}

				const prompt = this.generatePrompt(combo.style, combo.complexity, i);
				const systemPrompt = this.buildSystemPrompt(
					combo.style,
					combo.complexity,
				);

				try {
					const response = await this.callAPI({
						apiUrl: options.apiUrl,
						apiKey: options.apiKey,
						prompt,
						systemPrompt,
						style: combo.style,
						complexity: combo.complexity,
						model: options.model,
					});

					const assistantResponse = response.code;
					if (!assistantResponse || typeof assistantResponse !== "string") {
						throw new Error("Invalid response format from API");
					}

					const example: TrainingExample = {
						schemaVersion: "bedrock-conversation-2024",
						system: [{ text: systemPrompt }],
						messages: [
							{ role: "user", content: [{ text: prompt }] },
							{ role: "assistant", content: [{ text: response.code }] },
						],
					};

					examples.push(example);

					if (progressFile) {
						writeFileSync(progressFile, `${JSON.stringify(example)}\n`, {
							flag: "a",
						});
					}

					consecutiveErrors = 0;
					logger.success(
						`Generated ${examples.length}/${options.count}: ${combo.style}/${combo.complexity}`,
					);
				} catch (error: any) {
					consecutiveErrors++;
					logger.error(
						`Failed to generate example for ${combo.style}/${combo.complexity} (attempt ${consecutiveErrors}/${maxConsecutiveErrors})`,
						error,
					);

					if (error?.message?.includes("429") || error?.status === 429) {
						logger.warn("Rate limit detected, waiting 60 seconds...");
						await this.sleep(60000);
						consecutiveErrors = 0;
						i--;
					} else {
						continue;
					}

					if (consecutiveErrors >= maxConsecutiveErrors) {
						logger.error(
							`Too many consecutive errors (${maxConsecutiveErrors}). Aborting.`,
						);
						throw new Error(
							`Generation failed after ${maxConsecutiveErrors} consecutive errors`,
						);
					}

					await this.sleep(1000);
				}
			}

			if (examples.length >= options.count) {
				break;
			}
		}

		logger.success(`Dataset generation complete: ${examples.length} examples`);
		return examples.slice(0, options.count);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private async callAPI(params: {
		apiUrl: string;
		apiKey?: string;
		prompt: string;
		systemPrompt: string;
		style: string;
		complexity: string;
		model?: string;
	}): Promise<{ code: string; explanation?: string }> {
		const estimatedTokens = TokenEstimator.estimateRequest(
			params.systemPrompt,
			params.prompt,
		);
		await this.rateLimiter.waitForSlot(estimatedTokens);

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"User-Agent": "StrudelDatasetGenerator/1.0",
		};

		if (params.apiKey) {
			headers["Authorization"] = `Bearer ${params.apiKey}`;
		}

		const response = await fetch(`${params.apiUrl}/apps/strudel/generate`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				prompt: params.prompt,
				style: params.style,
				complexity: params.complexity,
				model: params.model,
				options: {
					cache_ttl_seconds: 0,
				},
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`API error: ${response.status} ${response.statusText}\n${errorText}`,
			);
		}

		const responseJson = (await response.json()) as {
			data: {
				code: string;
				explanation?: string;
			};
		};

		return responseJson.data;
	}

	private buildSystemPrompt(style: string, complexity: string): string {
		const styleGuide = this.promptConfig.styleGuides[style] || "";
		const complexityGuide =
			this.promptConfig.complexityGuides[complexity] || "";

		let prompt = this.promptConfig.baseSystemPrompt;

		if (styleGuide) {
			prompt += `\n\nSTYLE: ${style}\n${styleGuide}`;
		}

		if (complexityGuide) {
			prompt += `\n\nCOMPLEXITY: ${complexity}\n${complexityGuide}`;
		}

		return prompt;
	}

	private generatePrompt(
		style: string,
		complexity: string,
		variation: number,
	): string {
		const templates = this.promptConfig.promptTemplates[style] || [
			"Create a musical pattern",
		];

		let basePrompt = templates[variation % templates.length];

		if (complexity === "complex") {
			basePrompt += ". Use multiple layers, signals, and creative modulation.";
		} else if (complexity === "simple") {
			basePrompt += ". Keep it minimal and clear.";
		}

		return basePrompt;
	}

	private buildCombinations(
		styles: string[],
		complexities: string[],
	): Array<{ style: string; complexity: string }> {
		const combos: Array<{ style: string; complexity: string }> = [];

		for (const style of styles) {
			for (const complexity of complexities) {
				combos.push({ style, complexity });
			}
		}

		return combos;
	}
}
