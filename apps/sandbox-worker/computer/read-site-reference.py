import ipaddress
import json
import sys
import time
import urllib.parse

from cdp import CdpConnection, page_target

LOAD_TIMEOUT_SECONDS = 20
SETTLE_SECONDS = 1.5
BLOCKED_RESOURCE_TYPES = {"Image", "Media", "WebSocket", "EventSource", "Manifest", "Ping"}
BLOCKED_HOST_SUFFIXES = (".localhost", ".local", ".internal", ".home.arpa")

READ_TOKENS = """function () {
  const canvas = this.document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const toHex = (value) => {
    if (!value || value === 'transparent') { return null; }
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#000000';
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    if (alpha < 128) { return null; }
    return '#' + [red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('');
  };
  const style = (node) => this.getComputedStyle(node);
  const body = this.document.body;
  const root = this.document.documentElement;
  const background = toHex(body && style(body).backgroundColor) || toHex(style(root).backgroundColor);
  const foreground = toHex(body ? style(body).color : style(root).color);
  const weights = new Map();
  const add = (colour, weight) => {
    if (colour && colour !== background && colour !== foreground) {
      weights.set(colour, (weights.get(colour) || 0) + weight);
    }
  };
  const limit = this.innerHeight * 3;
  const visible = (node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top < limit ? box : null;
  };
  for (const node of this.document.querySelectorAll('a, button, [role="button"], input[type="submit"], [class*="btn"], [class*="button"]')) {
    const box = visible(node);
    if (!box) { continue; }
    add(toHex(style(node).backgroundColor), Math.min(box.width * box.height, 40000) / 100);
    add(toHex(style(node).color), 20);
  }
  for (const node of this.document.querySelectorAll('h1, h2, header, nav, section')) {
    const box = visible(node);
    if (!box) { continue; }
    add(toHex(style(node).backgroundColor), Math.min(box.width * box.height, 400000) / 1000);
  }
  const heading = this.document.querySelector('h1') || this.document.querySelector('h2');
  return {
    background,
    foreground,
    accents: [...weights.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 40)
      .map(([colour, weight]) => ({ colour, weight: Math.round(weight) })),
    headingFamily: heading ? style(heading).fontFamily.slice(0, 400) : null,
    bodyFamily: body ? style(body).fontFamily.slice(0, 400) : null,
  };
}"""


def public_https(raw):
    url = urllib.parse.urlparse(raw)
    host = (url.hostname or "").lower()

    if url.scheme != "https" or not host or url.username or url.password:
        return False

    if host == "localhost" or host.endswith(BLOCKED_HOST_SUFFIXES):
        return False

    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return True


def read(payload):
    if not public_https(payload["url"]):
        return {"status": "unavailable"}

    cdp = CdpConnection(page_target()["webSocketDebuggerUrl"])
    loaded = {"done": False}

    def event(message):
        method = message.get("method")
        params = message.get("params", {})

        if method == "Fetch.requestPaused":
            url = params["request"]["url"]
            permitted = (
                url.startswith("data:")
                or (public_https(url) and params.get("resourceType") not in BLOCKED_RESOURCE_TYPES)
            )
            cdp.notify("Fetch.continueRequest" if permitted else "Fetch.failRequest", {
                "requestId": params["requestId"],
                **({} if permitted else {"errorReason": "BlockedByClient"}),
            })
        elif method == "Page.loadEventFired":
            loaded["done"] = True

    try:
        cdp.on_event = event
        cdp.command("Page.enable")
        cdp.command("Fetch.enable", {"patterns": [{"urlPattern": "*"}]})
        cdp.command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        cdp.command("Page.navigate", {"url": payload["url"]})
        deadline = time.monotonic() + LOAD_TIMEOUT_SECONDS
        while not loaded["done"] and time.monotonic() < deadline:
            cdp.pump(0.25)
        settle = time.monotonic() + SETTLE_SECONDS
        while time.monotonic() < settle:
            cdp.pump(0.2)
        window = cdp.command("Runtime.evaluate", {"expression": "window"})["result"]["objectId"]
        location = cdp.call_function(window, "function () { return this.location.href; }")
        if not isinstance(location, str) or not public_https(location):
            return {"status": "unavailable"}
        tokens = cdp.call_function(window, READ_TOKENS)
        if not isinstance(tokens, dict):
            return {"status": "unavailable"}
        return {"status": "captured", **tokens}
    finally:
        cdp.close()


if __name__ == "__main__":
    try:
        print(json.dumps(read(json.load(sys.stdin))))
    except Exception:
        print(json.dumps({"status": "unavailable"}))
