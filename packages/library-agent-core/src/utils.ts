export function truncateForModel(value: string, maxChars: number): string {
	if (value.length <= maxChars) {
		return value;
	}

	return `${value.slice(0, maxChars)}\n... (truncated)`;
}

export function safeParseJson<T>(raw: string): T | null {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function normaliseCommandLine(rawLine: string): string | null {
	let line = rawLine.trim();
	if (!line || line === "```" || line.startsWith("#")) {
		return null;
	}

	line = line
		.replace(/^\$\s*/, "")
		.replace(/^[-*]\s+/, "")
		.replace(/^\d+\.\s+/, "")
		.trim();

	if (!line || line.toLowerCase().startsWith("cd ")) {
		return null;
	}

	if (
		(line.startsWith("`") && line.endsWith("`")) ||
		(line.startsWith('"') && line.endsWith('"'))
	) {
		line = line.slice(1, -1).trim();
	}

	if (!line || !/^[./A-Za-z]/.test(line)) {
		return null;
	}

	return line;
}

export function extractCommands(text: string): string[] {
	const commands: string[] = [];
	const codeBlocks = Array.from(
		text.matchAll(/```(?:bash|sh|shell)?\s*([\s\S]*?)```/gi),
		(match) => match[1],
	);
	const source = codeBlocks.length > 0 ? codeBlocks.join("\n") : text;

	for (const rawLine of source.split("\n")) {
		const command = normaliseCommandLine(rawLine);
		if (!command) {
			continue;
		}
		if (!commands.includes(command)) {
			commands.push(command);
		}
	}

	return commands;
}
