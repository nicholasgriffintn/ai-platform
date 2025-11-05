#!/bin/bash

cd /home/user/ai-platform/apps/api

# Fix magicLink.test.ts - remove malformed mock
sed -i '/^vi\.mock("~\/repositories"/,/^});$/d' src/services/auth/__test__/magicLink.test.ts
sed -i '/const { Database } = await import/,/vi\.mocked(Database\.getInstance)\.mockReturnValue(mockDatabase);$/d' src/services/auth/__test__/magicLink.test.ts

# Fix webauthn.test.ts - remove malformed mock
sed -i '/^vi\.mock("~\/repositories"/,/^});$/d' src/services/auth/__test__/webauthn.test.ts
sed -i '/const { Database } = await import/,/vi\.mocked(Database\.getInstance)\.mockReturnValue(mockDatabase);$/d' src/services/auth/__test__/webauthn.test.ts

# Add mock repositories to all remaining files that need it
for file in src/services/subscription/__test__/index.test.ts \
            src/services/tasks/handlers/__test__/AsyncMessagePollingHandler.test.ts \
            src/services/apps/embeddings/__test__/{insert,query,delete}.test.ts \
            src/services/apps/retrieval/__test__/content-extract.test.ts \
            src/lib/__test__/{memory,models}.test.ts \
            src/lib/chat/preparation/__test__/RequestPreparer.test.ts \
            src/lib/embedding/__test__/index.test.ts \
            src/lib/transcription/__test__/workers.test.ts; do

  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Remove old Database mocks
    sed -i '/vi\.mock("~\/lib\/database"/,/^});$/d' "$file"
    # Add DB to env if not present
    sed -i 's/: IEnv = {}/: IEnv = { DB: {} }/g' "$file"
  fi
done

echo "Done fixing test files"
