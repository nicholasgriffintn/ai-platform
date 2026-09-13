FROM docker.io/cloudflare/sandbox:0.12.9-python

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      gnupg \
      wget \
      novnc \
      openbox \
      scrot \
      websockify \
      x11vnc \
      xdotool \
      xvfb \
    && wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/google-chrome.deb \
    && rm -f /tmp/google-chrome.deb \
    && ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY start-computer.sh /usr/local/bin/start-computer

RUN chmod 0755 /usr/local/bin/start-computer \
    && mkdir -p /workspace/profile

EXPOSE 6080
