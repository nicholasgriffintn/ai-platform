import { BaseRepository } from "./BaseRepository";
import type { CreateStoredAsset, StoredAsset } from "~/lib/storage/asset-types";

export class StoredAssetRepository extends BaseRepository {
	public async createAsset(asset: CreateStoredAsset): Promise<StoredAsset | null> {
		return this.runQuery<StoredAsset>(
			`INSERT INTO stored_asset (
				id,
				key,
				owner_user_id,
				conversation_id,
				message_id,
				app_data_id,
				purpose,
				mime_type,
				filename,
				byte_size,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
			RETURNING *`,
			[
				asset.id,
				asset.key,
				asset.ownerUserId,
				asset.conversationId ?? null,
				asset.messageId ?? null,
				asset.appDataId ?? null,
				asset.purpose,
				asset.mimeType,
				asset.filename ?? null,
				asset.byteSize ?? null,
			],
			true,
		);
	}

	public async getAsset(assetId: string): Promise<StoredAsset | null> {
		const { query, values } = this.buildSelectQuery("stored_asset", {
			id: assetId,
		});
		return this.runQuery<StoredAsset>(query, values, true);
	}
}
