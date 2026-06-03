export type StoredAssetPurpose =
	| "chat_upload"
	| "speech"
	| "generated_media"
	| "ocr_output"
	| "app_artifact"
	| "sandbox_artifact";

export interface StoredAsset {
	id: string;
	key: string;
	owner_user_id: number;
	conversation_id: string | null;
	message_id: string | null;
	app_data_id: string | null;
	purpose: StoredAssetPurpose;
	mime_type: string;
	filename: string | null;
	byte_size: number | null;
	created_at: string;
	updated_at: string | null;
}

export interface CreateStoredAsset {
	id: string;
	key: string;
	ownerUserId: number;
	conversationId?: string | null;
	messageId?: string | null;
	appDataId?: string | null;
	purpose: StoredAssetPurpose;
	mimeType: string;
	filename?: string | null;
	byteSize?: number | null;
}
