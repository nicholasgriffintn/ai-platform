import json
import sys

from cdp import CdpConnection, page_target


def main():
    target = page_target()
    connection = CdpConnection(target["webSocketDebuggerUrl"])
    try:
        result = connection.command("Runtime.evaluate", {
            "expression": "document.body ? document.body.innerText : ''",
            "returnByValue": True,
        })
        text = result.get("result", {}).get("value", "")
        print(json.dumps({"title": str(target.get("title", "")).strip(), "text": " ".join(str(text).split())[:8000]}))
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
