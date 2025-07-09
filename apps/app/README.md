# Frontend Application

This is the web and mobile frontend for the Personal Assistant project, built with React, TailwindCSS, and React Router.

## Features

- UI built with React and TailwindCSS
- Responsive design that works on both desktop and mobile devices
- Integration with the API backend for AI assistant capabilities
- Local conversation storage with IndexedDB (falls back to LocalStorage)
- Settings configuration for models and preferences
- Web LLM support for offline usage

## Setup

1. Install dependencies
```bash
pnpm install
```

2. Configure environment variables (if needed)

3. Start the development server
```bash
pnpm run dev
```

4. Build for production
```bash
pnpm run build
```

## Deployment

This app is designed to be deployed to Cloudflare Pages:

```bash
pnpm run deploy
```

## Testing

```bash
pnpm run test
``` 