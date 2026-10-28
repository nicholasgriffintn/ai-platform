FROM docker.io/cloudflare/sandbox:1.0.2 AS sandbox

FROM docker.io/library/debian:trixie-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      coreutils \
      curl \
      gnupg \
      novnc \
      openbox \
      procps \
      python3 \
      scrot \
      websockify \
      wget \
      x11vnc \
      xdotool \
      xvfb \
    && wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/google-chrome.deb \
    && rm -f /tmp/google-chrome.deb \
    && ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=sandbox /usr/local/bin/sandbox-shim /usr/local/bin/sandbox-shim
COPY start-computer.sh /usr/local/bin/start-computer
COPY health-probe.sh /usr/local/bin/health-probe
COPY check-paint.py /usr/local/bin/check-paint
COPY navigate.py /usr/local/bin/navigate
COPY read-page.py /usr/local/bin/read-page
COPY cdp.py /usr/local/bin/cdp.py
COPY verify-site.py /usr/local/bin/verify-site
COPY read-site-reference.py /usr/local/bin/read-site-reference

RUN chmod 0755 /usr/local/bin/start-computer /usr/local/bin/health-probe /usr/local/bin/check-paint /usr/local/bin/navigate /usr/local/bin/read-page \
    && mkdir -p /workspace/profile

WORKDIR /workspace

CMD ["sleep", "infinity"]
