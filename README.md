# Ark Node Core

A personal sovereign server OS platform. Local AI, modular apps, unified inbox, ad blocking, game servers — all running privately in your home.

> "Your data. Your intelligence. Your Ark."

## Quick Start

```bash
# Run with Docker (recommended)
docker-compose up --build

# Or run locally with Bun
bun install
bun run dev
```

Server starts at **http://localhost:3000** · Web UI at **http://localhost:3000/ui/** (after building)

## Building the Web UI

```bash
cd src/web
npm install
npm run build
cd ../..
# UI is now served at /ui/
```

## API Reference

### Platform
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Welcome + version |
| GET | `/health` | Health check |
| GET | `/status` | CPU, memory, uptime |
| GET | `/apps` | All loaded modules (full manifests) |

### Storage
| Method | Path | Description |
|--------|------|-------------|
| GET | `/storage` | List files |
| POST | `/storage/:filename` | Save a file |
| GET | `/storage/:filename` | Retrieve a file |

### AI (Solomon)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai/health` | Is Ollama available? |
| GET | `/ai/models` | List available models |
| POST | `/ai/query` | `{ prompt, model?, context? }` → `{ response, model }` |

### Minecraft Module
| Method | Path | Description |
|--------|------|-------------|
| GET | `/minecraft/status` | Container status + IP |
| POST | `/minecraft/start` | Deploy/start server `{ version?, memory?, gamemode?, difficulty? }` |
| POST | `/minecraft/stop` | Stop server |
| DELETE | `/minecraft/destroy` | Remove container + data |
| GET | `/minecraft/logs` | Tail logs `?lines=50` |

### Email Module
| Method | Path | Description |
|--------|------|-------------|
| GET | `/email/presets` | Supported providers (Gmail, Yahoo, Outlook…) |
| GET | `/email/accounts` | List configured accounts |
| POST | `/email/accounts` | Add account `{ label, username, password, provider? }` |
| DELETE | `/email/accounts/:id` | Remove account |
| GET | `/email/inbox` | Unified inbox across all accounts |
| GET | `/email/inbox/:id` | Single account inbox |

### AdBlock Module (Pi-hole)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/adblock/status` | Status + block stats |
| POST | `/adblock/start` | Deploy Pi-hole `{ password?, timezone? }` |
| POST | `/adblock/stop` | Stop Pi-hole |
| GET | `/adblock/blocklist` | Top blocked domains |
| POST | `/adblock/whitelist` | `{ domain }` |
| POST | `/adblock/blacklist` | `{ domain }` |
| POST | `/adblock/update-lists` | Pull latest blocklists |

## Writing a Module

```ts
// src/apps/my-module/index.ts
import type { ArkAPI, ArkManifest } from "../../types/module.ts";

export const manifest: ArkManifest = {
  name: "my-module",
  version: "1.0.0",
  description: "Does something cool",
  icon: "🚀",
  permissions: ["storage", "network"],
};

export const run = (api: ArkAPI) => {
  api.registerRoute("GET", "/hello", async () => ({ message: "hi" }));
  // Routes are automatically prefixed: GET /my-module/hello
  // Storage is automatically scoped: storage/my-module/
};
```

Drop it in `src/apps/` — auto-discovered on startup.

## Testing

```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test --coverage         # With coverage report
bun run test:services       # Unit tests only
bun run test:apps           # Module tests only
bun run test:integration    # Integration tests only
```

Tests use `bun:test` (built-in). Docker-dependent modules are tested with mocked `execSync`. No external services needed to run tests.

## Project Structure

```
src/
  index.ts              # Entry point
  routes.ts             # Platform API routes
  types/
    module.ts           # ArkManifest + ArkAPI types
  apps/
    loader.ts           # Module auto-discovery (passes ArkAPI to each)
    hello-world/        # Example module
    minecraft/          # Minecraft server module
    email/              # Email aggregator module
    adblock/            # Pi-hole ad blocking module
  services/
    storage.ts          # File storage (scoped per module)
    ai.ts               # Ollama AI integration
  web/                  # React dashboard (Vite + Tailwind)
    src/pages/          # Dashboard, AIChat, Apps, Files
storage/                # Persistent data (Docker volume)
tests/
  services/             # Unit tests for services
  apps/                 # Module route tests
  integration/          # Full server integration tests
  helpers/              # Shared test utilities
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Default model |

## Stack

- **Runtime:** Bun
- **API:** Fastify v5
- **Linter:** Biome
- **UI:** React + Vite + Tailwind
- **Containers:** Docker
- **AI:** Ollama (local) + cloud fallback (coming)
