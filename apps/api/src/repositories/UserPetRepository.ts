import type { PetOrigin } from "@ngriffin_uk/polychat-schemas";

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
  public async listUserPets(userId: number): Promise<UserPetRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "user_pet",
      { user_id: userId },
      { columns: COLUMNS, orderBy: "created_at DESC" },
    );

    return this.runQuery<UserPetRecord>(query, values);
  }

  public async getUserPet(userId: number, petId: string): Promise<UserPetRecord | null> {
    const { query, values } = this.buildSelectQuery(
      "user_pet",
      { id: petId, user_id: userId },
      { columns: COLUMNS },
    );

    return this.runQuery<UserPetRecord>(query, values, true);
  }

  public async countUserPets(userId: number): Promise<number> {
    const result = await this.runQuery<{ total: number }>(
      "SELECT COUNT(*) AS total FROM user_pet WHERE user_id = ?",
      [userId],
      true,
    );

    return result?.total ?? 0;
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
