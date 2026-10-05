#!/usr/bin/env python3
"""Print the current Chromium tab as JSON. Standard library only.

With no argument the visible text is printed. With "elements" the interactive
controls are printed with screen coordinates the desktop can click."""

import json
import sys
from cdp import evaluate_expression, page_target

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


def read_elements(target):
    expression = (
        ELEMENTS_EXPRESSION.replace("LIMIT_ELEMENTS", str(ELEMENT_LIMIT))
        .replace("LIMIT_NAME", str(NAME_LIMIT))
        .replace("LIMIT_TEXT", str(TEXT_LIMIT))
    )
    raw = evaluate_expression(target["webSocketDebuggerUrl"], expression)
    payload = json.loads(raw) if raw else {"url": "", "elements": []}

    return {
        "title": str(target.get("title", "")).strip(),
        "url": payload.get("url", ""),
        "text": payload.get("text", ""),
        "elements": payload.get("elements", []),
    }


def read_text(target):
    text = evaluate_expression(target["webSocketDebuggerUrl"], TEXT_EXPRESSION)
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
