import chalk from "chalk";

export class Logger {
	constructor(private prefix?: string) {}

	info(message: string, data?: any) {
		const prefix = this.prefix ? chalk.blue(`[${this.prefix}]`) : "";
		console.log(
			`${prefix} ${message}`,
			data ? JSON.stringify(data, null, 2) : "",
		);
	}

	success(message: string, data?: any) {
		const prefix = this.prefix ? chalk.green(`[${this.prefix}]`) : "";
		console.log(
			`${prefix} ${chalk.green("✓")} ${message}`,
			data ? JSON.stringify(data, null, 2) : "",
		);
	}

	warn(message: string, data?: any) {
		const prefix = this.prefix ? chalk.yellow(`[${this.prefix}]`) : "";
		console.warn(
			`${prefix} ${chalk.yellow("⚠")} ${message}`,
			data ? JSON.stringify(data, null, 2) : "",
		);
	}

	error(message: string, error?: any) {
		const prefix = this.prefix ? chalk.red(`[${this.prefix}]`) : "";
		console.error(`${prefix} ${chalk.red("✗")} ${message}`);
		if (error) {
			if (error instanceof Error) {
				console.error(chalk.red(error.stack || error.message));
			} else {
				console.error(chalk.red(JSON.stringify(error, null, 2)));
			}
		}
	}

	debug(message: string, data?: any) {
		if (process.env.DEBUG) {
			const prefix = this.prefix ? chalk.gray(`[${this.prefix}]`) : "";
			console.debug(
				`${prefix} ${chalk.gray(message)}`,
				data ? JSON.stringify(data, null, 2) : "",
			);
		}
	}
}

export function createLogger(prefix?: string): Logger {
	return new Logger(prefix);
}
