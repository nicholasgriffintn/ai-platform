import { useMutation } from "@tanstack/react-query";

import { API_BASE_URL } from "~/constants";

type ShareItemParams = {
	app_id: string;
};

type ShareItemResponse = {
	status: "success" | "error";
	share_id?: string;
	message?: string;
};

export function useShareItem() {
	return useMutation<ShareItemResponse, Error, ShareItemParams>({
		mutationFn: async ({ app_id }: ShareItemParams) => {
			const response = await fetch(`${API_BASE_URL}/apps/shared`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					app_id,
				}),
				credentials: "include",
			});

			const data = (await response.json()) as ShareItemResponse;

			if (!response.ok) {
				throw new Error(data.message || "Failed to share item");
			}

			return data;
		},
	});
}

type GetSharedItemParams = {
	share_id: string;
};

type SharedItem = {
	id: string;
	app_id: string;
	item_id: string;
	item_type: string;
	data: any;
	share_id: string;
	created_at: string;
	updated_at: string;
};

type GetSharedItemResponse = {
	status: "success" | "error";
	item?: SharedItem;
	message?: string;
};

export async function getSharedItem({
	share_id,
}: GetSharedItemParams): Promise<SharedItem> {
	const response = await fetch(`${API_BASE_URL}/apps/shared/${share_id}`);

	if (!response.ok) {
		const errorData = (await response.json()) as GetSharedItemResponse;
		throw new Error(errorData.message || "Failed to fetch shared item");
	}

	const data = (await response.json()) as GetSharedItemResponse;

	if (data.status === "error" || !data.item) {
		throw new Error(data.message || "Failed to fetch shared item");
	}

	return data.item;
}
