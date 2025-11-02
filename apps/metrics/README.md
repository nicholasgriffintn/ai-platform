# Metrics Application

The monitoring and analytics dashboard for the Personal Assistant project, built to track usage and performance.

## Features

- Dashboard for monitoring API usage and performance
- Visualization of model performance and costs
- User activity and engagement metrics
- Integration with Cloudflare Analytics Engine
- Real-time data updates

## Setup

1. Install dependencies

```bash
pnpm install
```

2. Start the development server

```bash
pnpm run dev
```

3. Build for production

```bash
pnpm run build
```

## Deployment

The metrics app is designed to be deployed to Cloudflare Pages:

```bash
pnpm run deploy
```

## Usage

The metrics dashboard is available at [metrics.polychat.app](https://metrics.polychat.app).

### Key Metrics Tracked

- API requests by endpoint
- Model usage and costs
- Response times and performance
- User activity and engagement
- Error rates and types

## Integration with API

The metrics app integrates with the API backend, which logs events to Cloudflare Analytics Engine. These logs are then visualized in the metrics dashboard.
