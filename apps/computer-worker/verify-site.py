import json
import sys
import time
import urllib.parse

from cdp import CdpConnection, page_target


def capture(payload):
    diagnostics = []
    allowed = set(payload["allowedOrigins"])
    cdp = CdpConnection(page_target()["webSocketDebuggerUrl"])
    render_message = {
        "channel": "polychat-site-preview",
        "type": "render",
        "frameId": payload["frameId"],
        "payload": {
            "project": payload["project"],
            "pageId": payload["pageId"],
            "inspecting": False,
            "selectedKey": None,
            "data": payload["data"],
        },
    }

    def add(kind, message):
        if len(diagnostics) < 100:
            diagnostics.append({"kind": kind, "message": str(message)[:2000]})

    def event(message):
        method = message.get("method")
        params = message.get("params", {})
        if method == "Fetch.requestPaused":
            url = urllib.parse.urlparse(params["request"]["url"])
            origin = f"{url.scheme}://{url.netloc}"
            permitted = url.scheme == "https" and origin in allowed and not url.username and not url.password
            cdp.notify("Fetch.continueRequest" if permitted else "Fetch.failRequest", {
                "requestId": params["requestId"],
                **({} if permitted else {"errorReason": "BlockedByClient"}),
            })
        elif method == "Runtime.exceptionThrown":
            details = params.get("exceptionDetails", {})
            add("page_error", details.get("exception", {}).get("description", details.get("text", "Page error")))
        elif method == "Runtime.consoleAPICalled" and params.get("type") in ("error", "assert"):
            add("console", " ".join(str(item.get("value", item.get("description", ""))) for item in params.get("args", [])))
        elif method == "Network.loadingFailed" and params.get("type") in ("Script", "Stylesheet", "Document", "XHR", "Fetch"):
            add("request_failure", params.get("errorText", "Request failed"))
        elif method == "Network.responseReceived":
            response = params.get("response", {})
            if response.get("status", 200) >= 400 and params.get("type") in ("Script", "Stylesheet", "Document", "XHR", "Fetch"):
                url = urllib.parse.urlparse(response.get("url", ""))
                add("request_failure", f"HTTP {response['status']}: {url.scheme}://{url.netloc}{url.path}")

    try:
        cdp.on_event = event
        cdp.command("Page.enable")
        cdp.command("Runtime.enable")
        cdp.command("Network.enable")
        cdp.command("Fetch.enable", {"patterns": [{"urlPattern": "*"}]})
        width = 390 if payload["viewport"] == "mobile" else 1440
        cdp.command("Emulation.setDeviceMetricsOverride", {"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        frame = cdp.command("Page.getFrameTree")["frameTree"]["frame"]["id"]
        cdp.command("Page.setDocumentContent", {"frameId": frame, "html": payload["document"]})
        window = cdp.command("Runtime.evaluate", {"expression": "window"})["result"]["objectId"]
        deadline = time.monotonic() + 15
        rendered = False
        while time.monotonic() < deadline:
            cdp.pump(0.25)
            cdp.call_function(
                window,
                "function (message) { this.postMessage(message, '*'); }",
                render_message,
            )
            if cdp.call_function(
                window,
                "function () { return Boolean(this.document.querySelector('#site-root [data-site-key]')); }",
            ):
                rendered = True
                break
        if not rendered:
            add("assertion", "The page did not render any site content")
        else:
            end = time.monotonic() + 1
            while time.monotonic() < end:
                cdp.pump(0.2)
            hidden_keys = cdp.call_function(
                window,
                "function (keys) { return keys.filter((key) => { const el = this.document.querySelector(`[data-site-key=\"${CSS.escape(key)}\"]`); return !el || ![el, ...el.querySelectorAll('*')].some((node) => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && this.getComputedStyle(node).visibility !== 'hidden'; }); }); }",
                payload["elementKeys"],
            )
            for key in hidden_keys or []:
                add("assertion", f"Required element is not visible: {key}")
            if cdp.call_function(
                window,
                "function () { return this.document.documentElement.scrollWidth > this.innerWidth + 4; }",
            ):
                add("assertion", "The page overflows the viewport horizontally")
            if cdp.call_function(
                window,
                "function () { return Boolean(this.document.querySelector('[data-site-render-error]')); }",
            ):
                add("assertion", "A site component failed to render")
        return {"status": "failed" if diagnostics else "passed", "diagnostics": diagnostics}
    finally:
        cdp.close()


if __name__ == "__main__":
    try:
        print(json.dumps(capture(json.load(sys.stdin))))
    except Exception:
        print(json.dumps({"status": "unavailable", "diagnostics": [{"kind": "assertion", "message": "Browser verification could not complete"}]}))
