FROM docker.io/cloudflare/sandbox:0.12.10-python

USER root

ENV HERMES_VERSION=v2026.9.24
ENV HERMES_HOME=/workspace/hermes
ENV NODE_EXTRA_CA_CERTS=/etc/cloudflare/certs/cloudflare-containers-ca.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      git \
      ripgrep \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /usr/local/bin/uv

RUN git clone --depth 1 --branch "${HERMES_VERSION}" https://github.com/NousResearch/hermes-agent.git /opt/hermes-agent \
    && UV_PYTHON_INSTALL_DIR=/opt/uv-python uv venv --python 3.12 /opt/hermes-venv \
    && uv pip install --python /opt/hermes-venv/bin/python -e /opt/hermes-agent "aiohttp==3.14.3" \
    && ln -sf /opt/hermes-venv/bin/hermes /usr/local/bin/hermes \
    && hermes --help > /dev/null

COPY start-hermes.sh /usr/local/bin/start-hermes

RUN chmod 0755 /usr/local/bin/start-hermes && mkdir -p "${HERMES_HOME}"

EXPOSE 8642
