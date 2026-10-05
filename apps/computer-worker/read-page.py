#!/usr/bin/env python3
"""Print the current Chromium tab as JSON. Standard library only.

With no argument the visible text is printed. With "elements" the interactive
controls are printed with screen coordinates the desktop can click."""

import base64
import json
import os
import socket
import struct
import sys
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:9222"
TEXT_LIMIT = 8000
ELEMENT_LIMIT = 60
NAME_LIMIT = 120
TEXT_EXPRESSION = "document.body ? document.body.innerText : ''"
ELEMENTS_EXPRESSION = r"""
(() => {
  const SELECTOR = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
    '[role=button]', '[role=link]', '[role=tab]', '[role=checkbox]',
    '[role=radio]', '[role=menuitem]', '[role=option]', '[role=switch]',
    '[contenteditable=true]'
  ].join(',');
  const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password']);
  const chromeHeight = window.outerHeight - window.innerHeight;
  const seen = new Set();
  const elements = [];

  const describe = (element) => {
    const parts = [
      element.getAttribute('aria-label'),
      element.tagName === 'INPUT' || element.tagName === 'TEXTAREA'
        ? element.getAttribute('placeholder')
        : null,
      element.innerText,
      element.value,
      element.getAttribute('title'),
      element.getAttribute('alt'),
      element.getAttribute('name')
    ];

    for (const part of parts) {
      if (typeof part === 'string' && part.trim()) {
        return part.trim().replace(/\s+/g, ' ').slice(0, LIMIT_NAME);
      }
    }

    return '';
  };

  for (const element of document.querySelectorAll(SELECTOR)) {
    if (elements.length >= LIMIT_ELEMENTS) break;
    if (element.disabled || element.getAttribute('aria-hidden') === 'true') continue;

    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    if (rect.bottom <= 0 || rect.right <= 0) continue;
    if (rect.top >= window.innerHeight || rect.left >= window.innerWidth) continue;

    const style = window.getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;

    const centreX = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 1);
    const centreY = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
    const hit = document.elementFromPoint(centreX, centreY);
    if (!hit || (hit !== element && !element.contains(hit) && !hit.contains(element))) continue;

    const name = describe(element);
    if (!name) continue;

    const role = (element.getAttribute('role') || element.tagName).toLowerCase();
    const key = role + '|' + name;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = (element.getAttribute('type') || '').toLowerCase();
    const entry = {
      role: role,
      name: name,
      x: Math.round(window.screenX + centreX),
      y: Math.round(window.screenY + chromeHeight + centreY),
      editable: element.isContentEditable
        || element.tagName === 'TEXTAREA'
        || (element.tagName === 'INPUT' && (type === '' || TEXT_INPUTS.has(type)))
    };

    if (typeof element.value === 'string' && element.value.trim() && entry.editable) {
      entry.value = element.value.trim().slice(0, LIMIT_NAME);
    }

    elements.push(entry);
  }

  const body = document.body ? document.body.innerText : '';

  return JSON.stringify({
    url: location.href,
    text: body.replace(/\s+/g, ' ').trim().slice(0, LIMIT_TEXT),
    elements: elements
  });
})()
"""


def page_target():
    with urllib.request.urlopen(BASE + "/json/list", timeout=8) as response:
        targets = json.loads(response.read().decode())

    for target in targets:
        if (
            isinstance(target, dict)
            and target.get("type") == "page"
            and target.get("webSocketDebuggerUrl")
        ):
            return target

    raise RuntimeError("Computer browser has no page to read")


def read_exact(sock, size):
    chunks = bytearray()

    while len(chunks) < size:
        chunk = sock.recv(size - len(chunks))

        if not chunk:
            raise RuntimeError("Computer browser closed the connection")

        chunks += chunk

    return bytes(chunks)


def send_frame(sock, payload):
    mask = os.urandom(4)
    header = bytearray([0x81])
    length = len(payload)

    if length < 126:
        header.append(0x80 | length)
    elif length < 65536:
        header.append(0x80 | 126)
        header += struct.pack(">H", length)
    else:
        header.append(0x80 | 127)
        header += struct.pack(">Q", length)

    masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))

    sock.sendall(bytes(header) + mask + masked)


def recv_message(sock):
    message = bytearray()

    while True:
        first, second = read_exact(sock, 2)
        opcode = first & 0x0F
        length = second & 0x7F

        if length == 126:
            length = struct.unpack(">H", read_exact(sock, 2))[0]
        elif length == 127:
            length = struct.unpack(">Q", read_exact(sock, 8))[0]

        if second & 0x80:
            read_exact(sock, 4)

        payload = read_exact(sock, length)

        if opcode == 0x1:
            return payload.decode()
        if opcode == 0x8:
            raise RuntimeError("Computer browser closed the connection")


def evaluate(ws_url, request_id, expression):
    parsed = urllib.parse.urlparse(ws_url)
    sock = socket.create_connection((parsed.hostname, parsed.port or 80), timeout=8)

    key = base64.b64encode(os.urandom(16)).decode()
    handshake = (
        f"GET {parsed.path or '/'} HTTP/1.1\r\n"
        f"Host: {parsed.hostname}:{parsed.port or 80}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(handshake.encode())
    read_exact(sock, 1)
    headers = bytearray()

    while not headers.endswith(b"\r\n\r\n"):
        headers += read_exact(sock, 1)

    payload = json.dumps(
        {
            "id": request_id,
            "method": "Runtime.evaluate",
            "params": {"expression": expression, "returnByValue": True},
        }
    ).encode()

    send_frame(sock, payload)

    while True:
        message = json.loads(recv_message(sock))

        if message.get("id") == request_id:
            sock.close()

            return message.get("result", {}).get("result", {}).get("value", "")


def read_elements(target):
    expression = (
        ELEMENTS_EXPRESSION.replace("LIMIT_ELEMENTS", str(ELEMENT_LIMIT))
        .replace("LIMIT_NAME", str(NAME_LIMIT))
        .replace("LIMIT_TEXT", str(TEXT_LIMIT))
    )
    raw = evaluate(target["webSocketDebuggerUrl"], 1, expression)
    payload = json.loads(raw) if raw else {"url": "", "elements": []}

    return {
        "title": str(target.get("title", "")).strip(),
        "url": payload.get("url", ""),
        "text": payload.get("text", ""),
        "elements": payload.get("elements", []),
    }


def read_text(target):
    text = evaluate(target["webSocketDebuggerUrl"], 1, TEXT_EXPRESSION)
    normalised = " ".join(str(text).split())[:TEXT_LIMIT]

    return {"title": str(target.get("title", "")).strip(), "text": normalised}


def main():
    target = page_target()
    mode = sys.argv[1] if len(sys.argv) > 1 else "text"

    print(json.dumps(read_elements(target) if mode == "elements" else read_text(target)))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
