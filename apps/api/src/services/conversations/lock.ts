import {
  CONVERSATION_LOCK_VERSION,
  type ConversationLock,
  type ConversationLockKeyInput,
  type CreateConversationLockInput,
  type DeleteConversationLockInput,
  type LockedMessage,
  type LockedMessageInput,
  type SealedEnvelope,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/conversations/lock" });

function requireProUser(context: ServiceContext) {
  const user = context.requireUser();

  if (user.plan_id !== "pro") {
    throw new AssistantError(
      "Locked conversations are available on Pro",
      ErrorType.AUTHENTICATION_ERROR,
      403,
    );
  }

  return user;
}

async function requireOwnedPersonalConversation(
  context: ServiceContext,
  conversationId: string,
): Promise<Record<string, unknown>> {
  const user = context.requireUser();
  const conversation = await context.repositories.conversations.getConversation(conversationId);

  if (!conversation || conversation.user_id !== user.id) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  return conversation;
}

export async function getConversationLock(
  context: ServiceContext,
  conversationId: string,
): Promise<ConversationLock> {
  await requireOwnedPersonalConversation(context, conversationId);

  const lock = await context.repositories.conversationLocks.getLock(conversationId);

  if (!lock) {
    throw new AssistantError("This conversation is not locked", ErrorType.NOT_FOUND, 404);
  }

  return lock;
}

async function purgeConversationPlaintext(
  context: ServiceContext,
  conversationId: string,
): Promise<void> {
  const database = context.ensureDatabase();

  const storedKeys = await database
    .prepare(
      `SELECT storage_key FROM source WHERE conversation_id = ? AND storage_key IS NOT NULL
			 UNION ALL
			 SELECT storage_key FROM output WHERE conversation_id = ? AND storage_key IS NOT NULL`,
    )
    .bind(conversationId, conversationId)
    .all<{ storage_key: string }>();

  await database.batch([
    database
      .prepare("DELETE FROM training_examples WHERE conversation_id = ?")
      .bind(conversationId),
    database.prepare("DELETE FROM activity_record WHERE conversation_id = ?").bind(conversationId),
    database.prepare("DELETE FROM goal WHERE conversation_id = ?").bind(conversationId),
    database.prepare("DELETE FROM source WHERE conversation_id = ?").bind(conversationId),
    database
      .prepare(
        "DELETE FROM output_revision WHERE output_id IN (SELECT id FROM output WHERE conversation_id = ?)",
      )
      .bind(conversationId),
    database.prepare("DELETE FROM output WHERE conversation_id = ?").bind(conversationId),
    database.prepare("DELETE FROM message WHERE conversation_id = ?").bind(conversationId),
    database
      .prepare(
        "UPDATE conversation SET is_public = 0, share_id = NULL, last_message_id = NULL WHERE id = ?",
      )
      .bind(conversationId),
  ]);

  if (!context.env.PRIVATE_ASSETS_BUCKET) {
    return;
  }

  const storage = StorageService.forPrivateAssets(context);

  for (const row of storedKeys.results ?? []) {
    try {
      await storage.deleteObject(row.storage_key);
    } catch (error) {
      logger.error("Failed to delete a conversation asset while locking", {
        conversationId,
        error,
      });
    }
  }
}

export async function createConversationLock(
  context: ServiceContext,
  conversationId: string,
  input: CreateConversationLockInput,
): Promise<ConversationLock> {
  requireProUser(context);

  const conversation = await requireOwnedPersonalConversation(context, conversationId);

  if (conversation.project_id) {
    throw new AssistantError("Project conversations cannot be locked", ErrorType.PARAMS_ERROR, 400);
  }

  if (conversation.share_id || conversation.is_public) {
    throw new AssistantError(
      "Stop sharing this conversation before locking it",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (await context.repositories.conversationLocks.isLocked(conversationId)) {
    throw new AssistantError("This conversation is already locked", ErrorType.CONFLICT_ERROR, 409);
  }

  assertUsableKeySet(input.keys);

  await context.repositories.conversationLocks.createLock({
    conversationId,
    version: input.version ?? CONVERSATION_LOCK_VERSION,
    title: input.title ?? null,
    keys: input.keys,
    messages: input.messages ?? [],
  });

  await purgeConversationPlaintext(context, conversationId);

  return getConversationLock(context, conversationId);
}

function assertUsableKeySet(keys: ConversationLockKeyInput[]): void {
  if (!keys.some((key) => key.type === "recovery")) {
    throw new AssistantError(
      "A locked conversation needs a recovery key",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (!keys.some((key) => key.type === "passkey" || key.type === "password")) {
    throw new AssistantError(
      "A locked conversation needs a passkey or a password",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

export async function addConversationLockKey(
  context: ServiceContext,
  conversationId: string,
  key: ConversationLockKeyInput,
): Promise<ConversationLock> {
  requireProUser(context);
  await getConversationLock(context, conversationId);

  await context.repositories.conversationLocks.addKey(conversationId, key);

  return getConversationLock(context, conversationId);
}

export async function deleteConversationLockKey(
  context: ServiceContext,
  conversationId: string,
  keyId: string,
): Promise<ConversationLock> {
  requireProUser(context);

  const lock = await getConversationLock(context, conversationId);
  const target = lock.keys.find((key) => key.id === keyId);

  if (!target) {
    throw new AssistantError("Lock key not found", ErrorType.NOT_FOUND, 404);
  }

  if (target.type === "recovery") {
    throw new AssistantError(
      "The recovery key cannot be removed while the conversation is locked",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const remainingEntryKeys = lock.keys.filter(
    (key) => key.id !== keyId && (key.type === "passkey" || key.type === "password"),
  );

  if (remainingEntryKeys.length === 0) {
    throw new AssistantError(
      "Add another passkey or password before removing this one",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  await context.repositories.conversationLocks.deleteKey(conversationId, keyId);

  return getConversationLock(context, conversationId);
}

export async function listLockedMessages(
  context: ServiceContext,
  conversationId: string,
): Promise<LockedMessage[]> {
  await requireOwnedPersonalConversation(context, conversationId);

  if (!(await context.repositories.conversationLocks.isLocked(conversationId))) {
    throw new AssistantError("This conversation is not locked", ErrorType.NOT_FOUND, 404);
  }

  return context.repositories.conversationLocks.listMessages(conversationId);
}

export async function appendLockedMessages(
  context: ServiceContext,
  conversationId: string,
  messages: LockedMessageInput[],
  title?: SealedEnvelope | null,
): Promise<LockedMessage[]> {
  requireProUser(context);
  await requireOwnedPersonalConversation(context, conversationId);

  if (!(await context.repositories.conversationLocks.isLocked(conversationId))) {
    throw new AssistantError("This conversation is not locked", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.conversationLocks.appendMessages(conversationId, messages, title);

  return context.repositories.conversationLocks.listMessages(conversationId);
}

export async function deleteConversationLock(
  context: ServiceContext,
  conversationId: string,
  input: DeleteConversationLockInput,
): Promise<void> {
  const user = requireProUser(context);

  await requireOwnedPersonalConversation(context, conversationId);
  await getConversationLock(context, conversationId);

  const database = context.ensureDatabase();
  const statements = input.messages.map((message) =>
    database
      .prepare(
        `INSERT INTO message (id, conversation_id, role, content, model, platform, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, 'web', datetime('now'), datetime('now'))`,
      )
      .bind(
        message.id || generateId(),
        conversationId,
        message.role,
        message.content,
        message.model ?? null,
      ),
  );

  statements.push(
    database
      .prepare(
        `UPDATE conversation
				 SET title = ?, message_count = ?, updated_at = datetime('now')
				 WHERE id = ? AND user_id = ?`,
      )
      .bind(input.title ?? null, input.messages.length, conversationId, user.id),
  );

  await database.batch(statements);
  await context.repositories.conversationLocks.deleteLock(conversationId);
}

export async function assertConversationNotLocked(
  context: Pick<ServiceContext, "repositories">,
  conversationId: string,
  action: string,
): Promise<void> {
  if (await context.repositories.conversationLocks.isLocked(conversationId)) {
    throw new AssistantError(
      `${action} is not available for locked conversations`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}
