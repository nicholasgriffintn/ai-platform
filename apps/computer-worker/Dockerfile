FROM docker.io/cloudflare/sandbox:0.12.9-python

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      chromium \
      novnc \
      openbox \
      scrot \
      websockify \
      x11vnc \
      xdotool \
      xvfb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY start-computer.sh /usr/local/bin/start-computer

RUN chmod 0755 /usr/local/bin/start-computer \
    && mkdir -p /workspace/profile

EXPOSE 6080
