#!/bin/sh
set -eu

: "${API_SERVER_KEY:?API_SERVER_KEY is required}"

mkdir -p "$HERMES_HOME"
rm -f "$HERMES_HOME"/*.lock "$HERMES_HOME"/*.pid "$HERMES_HOME"/*.sock "$HERMES_HOME"/*.sock.path

hermes config set model.provider custom > /dev/null
hermes config set model.default polychat > /dev/null
hermes config set model.base_url http://polychat.internal/v1 > /dev/null
hermes config set model.api_key polychat-gateway > /dev/null
hermes config set model.context_length 128000 > /dev/null

export API_SERVER_PORT=8642
export API_SERVER_HOST=0.0.0.0

exec hermes gateway
