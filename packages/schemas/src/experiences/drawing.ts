export interface Drawing {
  id: string;
  description: string;
  drawingUrl: string;
  paintingUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuessResponse {
  guess: string;
}
