import { md } from "~/utils/markdown.js";

export const memoriesTagDescription = md`# Memories & RAG

Store and organize memories using vector embeddings. Memories are automatically extracted from conversations for PRO users and can be organized into groups.

## Overview

The Memories feature provides:

- **Automatic Extraction** - Memories are automatically saved from conversations (PRO users only)
- **Vector Search** - Semantic search using Cloudflare Vectorize
- **Memory Groups** - Organize related memories together
- **Auto-Retrieval** - Relevant memories are automatically included in conversations

## How It Works

### For PRO Users

1. **During Conversation** - The system automatically extracts important information
2. **Vector Storage** - Information is converted to embeddings and stored
3. **Auto-Retrieval** - Relevant memories are fetched during new conversations (top 3, similarity >= 0.5)
4. **Context Enhancement** - Top memories are added to your conversation context

### Memory Categories

Memories are automatically classified into 5 fixed categories:

- \`fact\` - Factual information
- \`preference\` - User preferences
- \`schedule\` - Schedule-related information
- \`general\` - General information
- \`snapshot\` - Conversation snapshots (saved every 5 turns)

## Automatic Memory Creation

### PRO User Feature

Memories are **only** automatically created for users with the PRO plan.

### User Settings

Two settings control automatic memory creation:

1. \`memories_save_enabled\` - Extract and save memories from conversations
2. \`memories_chat_history_enabled\` - Save conversation history snapshots

Both are disabled by default and must be enabled by the user.

### What Gets Saved

The system automatically extracts:

- **Facts** - Important factual information about you or your work
- **Preferences** - Your preferences and choices
- **Schedule** - Time-related information
- **Snapshots** - Every 5 conversation turns, a summary is saved

### Duplicate Detection

Before saving a new memory, the system checks for similar existing memories (similarity >= 0.85) to avoid duplicates.

## Automatic Retrieval in Conversations

### How Retrieval Works

When you send a message:

1. Your message is converted to an embedding
2. Top 3 similar memories are retrieved (similarity >= 0.5)
3. Memories are added to your conversation in a \`<user_memories>\` block
4. The model uses these memories for context

## RAG Options in Chat

The chat API supports general RAG via the \`use_rag\` and \`rag_options\` parameters:

\`\`\`json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [...],
  "use_rag": true,
  "rag_options": {
    "topK": 5,
    "scoreThreshold": 0.7,
    "includeMetadata": true,
    "type": "custom",
    "namespace": "my_namespace"
  }
}
\`\`\`

**Note:** This is for generic RAG, not user memories. User memories use a fixed namespace format: \`memory_user_{userId}\` and are automatically included for PRO users.

## Vector Embeddings

### Embedding Model

- **Model:** \`@cf/baai/bge-base-en-v1.5\` (BAAI BGE Base)
- **Provider:** Cloudflare Workers AI
- **Not configurable** - this model is hardcoded

### Storage

- **Vector DB:** Cloudflare Vectorize
- **Namespace:** \`memory_user_{userId}\` (automatically namespaced per user)
- **Metadata:** Includes text, category, timestamp, conversation_id

## Limitations

- **PRO Only** - Automatic memory creation requires PRO plan
- **Not Manual** - No public API to manually create individual memories (automatic extraction only)
- **No Search Endpoint** - No dedicated memory search API
- **No Updates** - Cannot update existing memories, only delete
- **Fixed Parameters** - Retrieval settings (topK=3, threshold=0.5) cannot be changed per request
- **Fixed Categories** - Only 5 predefined categories, no custom categories
- **Fixed Embedding Model** - Cannot choose different embedding models

## Examples

### Check Your Memories

\`\`\`bash
curl https://api.polychat.app/v1/memories \\
  -H "Authorization: Bearer YOUR_TOKEN"
\`\`\`

### Organize Memories into Groups

\`\`\`bash
# Create a group
curl https://api.polychat.app/v1/memories/groups \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Work Projects",
    "description": "Information about my work projects",
    "category": "fact"
  }'

# Add memories to the group
curl https://api.polychat.app/v1/memories/groups/grp_xyz789/memories \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type": application/json" \\
  -d '{
    "memory_ids": ["mem_abc123", "mem_def456"]
  }'
\`\`\`

### Delete a Memory

\`\`\`bash
curl -X DELETE https://api.polychat.app/v1/memories/mem_abc123 \\
  -H "Authorization: Bearer YOUR_TOKEN"
\`\`\``;
