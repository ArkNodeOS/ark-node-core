# Ark Node Core

A personal modular server OS backend. Host apps, manage storage, and run services — all from a single, extensible system.

## Quick Start

```bash
# Run with Docker
docker-compose up --build

# Or run locally with Bun
bun install
bun run dev
```

The server starts at **http://localhost:3000**.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Welcome message |
| GET | `/health` | Server health check |
| GET | `/status` | CPU, memory, uptime |
| GET | `/apps` | List loaded apps |
| GET | `/storage` | List stored files |
| GET | `/storage/:filename` | Read a file |
| POST | `/storage/:filename` | Save a file (body = content) |

Any unmatched route returns a `404` JSON response.

## Adding an App

Create a new folder under `src/apps/` with an `index.ts` that exports `name` and `run`:

```ts
// src/apps/my-app/index.ts
export const name = "my-app";

export const run = () => {
  console.log("My app is running!");
};
```

Apps are auto-discovered and loaded when the server starts.

## Project Structure

```
src/
  index.ts              # Entry point — server startup
  routes.ts             # API route registration
  apps/
    loader.ts           # App auto-discovery and loading
    hello-world/
      index.ts          # Example app
  services/
    storage.ts          # File storage manager
storage/                # User data (git-ignored)
docker-compose.yml
.devcontainer/
```

## Development

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** [Fastify](https://fastify.dev)
- **Linter/Formatter:** [Biome](https://biomejs.dev)
- **Hot reload:** `bun run dev` uses `--watch` mode

```bash
bun run lint     # Check code
bun run format   # Format code
```
