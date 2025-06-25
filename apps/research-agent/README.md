# AI Platform Research Agent

An AI research orchestrator built with a plugin-based architecture for maximum maintainability and extensibility.

## 🔌 Plugin System

The architecture is built around a sophisticated plugin system:

### Creating a Plugin

```typescript
import { DataCollectorPlugin } from '../core/plugin.js';

export class MyPlugin extends DataCollectorPlugin {
  constructor() {
    const manifest = {
      name: 'my-plugin',
      version: '1.0.0',
      description: 'Description of what this plugin does',
      type: 'data_collector',
      // ... configuration schema
    };
    super(manifest);
  }

  async collect(context: ExecutionContext): Promise<Artifact[]> {
    // Implementation here
  }
}
```

## 🚀 API Endpoints

### Core Endpoints

- `GET /` - API information and capabilities
- `GET /health` - System health and component status
- `GET /plugins` - List available plugins and their capabilities
- `GET /metrics` - Performance metrics and statistics

### Research Operations

- `POST /research` - Submit a research query
- `GET /research/{id}/status` - Check research progress
- `DELETE /research/{id}` - Cancel active research

### Utilities

- `GET /templates` - Pre-configured research templates

## 📊 Research Query Structure

```typescript
{
  "query": "Your research question",
  "context": "Optional additional context",
  "parameters": {
    "depth": "shallow" | "medium" | "deep",
    "sources": {
      "maxSources": 10,
      "sourceTypes": ["web", "news", "academic"],
      "languages": ["en"],
      "dateRange": {
        "from": "2024-01-01",
        "to": "2024-12-31"
      }
    },
    "analysis": {
      "enableSentiment": true,
      "enableEntities": true,
      "enableSummarization": true,
      "enableFactChecking": false,
      "enableTrends": true
    },
    "output": {
      "format": "structured" | "narrative" | "hybrid",
      "includeSourceMaterial": true,
      "confidenceThreshold": 0.7
    }
  },
  "metadata": {
    "priority": "normal",
    "timeout": 300000,
    "tags": ["research", "analysis"]
  }
}
```

## 🎯 Execution Planning

The system automatically generates optimized execution plans based on:

### Research Depth Templates

- **Shallow**: Quick web search + basic analysis
- **Medium**: Multi-source collection + comprehensive analysis
- **Deep**: Full-spectrum research with validation and fact-checking

### Intelligent Dependency Resolution

The plan generator automatically:
- Determines optimal plugin combinations
- Calculates stage dependencies
- Estimates execution time
- Configures retry policies

### Parallel Execution

- Stages without dependencies run in parallel
- Automatic resource management
- Fault tolerance with graceful degradation

## 📈 Monitoring & Metrics

### Health Monitoring

- Real-time system status
- Plugin health checks
- Resource utilization tracking
- Error rate monitoring

### Performance Metrics

- Query processing times
- Throughput statistics
- Plugin performance analytics
- Success/failure rates

## 🔧 Configuration

### Environment Variables

```bash
# Basic configuration
MAX_CONCURRENT_STAGES=5
DEFAULT_TIMEOUT=300000

# Plugin-specific settings
WEB_SEARCH_API_KEY=your_api_key
ACADEMIC_SEARCH_ENDPOINT=https://api.example.com
```

### Plugin Configuration

Each plugin has its own configuration schema defined in its manifest, enabling:
- Type-safe configuration
- Automatic validation
- Default value handling
- Runtime reconfiguration

## 🚦 Usage Examples

### Quick Research

```bash
curl -X POST https://your-domain.com/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest developments in AI",
    "parameters": {
      "depth": "shallow",
      "sources": {
        "maxSources": 5,
        "sourceTypes": ["web"]
      },
      "analysis": {
        "enableSentiment": false,
        "enableEntities": false,
        "enableSummarization": true,
        "enableFactChecking": false,
        "enableTrends": false
      },
      "output": {
        "format": "structured",
        "includeSourceMaterial": false,
        "confidenceThreshold": 0.6
      }
    },
    "metadata": {
      "priority": "normal",
      "timeout": 60000
    }
  }'
```

### Comprehensive Analysis

```bash
curl -X POST https://your-domain.com/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "impact of climate change on agriculture",
    "parameters": {
      "depth": "deep",
      "sources": {
        "maxSources": 20,
        "sourceTypes": ["web", "news", "academic"]
      },
      "analysis": {
        "enableSentiment": true,
        "enableEntities": true,
        "enableSummarization": true,
        "enableFactChecking": true,
        "enableTrends": true
      },
      "output": {
        "format": "hybrid",
        "includeSourceMaterial": true,
        "confidenceThreshold": 0.7
      }
    },
    "metadata": {
      "priority": "high",
      "timeout": 600000
    }
  }'
```
