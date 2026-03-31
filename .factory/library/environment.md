# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Required Environment Variables

| Variable | Description | Mock Value |
|----------|-------------|------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o vision | `sk-mock-openai-key` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | `sk-mock-anthropic-key` |
| `USE_MOCK_AI` | Toggle mock AI responses | `true` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | `mock-account-id` |
| `R2_ACCESS_KEY_ID` | R2 access key | `mock-access-key` |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | `mock-secret-key` |
| `R2_BUCKET_NAME` | R2 bucket name | `katalis-uploads` |
| `R2_PUBLIC_URL` | Public URL for R2 files | `http://localhost:3100/api/storage` |
| `NEXT_PUBLIC_MAPTILER_KEY` | MapTiler API key for map tiles | `mock-maptiler-key` |
| `NEXT_PUBLIC_APP_URL` | Application base URL | `http://localhost:3100` |
| `DATABASE_URL` | Prisma database connection string | `file:./prisma/dev.db` |

## External Dependencies

- **OpenAI API** (GPT-4o): Used for multimodal analysis of children's artifacts. MOCKED for MVP.
- **Anthropic API** (Claude): Used for quest generation reasoning. MOCKED for MVP.
- **Cloudflare R2**: S3-compatible object storage for file uploads. MOCKED with local filesystem for MVP.
- **MapTiler**: Map tile provider for the interactive world map. Free tier.

## Mock Strategy

When `USE_MOCK_AI=true`:
- AI endpoints return deterministic JSON responses from `src/lib/ai/mock/` files
- R2 storage falls back to local filesystem (`public/uploads/`)
- MapTiler uses OpenStreetMap fallback tiles if key is invalid

## Platform Notes

- **bun v1.3.3**: Package manager and runtime
- **Node.js v24.11.1**: Available as fallback runtime
- **SQLite**: File-based database via Prisma, no external DB server needed
- **macOS ARM (Apple Silicon)**: Development platform
