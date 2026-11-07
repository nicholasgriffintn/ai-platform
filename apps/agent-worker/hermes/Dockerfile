FROM docker.io/library/node:24-trixie-slim

ENV HERMES_VERSION=v2026.9.24
ENV HERMES_HOME=/workspace/hermes

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      git \
      python3 \
      ripgrep \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /usr/local/bin/uv

RUN git clone --depth 1 --branch "${HERMES_VERSION}" https://github.com/NousResearch/hermes-agent.git /opt/hermes-agent \
    && UV_PYTHON_INSTALL_DIR=/opt/uv-python uv venv --python 3.12 /opt/hermes-venv \
    && uv pip install --no-cache --compile-bytecode --python /opt/hermes-venv/bin/python -e /opt/hermes-agent "aiohttp==3.14.3" \
    && (/opt/hermes-venv/bin/python -m compileall -q /opt/hermes-agent || true) \
    && ln -sf /opt/hermes-venv/bin/hermes /usr/local/bin/hermes \
    && hermes --help > /dev/null

RUN mkdir -p "${HERMES_HOME}" \
    && hermes config set model.provider custom > /dev/null \
    && hermes config set model.default '' > /dev/null \
    && hermes config set model.base_url http://polychat.harness.internal > /dev/null \
    && hermes config set model.api_key polychat-gateway > /dev/null \
    && hermes config set model.context_length 128000 > /dev/null

WORKDIR /opt/daemon

RUN printf '{"private":true,"type":"module"}' > package.json \
    && npm install --omit=peer agents@0.28.0 zod@4.6.5 \
    && npm cache clean --force

COPY daemon.ts start-hermes.sh /opt/daemon/

RUN chmod 0755 /opt/daemon/start-hermes.sh

WORKDIR /workspace

ENTRYPOINT ["node", "/opt/daemon/daemon.ts"]
