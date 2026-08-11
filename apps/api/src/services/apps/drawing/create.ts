import { gatewayId } from "~/constants/app";
import type { ConversationManager } from "~/lib/conversationManager";
import { drawingDescriptionPrompt } from "~/lib/prompts";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import {
	StorageService,
	type StoredOutputFileResult,
	type StoredSourceFileResult,
} from "~/lib/storage";
import type { ChatRole, IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

interface ImageFromDrawingResponse extends IFunctionResponse {
	completion_id?: string;
}

export async function generateImageFromDrawing({
	context,
	env,
	request,
	user,
	conversationManager,
	existingDrawingId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	request: {
		drawing?: Blob;
		drawingId?: string;
	};
	user: IUser;
	conversationManager?: ConversationManager;
	existingDrawingId?: string;
}): Promise<ImageFromDrawingResponse> {
	if (!request.drawing) {
		throw new AssistantError("Missing drawing", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const runtimeEnv = serviceContext.env as IEnv;
	const storage = StorageService.forPrivateAssets(serviceContext);

	const arrayBuffer = await request.drawing.arrayBuffer();
	const length = arrayBuffer.byteLength;

	const drawingId = request.drawingId || existingDrawingId || generateId();
	const drawingImageKey = `drawings/${drawingId}/image.png`;

	let storedDrawing: StoredSourceFileResult;
	try {
		storedDrawing = await storage.storeSourceFile({
			key: drawingImageKey,
			data: arrayBuffer,
			createdByUserId: user.id,
			title: "Original drawing",
			mimeType: "image/png",
			filename: "image.png",
			byteSize: length,
		});
	} catch {
		throw new AssistantError("Error uploading drawing");
	}

	const descriptionRequest = await runtimeEnv.AI.run(
		"@cf/llava-hf/llava-1.5-7b-hf",
		{
			prompt: drawingDescriptionPrompt(),
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

	const painting = await runtimeEnv.AI.run(
		// @ts-ignore
		"@cf/runwayml/stable-diffusion-v1-5-img2img",
		{
			prompt: descriptionRequest?.description || "Convert this drawing into a painting.",
			image: [...new Uint8Array(arrayBuffer)],
			guidance: 8,
			strength: 0.85,
			// @ts-ignore
			num_inference_steps: 50,
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

	// @ts-expect-error
	const paintingArrayBuffer = await new Response(painting).arrayBuffer();
	const paintingLength = paintingArrayBuffer.byteLength;

	const paintingImageKey = `drawings/${drawingId}/painting.png`;
	let storedPainting: StoredOutputFileResult;
	try {
		storedPainting = await storage.storeOutputFile({
			key: paintingImageKey,
			data: paintingArrayBuffer,
			createdByUserId: user.id,
			capabilityId: "drawings",
			groupId: drawingId,
			kind: "painting",
			title: descriptionRequest?.description || "Generated painting",
			content: { description: descriptionRequest?.description },
			mimeType: "image/png",
			filename: "painting.png",
			byteSize: paintingLength,
		});
	} catch {
		throw new AssistantError("Error uploading painting");
	}

	let conversationResponse: any = { status: "success" };

	if (conversationManager) {
		await conversationManager.add(drawingId, {
			role: "user",
			content: `Generate a drawing with this prompt: ${descriptionRequest?.description}`,
			app: "drawings",
		});

		const message = {
			role: "assistant" as ChatRole,
			name: "drawing_generate",
			content: descriptionRequest?.description,
			data: {
				drawingSourceId: storedDrawing.sourceId,
				drawingUrl: storedDrawing.url,
				drawingKey: drawingImageKey,
				paintingOutputId: storedPainting.outputId,
				paintingUrl: storedPainting.url,
				paintingKey: paintingImageKey,
			},
		};
		conversationResponse = await conversationManager.add(drawingId, message);
	}

	const repo = serviceContext.repositories.outputs;

	const output = await repo.createOutput({
		createdByUserId: user.id,
		capabilityId: "drawings",
		groupId: drawingId,
		kind: "drawing",
		title: descriptionRequest?.description || "Untitled drawing",
		content: {
			description: descriptionRequest?.description || "Untitled drawing",
			drawingSourceId: storedDrawing.sourceId,
			drawingUrl: storedDrawing.url,
			paintingOutputId: storedPainting.outputId,
			paintingUrl: storedPainting.url,
			drawingKey: drawingImageKey,
			paintingKey: paintingImageKey,
		},
	});
	await repo.attachSources(output.id, [storedDrawing.sourceId]);
	await repo.attachSources(storedPainting.outputId, [storedDrawing.sourceId]);

	return {
		...conversationResponse,
		output_id: output.id,
		completion_id: drawingId,
		status: "success",
		data: {
			drawingSourceId: storedDrawing.sourceId,
			drawingUrl: storedDrawing.url,
			drawingKey: drawingImageKey,
			paintingOutputId: storedPainting.outputId,
			paintingUrl: storedPainting.url,
			paintingKey: paintingImageKey,
			description: descriptionRequest?.description || "Untitled drawing",
		},
	};
}
