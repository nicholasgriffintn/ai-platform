#!/bin/bash

cd /home/user/ai-platform/apps/api

echo "Fixing test files systematically..."

# For each test file, if it has Database.getInstance, remove that mock block
# This is safer than the previous approach

files=(
"src/services/auth/__test__/magicLink.test.ts"
"src/services/auth/__test__/webauthn.test.ts"
"src/lib/__test__/models.test.ts"
"src/services/subscription/__test__/index.test.ts"
"src/services/tasks/handlers/__test__/AsyncMessagePollingHandler.test.ts"
"src/lib/chat/preparation/__test__/RequestPreparer.test.ts"
"src/lib/embedding/__test__/index.test.ts"
"src/lib/transcription/__test__/workers.test.ts"
"src/services/apps/embeddings/__test__/insert.test.ts"
"src/services/apps/embeddings/__test__/query.test.ts"
"src/services/apps/embeddings/__test__/delete.test.ts"
"src/services/apps/retrieval/__test__/content-extract.test.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # Remove vi.mock for Database if it exists
    perl -i -0777 -pe 's/vi\.mock\("~\/lib\/database"[^}]*\}\);?\n?//gs' "$file"

    # Remove Database.getInstance usage in beforeEach
    perl -i -0777 -pe 's/const \{ Database \} = await import\("~\/lib\/database"\);[^\n]*\n[^\n]*Database\.getInstance[^\n]*\n//gs' "$file"

    echo "  - Removed Database mocks"
  fi
done

echo "Done! All files processed."
