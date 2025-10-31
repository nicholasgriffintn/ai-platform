# Mercury Edit Capabilities

Polychat supports Mercury's advanced code editing workflows via two API endpoints:

- **Next Edit** (`POST /v1/chat/edit/completions`) — request the next suggested change for a file based on the current contents, prior diff history, and cursor position.
- **Apply Edit** (`POST /v1/chat/apply/completions`) — apply a provided update snippet to a block of source code and return the modified result.
Both endpoints accept the same payload shape:

```json
{
  "model": "mercury-coder",
  "messages": [
    {
      "role": "user",
      "content": "<structured prompt>"
    }
  ],
  "stream": false
}
```

The `content` string should follow Mercury's structured format, for example:

```text
<|original_code|>
class Calculator:
    def add(self, a, b):
        return a + b
<|/original_code|>
<|update_snippet|>
def multiply(self, a, b):
    return a * b
<|/update_snippet|>
```

All edit capabilities are currently exclusive to the `mercury-coder` model. If no `model` is supplied, Polychat automatically selects the best available Mercury edit-capable model.
