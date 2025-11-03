import { gatewayId } from "~/constants/app";
import { guessDrawingPrompt } from "~/lib/prompts";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

interface ImageFromDrawingResponse extends IFunctionResponse {
	completion_id?: string;
}

const userGuessesCache = new Map<string, Set<string>>();

export async function guessDrawingFromImage({
	context,
	env,
	request,
	user,
}: {
	context?: ServiceContext;
	env?: IEnv;
	request: {
		drawing?: Blob;
	};
	user: IUser;
}): Promise<ImageFromDrawingResponse> {
	if (!request.drawing) {
		throw new AssistantError("Missing drawing", ErrorType.PARAMS_ERROR);
	}

	const arrayBuffer = await request.drawing.arrayBuffer();

	const userId = user.id.toString();
	const userGuesses = userGuessesCache.get(userId) || new Set<string>();

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const runtimeEnv = serviceContext.env as IEnv;

	const guessRequest = await runtimeEnv.AI.run(
		"@cf/llava-hf/llava-1.5-7b-hf",
		{
			prompt: guessDrawingPrompt(userGuesses),
			image: [...new Uint8Array(arrayBuffer)],
		},
		{
			gateway: {
				id: gatewayId,
				skipCache: false,
				cacheTtl: 3360,
				metadata: {
					email: user?.email,
				},
			},
		},
	);

	if (!guessRequest.description) {
		throw new AssistantError("Failed to generate description");
	}

	const guess = guessRequest.description.trim();
	userGuesses.add(guess.toLowerCase());
	userGuessesCache.set(userId, userGuesses);

	const guessId = generateId();

	const repo = serviceContext.repositories.appData;
	await repo.createAppDataWithItem(user.id, "drawings", guessId, "guess", {
		guess,
		timestamp: new Date().toISOString(),
	});

	return {
		status: "success",
		content: guess,
		completion_id: guessId,
	};
}
