import json
import sys
import time
import urllib.parse

from cdp import CdpConnection, page_target


def capture(payload):
    diagnostics = []
    allowed = set(payload["allowedOrigins"])
    cdp = CdpConnection(page_target()["webSocketDebuggerUrl"])

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
        deadline = time.monotonic() + 15
        rendered = False
        while time.monotonic() < deadline:
            cdp.pump(0.25)
            result = cdp.command("Runtime.evaluate", {
                "expression": "Boolean(document.querySelector('#site-root [data-site-key]'))",
                "returnByValue": True,
            })
            if result.get("result", {}).get("value"):
                rendered = True
                break
        if not rendered:
            add("assertion", "The page did not render any site content")
        else:
            end = time.monotonic() + 1
            while time.monotonic() < end:
                cdp.pump(0.2)
            for interaction in payload.get("interactions", []):
                key = json.dumps(interaction["elementKey"])
                clicked = cdp.command("Runtime.evaluate", {
                    "expression": f"(() => {{ const el = document.querySelector('[data-site-key=\\\"' + {key} + '\\\"] button'); if (!el || el.disabled) return false; el.click(); return true; }})()",
                    "returnByValue": True,
                })
                if not clicked.get("result", {}).get("value"):
                    add("assertion", f"The button could not be pressed: {interaction['elementKey']}")
                cdp.pump(0.3)
                if interaction.get("expectVisible"):
                    payload["elementKeys"].append(interaction["expectVisible"])
            keys = json.dumps(payload["elementKeys"])
            result = cdp.command("Runtime.evaluate", {
                "expression": f"({keys}).filter(key => {{ const el = document.querySelector('[data-site-key=\\\"' + key + '\\\"]'); return !el || ![el, ...el.querySelectorAll('*')].some(node => {{ const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'; }}); }})",
                "returnByValue": True,
            })
            for key in result.get("result", {}).get("value", []):
                add("assertion", f"Required element is not visible: {key}")
            overflow = cdp.command("Runtime.evaluate", {
                "expression": "document.documentElement.scrollWidth > innerWidth + 4",
                "returnByValue": True,
            })
            if overflow.get("result", {}).get("value"):
                add("assertion", "The page overflows the viewport horizontally")
            failed_elements = cdp.command("Runtime.evaluate", {"expression": "Boolean(document.querySelector('[data-site-render-error]'))", "returnByValue": True})
            if failed_elements.get("result", {}).get("value"):
                add("assertion", "A site component failed to render")
        return {"status": "failed" if diagnostics else "passed", "diagnostics": diagnostics}
    finally:
        cdp.close()


if __name__ == "__main__":
    try:
        print(json.dumps(capture(json.load(sys.stdin))))
    except Exception:
        print(json.dumps({"status": "unavailable", "diagnostics": [{"kind": "assertion", "message": "Browser verification could not complete"}]}))
