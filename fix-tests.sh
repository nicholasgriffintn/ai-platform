#!/bin/bash

# Script to fix test files by replacing Database mocks with RepositoryManager mocks

files=(
"src/lib/__test__/memory.test.ts"
"src/lib/__test__/models.test.ts"
"src/lib/chat/preparation/__test__/RequestPreparer.test.ts"
"src/lib/embedding/__test__/index.test.ts"
"src/lib/transcription/__test__/workers.test.ts"
"src/services/apps/embeddings/__test__/delete.test.ts"
"src/services/apps/embeddings/__test__/insert.test.ts"
"src/services/apps/embeddings/__test__/query.test.ts"
"src/services/apps/retrieval/__test__/content-extract.test.ts"
"src/services/auth/__test__/jwt.test.ts"
"src/services/auth/__test__/magicLink.test.ts"
"src/services/auth/__test__/user.test.ts"
"src/services/auth/__test__/webauthn.test.ts"
"src/services/subscription/__test__/index.test.ts"
"src/services/tasks/handlers/__test__/AsyncMessagePollingHandler.test.ts"
)

for file in "${files[@]}"; do
  if [ -f "apps/api/$file" ]; then
    echo "Processing $file..."
    # Add DB to env mocks: {} as IEnv -> { DB: {} } as IEnv
    sed -i 's/{} as IEnv/{ DB: {} } as IEnv/g' "apps/api/$file"
    sed -i 's/{} as any)/{ DB: {} } as any)/g' "apps/api/$file"
  fi
done

echo "Done!"
