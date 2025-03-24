import type { Conversation } from "~/types";

export const categorizeChatsByDate = (conversations: Conversation[] = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;
  const twoMonths = 60 * oneDay;

  const startOfWeek = new Date(today.getTime() - oneWeek);
  const startOfMonth = new Date(today.getTime() - oneMonth);
  const startOfLastMonth = new Date(today.getTime() - twoMonths);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    today: conversations.filter((conversation) => {
      const date = getConversationDate(conversation);
      return date >= today && date < tomorrow;
    }),
    yesterday: conversations.filter((conversation) => {
      const date = getConversationDate(conversation);
      return date >= yesterday && date < today;
    }),
    thisWeek: conversations.filter((conversation) => {
      const date = getConversationDate(conversation);
      return date >= startOfWeek && date < yesterday;
    }),
    thisMonth: conversations.filter((conversation) => {
      const date = getConversationDate(conversation);
      return date >= startOfMonth && date < startOfWeek;
    }),
    lastMonth: conversations.filter((conversation) => {
      const date = getConversationDate(conversation);
      return date >= startOfLastMonth && date < startOfMonth;
    }),
    older: conversations.filter((conversation) => {
      const date = getConversationDate(conversation);
      return date < startOfLastMonth;
    }),
  };
};

const getConversationDate = (conversation: Conversation) => {
  if (conversation.created_at) {
    return new Date(conversation.created_at);
  }
  if (conversation.updated_at) {
    return new Date(conversation.updated_at);
  }
  if (conversation.last_message_at) {
    return new Date(conversation.last_message_at);
  }
  return new Date(0);
};
