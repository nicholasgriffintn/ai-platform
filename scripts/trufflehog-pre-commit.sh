#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "TruffleHog skipped: docker command not found." >&2
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "TruffleHog skipped: Docker is unavailable." >&2
  exit 0
fi

docker run \
  -v "$(pwd):/workdir" \
  --rm \
  us-docker.pkg.dev/thog-artifacts/public/scanner:latest \
  git main HEAD /workdir
