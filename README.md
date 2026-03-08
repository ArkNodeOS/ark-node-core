<div align="center">

# ✝ Ark Node Core

[![CI](https://github.com/ArkNodeOS/ark-node-core/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/ArkNodeOS/ark-node-core/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ArkNodeOS/ark-node-core/actions/workflows/codeql.yml/badge.svg)](https://github.com/ArkNodeOS/ark-node-core/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/ArkNodeOS/ark-node-core/branch/master/graph/badge.svg?token=YOUR_TOKEN)](https://codecov.io/gh/ArkNodeOS/ark-node-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3.x-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev)

**Personal sovereign server platform.** Local AI, modular apps, unified inbox, ad blocking, game servers — all running privately in your home.

*Arca Foederis — Your data. Your intelligence. Your Ark.*

</div>

---

## Quick Start

```bash
# Docker (recommended — builds UI automatically)
docker-compose up --build
# → http://localhost:3000/ui/

# Local dev
bun install
cd src/web && bun install && bun run build && cd ../..
bun run dev
```

## What's Inside

| Module | Routes | Description |
|--------|--------|-------------|
| 🌐 Router | `/router/*` | DNS, firewall, port forwarding, device discovery |
| ✉️ Email | `/email/*` | Unified IMAP inbox (Gmail, Yahoo, Outlook…) |
| ⛏️ Minecraft | `/minecraft/*` | One-click server via Docker |
| 🛡️ AdBlock | `/adblock/*` | Pi-hole network ad blocking |
| 📷 Photos | `/photos/*` | Media library with albums |
| 🔒 VPN | `/vpn/*` | WireGuard via wg-easy, QR peer setup |
| 💾 Backup | `/backup/*` | rsync jobs over SSH with scheduling |
| 📱 Phone Backup | `/phone-backup/*` | WebDAV server — connect iOS/Android directly |
| 🧠 Solomon | `/solomon` | Natural language → module routing |

**Web UI:** Dashboard · Solomon AI chat · Apps · Files · dedicated page per module

---

## Development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- Docker (optional, for module testing)
- Ollama (optional, for local AI)

### Run Tests

```bash
bun test                  # 120 tests across 11 files
bun test --coverage       # With line/function coverage report
bun test --watch          # Watch mode
```

### Lint

```bash
bunx biome check .        # Check
bunx biome check --fix .  # Auto-fix
```

### Build Web UI

```bash
cd src/web
bun install
bun run build
# dist/ is served at /ui/
```

---

## Writing a Module

Two styles supported — pick one:

**Decorator style (recommended):**
```ts
// src/apps/my-module/index.ts
import "reflect-metadata";
import { Module, Route, OnInit } from "../../decorators/index.ts";
import type { ArkAPI } from "../../types/module.ts";

@Module({
  name: "my-module",
  version: "1.0.0",
  description: "Does something cool",
  icon: "🚀",
  permissions: ["storage"],
})
export default class MyModule {
  declare _api: ArkAPI;

  @OnInit()
  async setup() {
    this._api.log("Ready");
  }

  @Route("GET", "/hello")
  async hello() {
    return { message: "hi" };
  }
  // → GET /my-module/hello
}
```

**Functional style:**
```ts
import type { ArkAPI, ArkManifest } from "../../types/module.ts";

export const manifest: ArkManifest = {
  name: "my-module",
  version: "1.0.0",
  description: "Does something cool",
  icon: "🚀",
  permissions: ["storage"],
};

export const run = (api: ArkAPI) => {
  api.registerRoute("GET", "/hello", async () => ({ message: "hi" }));
  // → GET /my-module/hello
};
```

Drop it in `src/apps/` — auto-discovered on startup.

---

## CI / CD

| Check | Trigger | What runs |
|-------|---------|-----------|
| **Lint & Type Check** | PR + push | Biome + `tsc --noEmit` (server + web) |
| **Tests & Coverage** | PR + push | `bun test --coverage` → Codecov |
| **Build Web UI** | PR + push | Vite build + bundle size check (<500KB) |
| **Docker Build** | PR + push | `docker buildx build` — pushes to GHCR on master |
| **Smoke Test** | master push | Container start → `/health` + `/ui/` must 200 |
| **Dev Container** | PR + push | Validates `.devcontainer/` builds clean |
| **Security Scan** | master push | Trivy → GitHub Security tab |
| **CodeQL** | PR + push + weekly | Static analysis for TypeScript |
| **Release** | `v*` tag | Multi-arch Docker push (amd64+arm64) + GitHub Release |

### Branches
- `master` — stable, all CI required to merge
- PRs — full CI runs, Docker build tested but not pushed

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Default model for Solomon |
| `PORT` | `3000` | Server port |

---

## Project Structure

```
src/
  index.ts              # Entry point + module loader
  routes.ts             # Platform routes + marketplace API
  types/module.ts       # ArkManifest + ArkAPI types
  decorators/index.ts   # @Module @Route @OnInit
  apps/
    loader.ts           # Auto-discovery (class + functional)
    hello-world/        # Reference module (decorator style)
    minecraft/          # Minecraft server
    email/              # IMAP email aggregator
    adblock/            # Pi-hole ad blocking
    photos/             # Media library
    router/             # DNS + firewall + port forwarding
    backup/             # rsync backup jobs
    vpn/                # WireGuard VPN
    phone-backup/       # WebDAV phone backup
  services/
    storage.ts          # Per-module file storage (path traversal safe)
    ai.ts               # Ollama integration
    solomon.ts          # NLP command router
  web/                  # React 18 + Vite + Tailwind dashboard
    src/pages/          # Sanctum · Solomon · Relics · Vault + module pages
storage/                # Persistent data (Docker volume in prod)
tests/
  services/             # Storage + AI unit tests
  apps/                 # Per-module route tests
  integration/          # Full server integration tests
  helpers/              # buildTestServer() + storage helpers
.github/workflows/
  ci.yml                # Main CI (lint, test, build, docker, security)
  release.yml           # Release (multi-arch Docker + GitHub Release)
  codeql.yml            # Weekly static analysis
```

---

## Related Repos

| Repo | Description |
|------|-------------|
| [ark-os](https://github.com/ArkNodeOS/ark-os) | Debian-based OS with one-line installer + A/B updates |
| [ark-registry](https://github.com/ArkNodeOS/ark-registry) | Module marketplace registry |
| [module-minecraft](https://github.com/ArkNodeOS/module-minecraft) · [module-email](https://github.com/ArkNodeOS/module-email) · [module-vpn](https://github.com/ArkNodeOS/module-vpn) · [module-router](https://github.com/ArkNodeOS/module-router) · [module-backup](https://github.com/ArkNodeOS/module-backup) · [module-adblock](https://github.com/ArkNodeOS/module-adblock) · [module-photos](https://github.com/ArkNodeOS/module-photos) | Standalone module packages |

---

## Stack

**Runtime:** Bun · **API:** Fastify v5 · **Validation:** Zod v4 · **Linter:** Biome · **UI:** React 18 + Vite + Tailwind · **Containers:** Docker · **AI:** Ollama (local)
