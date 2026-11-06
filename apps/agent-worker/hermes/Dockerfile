FROM docker.io/library/node:26-trixie-slim

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
    && uv pip install --python /opt/hermes-venv/bin/python -e /opt/hermes-agent "aiohttp==3.14.3" \
    && ln -sf /opt/hermes-venv/bin/hermes /usr/local/bin/hermes \
    && hermes --help > /dev/null

WORKDIR /opt/daemon

RUN printf '{"private":true,"type":"module"}' > package.json \
    && npm install --omit=peer agents@0.28.0 zod@4.6.5

COPY daemon.ts start-hermes.sh /opt/daemon/

RUN chmod 0755 /opt/daemon/start-hermes.sh && mkdir -p "${HERMES_HOME}"

WORKDIR /workspace

ENTRYPOINT ["node", "/opt/daemon/daemon.ts"]
