import type { PetOrigin } from "@ngriffin_uk/polychat-schemas";

import { PaginationHelper } from "~/lib/database/PaginationHelper";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface UserPetRecord {
  id: string;
  user_id: number;
  name: string;
  description: string | null;
  origin: PetOrigin;
  sheet_key: string;
  layout_id: string;
  prompt: string | null;
  created_at: string;
}

const COLUMNS = [
  "id",
  "user_id",
  "name",
  "description",
  "origin",
  "sheet_key",
  "layout_id",
  "prompt",
  "created_at",
];

export interface CreateUserPetInput {
  userId: number;
  name: string;
  description?: string | null;
  origin: PetOrigin;
  sheetKey: string;
  layoutId: string;
  prompt?: string | null;
}

export class UserPetRepository extends BaseRepository {
  public async listUserPetsPage(
    userId: number,
    page: number,
    limit: number,
  ): Promise<{ records: UserPetRecord[]; hasMore: boolean }> {
    const { limit: safeLimit, offset } = PaginationHelper.calculate(page, limit);
    const { query, values } = this.buildSelectQuery(
      "user_pet",
      { user_id: userId },
      {
        columns: COLUMNS,
        orderBy: "created_at DESC, id DESC",
        limit: safeLimit + 1,
        offset,
      },
    );
    const records = await this.runQuery<UserPetRecord>(query, values);

    return {
      records: records.slice(0, safeLimit),
      hasMore: records.length > safeLimit,
    };
  }

  public async listOwnedPetIds(userId: number, petIds: readonly string[]): Promise<Set<string>> {
    if (petIds.length === 0) {
      return new Set();
    }

    const placeholders = petIds.map(() => "?").join(", ");
    const records = await this.runQuery<{ id: string }>(
      `SELECT id FROM user_pet WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...petIds],
    );

    return new Set(records.map((record) => record.id));
  }

  public async getUserPet(userId: number, petId: string): Promise<UserPetRecord | null> {
    const { query, values } = this.buildSelectQuery(
      "user_pet",
      { id: petId, user_id: userId },
      { columns: COLUMNS },
    );

    return this.runQuery<UserPetRecord>(query, values, true);
  }

  public async createUserPet(input: CreateUserPetInput): Promise<UserPetRecord> {
    const insert = this.buildInsertQuery("user_pet", {
      id: generateId(),
      user_id: input.userId,
      name: input.name,
      description: input.description ?? null,
      origin: input.origin,
      sheet_key: input.sheetKey,
      layout_id: input.layoutId,
      prompt: input.prompt ?? null,
    });

    if (!insert) {
      throw new AssistantError("Failed to build pet insert query", ErrorType.INTERNAL_ERROR);
    }

    await this.executeRun(insert.query, insert.values);

    const created = await this.runQuery<UserPetRecord>(
      "SELECT * FROM user_pet WHERE id = ? AND user_id = ?",
      [insert.values[0], input.userId],
      true,
    );

    if (!created) {
      throw new AssistantError("Failed to create pet", ErrorType.INTERNAL_ERROR);
    }

    return created;
  }

  public async deleteUserPet(userId: number, petId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("user_pet", {
      id: petId,
      user_id: userId,
    });

    await this.executeRun(query, values);
  }
}
