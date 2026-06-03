import { gatewayId } from "~/constants/app";
import type { ConversationManager } from "~/lib/conversationManager";
import { drawingDescriptionPrompt } from "~/lib/prompts";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { StorageService, type StoredAssetResult } from "~/lib/storage";
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

	let storedDrawing: StoredAssetResult;
	try {
		storedDrawing = await storage.storePrivateAsset({
			key: drawingImageKey,
			data: arrayBuffer,
			ownerUserId: user.id,
			purpose: "app_artifact",
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
	let storedPainting: StoredAssetResult;
	try {
		storedPainting = await storage.storePrivateAsset({
			key: paintingImageKey,
			data: paintingArrayBuffer,
			ownerUserId: user.id,
			purpose: "app_artifact",
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
				drawingAssetId: storedDrawing.assetId,
				drawingUrl: storedDrawing.url,
				drawingKey: drawingImageKey,
				paintingAssetId: storedPainting.assetId,
				paintingUrl: storedPainting.url,
				paintingKey: paintingImageKey,
			},
		};
		conversationResponse = await conversationManager.add(drawingId, message);
	}

	const repo = serviceContext.repositories.appData;

	const appDataResponse = await repo.createAppDataWithItem(
		user.id,
		"drawings",
		drawingId,
		"drawing",
		{
			description: descriptionRequest?.description || "Untitled drawing",
			drawingAssetId: storedDrawing.assetId,
			drawingUrl: storedDrawing.url,
			paintingAssetId: storedPainting.assetId,
			paintingUrl: storedPainting.url,
			drawingKey: drawingImageKey,
			paintingKey: paintingImageKey,
		},
	);

	const appDataId = appDataResponse.id;

	return {
		...conversationResponse,
		app_data_id: appDataId,
		completion_id: drawingId,
		status: "success",
		data: {
			drawingAssetId: storedDrawing.assetId,
			drawingUrl: storedDrawing.url,
			drawingKey: drawingImageKey,
			paintingAssetId: storedPainting.assetId,
			paintingUrl: storedPainting.url,
			paintingKey: paintingImageKey,
			description: descriptionRequest?.description || "Untitled drawing",
		},
	};
}
