export interface Drawing {
	id: string;
	description: string;
	drawingUrl: string;
	paintingUrl: string;
	createdAt: string;
	updatedAt: string;
	metadata?: Record<string, any>;
}

export interface DrawingsResponse {
	drawings: Drawing[];
}

export interface DrawingResponse {
	drawing: Drawing;
}

export interface GuessResponse {
	status: string;
	content: string;
	completion_id?: string;
}

export interface GenerateImageResponse {
	status: string;
	content?: string;
	completion_id?: string;
	app_data_id?: string;
	data?: {
		drawingUrl: string;
		drawingKey: string;
		paintingUrl: string;
		paintingKey: string;
		description?: string;
	};
}
