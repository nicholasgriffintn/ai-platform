# Project Log

## 2025-12-18
- Created the project log file and recorded the initial snapshot for this repo.

## 2026-01-01
- Updated API/unit tests to use class-based constructor mocks for Vitest 4 compatibility across guardrails, repositories, chat orchestration/validation, and app services.
- Adjusted drawing, uploads, and logger middleware tests for constructor-safe globals and better context setup.
- Fixed articles/shared/models test scaffolding for AppDataRepository/KVCache and re-ran full test suite.

## 2026-01-03
- Added `call_api` tool to execute REST/GraphQL requests with validation, timeouts, and structured responses.
- Wired the new tool into available functions and JSON response rendering.
- Added Vitest coverage for REST and GraphQL request behavior.
