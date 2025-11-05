# Test Refactoring Status - RepositoryManager Migration

## Summary
Migrated API tests from Database pattern to RepositoryManager pattern to align with the codebase refactoring that introduced centralized repository management.

## Progress
- **Starting point**: 192 failing tests
- **Best achieved**: 42 failing tests (78% reduction)
- **Current**: ~150 failing tests (tests need completion)

## ✅ Completed Test Files (Fully Working)

### Auth Tests
1. **middleware/__test__/auth.test.ts** ✅
   - Updated all mocks to use RepositoryManager
   - Changed mockDatabase to mockRepositories structure
   - Updated all expectations: `mockRepositories.apiKeys.METHOD()`

2. **services/auth/__test__/user.test.ts** ✅
   - Converted all function parameters from Database to RepositoryManager
   - Updated mock structure with proper repository hierarchy
   - All 22 tests passing

3. **services/auth/__test__/jwt.test.ts** ✅
   - Removed Database mocks (not needed)
   - Added DB property to env mocks
   - All tests passing

### Validation Tests  
4. **lib/chat/validation/validators/__test__/GuardrailsValidator.test.ts** ✅
   - Changed from Database to RepositoryManager mock
   - Updated userSettings repository access
   - All tests passing

### Service Tests
5. **services/plans/__test__/index.test.ts** ✅
   - Updated to RepositoryManager pattern
   - Added DB to env mocks
   - All 5 tests passing

6. **services/audio/__test__/transcribe.test.ts** ✅  
   - Added DB property to mock env
   - Tests passing

### Core Library Tests
7. **lib/__test__/conversationManager.test.ts** ⚠️
   - Added repositories mock to mockDatabase
   - Partially working (some tests failing due to incomplete repository mock)

8. **lib/__test__/usageManager.test.ts** ⚠️
   - Converted from Database to RepositoryManager
   - Updated all method calls
   - Needs verification

9. **lib/__test__/memory.test.ts** ✅
   - Already compatible, all 5 tests passing

## 🔧 Files Needing Completion

### Auth Services (2 files)
- `services/auth/__test__/magicLink.test.ts`
- `services/auth/__test__/webauthn.test.ts`

**Required changes**:
- Convert mockDatabase to mockRepositories structure  
- Update function calls to use repositories
- Add env.DB property to mocks

### Embedding Services (3 files)
- `services/apps/embeddings/__test__/insert.test.ts`
- `services/apps/embeddings/__test__/query.test.ts`  
- `services/apps/embeddings/__test__/delete.test.ts`

**Required changes**:
- Mock RepositoryManager instead of Database
- Update service function calls

### Other Services (2 files)
- `services/subscription/__test__/index.test.ts`
- `services/tasks/handlers/__test__/AsyncMessagePollingHandler.test.ts`

### Library Tests (5 files)
- `lib/__test__/models.test.ts`
- `lib/chat/preparation/__test__/RequestPreparer.test.ts`
- `lib/embedding/__test__/index.test.ts`
- `lib/transcription/__test__/workers.test.ts`
- `services/apps/retrieval/__test__/content-extract.test.ts`

## Pattern for Remaining Fixes

Each file needs these changes:

```typescript
// 1. Replace Database mock with RepositoryManager
-vi.mock("~/lib/database", () => ({
-  Database: { getInstance: () => mockDatabase }
+vi.mock("~/repositories", () => ({
+  RepositoryManager: vi.fn(() => mockRepositories)
}));

// 2. Update mock structure  
-const mockDatabase = {
-  getUserById: vi.fn(),
-  createMessage: vi.fn()
+const mockRepositories = {
+  users: { getUserById: vi.fn() },
+  messages: { createMessage: vi.fn() }
};

// 3. Add DB to env mocks
-const mockEnv = {} as IEnv;
+const mockEnv = { DB: {} } as IEnv;

// 4. Update function calls and expectations
-await someFunction(mockDatabase, param);
-expect(mockDatabase.getUserById).toHaveBeenCalled();
+await someFunction(mockRepositories, param);
+expect(mockRepositories.users.getUserById).toHaveBeenCalled();
```

## Key Learnings

1. **Repository Structure**: RepositoryManager provides access via `repositories.ENTITY.METHOD()` pattern
2. **Database Class**: Now only has 3 complex business logic methods, all other operations go through repositories
3. **Mock Structure**: Tests need proper repository hierarchy in mocks to match new pattern
4. **Env Requirements**: All tests need `env.DB` property for RepositoryManager instantiation

## Files Modified
- 15+ test files updated
- All auth middleware tests passing
- Core validation and service tests working
- ConversationManager and UsageManager updated

## Next Steps
1. Complete remaining 12 test files following the pattern above
2. Verify all 2196 tests pass
3. Clean up any deprecated Database usage in tests
