# modding-versioning

A Cloudflare Workers dashboard that tracks the version status of all declared dependencies across Minecraft mod repositories, with smart source detection and streaming SSE updates.

## Features

- **Automatic source detection** — identifies dependencies from Modrinth, CurseForge, Fabric, Forge, NeoForge, or plain Maven repos by inspecting SPDX package names
- **Build-script aware filtering** — parses `settings.gradle.kts`, `build.gradle.kts`, and `gradle/libs.versions.toml` to only surface explicitly declared dependencies (skipping transitive noise)
- **Multi-repo dashboard** — track multiple repositories at once with per-source filter chips
- **Streaming results** — deps appear in the table as each one resolves via Server-Sent Events; no waiting for the full batch
- **Progress indicator** — shows `X / N · <artifact>` while checking
- **Version overrides** — per-repo manual overrides stored in KV for packages that need custom version lookup logic
- **KV caching** — per-dep 1-hour cache; full result 5-minute cache

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | [Hono](https://hono.dev) |
| Cache / Storage | Workers KV |
| SBOM source | GitHub Dependency Graph API (SPDX 2.3) |
| Language | TypeScript |

## Supported Sources

| Source | How detected | Version lookup |
|---|---|---|
| **Modrinth** | `maven.modrinth` group | Modrinth API v2 |
| **CurseForge** | `curse.maven` group | CurseForge API v1 |
| **Fabric Loader** | `net.fabricmc:fabric-loader` | Fabric Meta API |
| **Forge** | `net.minecraftforge:forge` | `maven.minecraftforge.net` |
| **NeoForge** | `net.neoforged:neoforge` | `maven.neoforged.net/releases` |
| **Maven** | Mapped repos from build scripts | `maven-metadata.xml` |

## Setup

### 1. KV Namespace

```sh
wrangler kv namespace create VERSION_CACHE
```

Copy the printed ID into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "VERSION_CACHE"
id = "YOUR_KV_NAMESPACE_ID"
```

### 2. Secrets

Set via `wrangler secret put` (do **not** commit real values):

```sh
wrangler secret put GITHUB_TOKEN       # GitHub PAT — bypasses 60 req/h anon limit
wrangler secret put CURSEFORGE_API_KEY # Required for CurseForge lookups
wrangler secret put ACCESS_TOKEN       # Shared secret for write API (optional)
```

For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in values.

### 3. Dev / Deploy

```sh
pnpm dev      # wrangler dev
pnpm deploy   # wrangler deploy
```

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | — | Dashboard HTML |
| `GET` | `/api/stream?owner=&repo=` | optional | SSE stream of version results |
| `GET` | `/api/check?owner=&repo=` | optional | Full result JSON (cached) |
| `GET` | `/api/repos` | — | List tracked repos |
| `POST` | `/api/repos` | ✓ | Add a repo |
| `DELETE` | `/api/repos/:owner/:repo` | ✓ | Remove a repo |
| `GET` | `/api/overrides?owner=&repo=` | — | Get version overrides |
| `PUT` | `/api/overrides?owner=&repo=` | ✓ | Set version overrides |
| `GET` | `/api/parse?owner=&repo=` | optional | Return parsed build-script deps only |

Set `PARSE_REQUIRES_AUTH=true` to require the `ACCESS_TOKEN` header on read endpoints.

### SSE Events (`/api/stream`)

```
event: context  data: { context: ProjectContext, total: number }
event: checking data: { name: string }          // dep starting
event: dep      data: VersionCheckResult        // dep finished
event: done     data: {}
event: error    data: { message: string }
```

## Gradle DSL Support

The parser understands the `lazyyyyy`-style custom Kotlin DSL:

```kotlin
// settings.gradle.kts
dependency("jei", "mezz.jei") {
    artifact { "jei-${minecraftVersion}-${loader.id}-${it}" }
}
modrinth("jade") { "Jade-${loader.id}-${minecraftVersion}-${it}" }
library("mixin-fabric", "net.fabricmc", "sponge-mixin")
```

`library("name","group","artifact")` entries map to exact `group:artifact` coordinates and never open wildcard group matching (which would pull in internal packages like `net.fabricmc:intermediary`).

## Project Structure

```
src/
  index.tsx       — Hono app / route handlers
  dashboard.tsx   — TSX dashboard document component (SSR to HTML string)
  checker.ts      — Main orchestration + SSE stream
  parser.ts       — Gradle build-script / TOML parser
  detector.ts     — Source detection + dep grouping
  github.ts       — GitHub SBOM + file fetch
  frontend.ts     — Dashboard HTML/CSS/JS (inlined)
  auth.ts         — Token verification
  repos.ts        — Repo list KV operations
  overrides.ts    — Override KV operations
  cache.ts        — cachedFetch helper
  types.ts        — Shared TypeScript types
  sources/
    fabric.ts     — Fabric Meta API
    maven.ts      — maven-metadata.xml fetch
    modrinth.ts   — Modrinth API v2
    curseforge.ts — CurseForge API v1
```
