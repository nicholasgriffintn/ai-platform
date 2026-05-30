import { HttpError } from "./http.js";
import { sanitiseResourceName } from "./names.js";

export function requireTrainingResourceName(name: string): string {
	const value = sanitiseResourceName(name);

	if (!value) {
		throw new HttpError("Name must contain at least one letter or number", 400);
	}

	return value;
}
