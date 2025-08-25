import { BaseRepository } from "./BaseRepository";

export class EmbeddingRepository extends BaseRepository {
  public async getEmbedding(
    id: string,
    type?: string,
  ): Promise<Record<string, unknown> | null> {
    const query = type
      ? "SELECT id, metadata, type, title, content FROM embedding WHERE id = ?1 AND type = ?2"
      : "SELECT id, metadata, type, title, content FROM embedding WHERE id = ?1";

    const params = type ? [id, type] : [id];

    const result = this.runQuery<Record<string, unknown>>(query, params, true);
    return result;
  }

  public async getEmbeddingIdByType(
    id: string,
    type: string,
  ): Promise<Record<string, unknown> | null> {
    const result = this.runQuery<Record<string, unknown>>(
      "SELECT id FROM embedding WHERE id = ?1 AND type = ?2",
      [id, type],
      true,
    );
    return result;
  }

  public async insertEmbedding(
    id: string,
    metadata: Record<string, unknown>,
    title: string,
    content: string,
    type: string,
  ): Promise<void> {
    await this.executeRun(
      "INSERT INTO embedding (id, metadata, title, content, type) VALUES (?1, ?2, ?3, ?4, ?5)",
      [id, JSON.stringify(metadata), title, content, type],
    );
  }

  public async deleteEmbedding(id: string): Promise<void> {
    await this.executeRun("DELETE FROM embedding WHERE id = ?1", [id]);
  }
}
