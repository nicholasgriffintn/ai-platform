import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type { TrainingExample, GenerateOptions } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

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

	constructor() {
		const configPath = join(__dirname, "../../configs/strudel-prompts.json");
		this.promptConfig = JSON.parse(readFileSync(configPath, "utf-8"));
	}

	async generate(options: GenerateOptions): Promise<TrainingExample[]> {
		logger.info(`Starting dataset generation via ${options.apiUrl}`);
		logger.info(`Target: ${options.count} examples`);

		const examples: TrainingExample[] = [];
		const combinations = this.buildCombinations(
			options.styles,
			options.complexities,
		);
		const examplesPerCombo = Math.ceil(options.count / combinations.length);

		logger.info(
			`Generating ${examplesPerCombo} examples for each of ${combinations.length} combinations`,
		);

		for (const combo of combinations) {
			logger.info(`Processing ${combo.style}/${combo.complexity}...`);

			for (let i = 0; i < examplesPerCombo; i++) {
				if (examples.length >= options.count) {
					break;
				}

				const prompt = this.generatePrompt(combo.style, combo.complexity, i);

				try {
					const response = await this.callAPI({
						apiUrl: options.apiUrl,
						apiKey: options.apiKey,
						prompt,
						style: combo.style,
						complexity: combo.complexity,
						model: options.model,
					});

					const systemPrompt = this.buildSystemPrompt(
						combo.style,
						combo.complexity,
					);

					examples.push({
						schemaVersion: "bedrock-conversation-2024",
						system: [{ text: systemPrompt }],
						messages: [
							{ role: "user", content: [{ text: prompt }] },
							{ role: "assistant", content: [{ text: response.code }] },
						],
					});

					logger.success(
						`Generated ${combo.style}/${combo.complexity} example ${i + 1}/${examplesPerCombo}`,
					);
				} catch (error) {
					logger.error(
						`Failed to generate example for ${combo.style}/${combo.complexity}`,
						error,
					);
				}
			}

			if (examples.length >= options.count) {
				break;
			}
		}

		logger.success(`Dataset generation complete: ${examples.length} examples`);
		return examples.slice(0, options.count);
	}

	private async callAPI(params: {
		apiUrl: string;
		apiKey?: string;
		prompt: string;
		style: string;
		complexity: string;
		model?: string;
	}): Promise<{ code: string; explanation?: string }> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
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

		return response.json() as Promise<{ code: string; explanation?: string }>;
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
