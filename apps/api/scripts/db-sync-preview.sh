#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

if ! command -v sqlite3 >/dev/null 2>&1; then
	echo "sqlite3 is required for db:sync:preview"
	exit 1
fi

TMP_FILE="$(mktemp -t preview-d1-XXXXXX.sql)"
trap 'rm -f "${TMP_FILE}"' EXIT

wrangler d1 export personal-assistant-preview --remote --output "${TMP_FILE}"

LOCAL_DB_DIR=".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
LOCAL_DB_PATH="$(find "${LOCAL_DB_DIR}" -maxdepth 1 -type f -name '*.sqlite' ! -name 'metadata.sqlite' -print -quit 2>/dev/null || true)"
if [[ -n "${LOCAL_DB_PATH}" && -f "${LOCAL_DB_PATH}" ]]; then
	echo "Clearing existing local D1 file at ${LOCAL_DB_PATH}"
	rm -f "${LOCAL_DB_PATH}" "${LOCAL_DB_PATH}-shm" "${LOCAL_DB_PATH}-wal"
	rm -f "${LOCAL_DB_DIR}/metadata.sqlite" "${LOCAL_DB_DIR}/metadata.sqlite-shm" "${LOCAL_DB_DIR}/metadata.sqlite-wal"
fi

if [[ -z "${LOCAL_DB_PATH}" ]]; then
	echo "Unable to locate local D1 SQLite file. Run 'pnpm --filter @assistant/api db:migrate:local' once before syncing."
	exit 1
fi

sqlite3 "${LOCAL_DB_PATH}" < "${TMP_FILE}"

pnpm run db:migrate:local
