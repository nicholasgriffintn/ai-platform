# Web application

This is Polychat's responsive web application and PWA, built with React, Tailwind CSS, and React Router. The native iOS client is a separate application.

## Features

- UI built with React and TailwindCSS
- Responsive design that works on both desktop and mobile devices
- Integration with the API backend for AI assistant capabilities
- Local conversation storage with IndexedDB (falls back to LocalStorage)
- Settings configuration for models and preferences
- One plus menu aligned to the composer's width and edges for imports and capability submenus, with the same composer-aligned presentation filtered by `/` for actions or `@` for capabilities. Slash input prefix-matches root command strings. Commands with choices, such as model, reasoning, verbosity, and tools, open an in-place submenu on Enter or selection; text after the command filters that submenu until the directive is selected or removed. Keyboard navigation keeps the highlighted row visible, while pointer movement changes the highlighted row without a stationary pointer interrupting typing. Dictate and Live remain dedicated controls, and composer controls expose shortcut tooltips after an intentional hover delay only.
- Composer menus and selectors render above banners, ask-user prompts, and conversation content. Tooltips sit above those interactive overlays, while the mobile sidebar drawer remains above the composer itself.
- Default model tools appear once in the plus menu as switch controls. They remain discoverable through `@`, but their catalogue rows are suppressed when those canonical controls are present.
- Use side submenus only on desktop layouts where hover and screen space support them; on mobile, tablet, coarse-pointer, or no-hover layouts, replace the menu contents with a tap-driven drilldown and an explicit Back action
- Web LLM support for offline usage
- Conversation goals show a compact start marker attached to the message that set the objective;
  later lifecycle events remain full-width timeline markers.

Use the skill's [local setup](../setup.md), [configuration](../configuration.md), [deployment](../deployment.md), and [validation](../validation.md) workflows for current commands and environment guidance.
