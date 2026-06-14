# China Access & Deployment

> Why the platform won't load in mainland China, and what to change.

## Root cause

The site is hosted on **Vercel**. The Great Firewall (GFW) throttles/resets
connections to Vercel's edge IPs and blocks the `*.vercel.app` domain. This is a
**network-path block**, not an application bug.

Diagnostic confirmation from the field report:

- Overseas proxy works → the app itself is fine; only the path into China is blocked.
- Domestic "VPN" fails → it still exits inside China, so traffic still crosses the
  GFW. Only an **overseas exit node** bypasses it. This is the classic GFW signature.

**No code change makes Vercel reachable from mainland China.** Reachability is a
hosting/infrastructure decision (below). The in-repo changes only remove the
*secondary* blockers that would break the app even after the host is reachable.

## Blocked dependencies

| Dependency | Where | China status | Fix |
|---|---|---|---|
| Vercel hosting | infra | **blocked/throttled — primary cause** | re-host (see options) |
| MapTiler `api.maptiler.com` | `GalleryMap.tsx` | throttled → map dead | CN tile source (done, env-gated) |
| OSM tiles `tile.openstreetmap.org` | `GalleryMap.tsx` | slow/throttled | CN tile source (done, env-gated) |
| Cloudflare R2 media (`R2_PUBLIC_URL`) | `storage/` | throttled → images/audio fail | CN media mirror (done, env-gated) |
| AI providers (Google/OpenRouter/x.ai/NVIDIA) | `lib/ai/providers/` | server-side; blocked **only if host moves into CN** | egress plan (below) |
| Google Fonts | `layout.tsx` | **not a problem** — `next/font/google` self-hosts at build time | none |

## Hosting options (the decision)

Pick based on how much you can invest. Only this layer fixes "won't load."

1. **Hong Kong / Singapore mirror — fastest, no filing.**
   Deploy a mirror to Alibaba Cloud HK or Tencent HK/SG. No ICP filing required.
   These IPs are usually not blocked. Latency is mediocre but the site *loads* —
   best option for an imminent school test.

2. **Mainland host + ICP 备案 — reliable, slow to set up.**
   Host on Aliyun/Tencent mainland with an ICP license. Requires a China business
   entity; filing takes ~2–4 weeks. Only path to reliable mainland performance.

3. **China CDN in front (Tencent EdgeOne / Aliyun DCDN).**
   Keep an overseas origin, front it with a CN CDN. Still needs ICP for mainland
   PoPs; partial/throttled without one.

## AI provider egress plan (only if the host moves into China)

Server-side AI calls currently run from Vercel (outside China), so providers are
reachable today. If you re-host **inside mainland China**, these providers become
GFW-blocked from the server too:

- `generativelanguage.googleapis.com` (Google) — blocked
- `api.x.ai`, `openrouter.ai`, `integrate.api.nvidia.com` — blocked/throttled

Mitigations, in order of preference:

1. **Egress proxy** — route provider traffic through an overseas exit. Set
   `HTTPS_PROXY` on the server, or give each OpenAI-compatible client an overseas
   `baseURL`. Providers and their `baseURL`s live in `src/lib/ai/providers/`.
2. **China-reachable gateway** — front the providers with a gateway that has an
   overseas egress (e.g. a self-hosted relay in HK), and point `baseURL` at it.
3. **China-available models** — switch `AI_PROVIDER` to a domestically-served model
   (e.g. a Chinese vendor) for CN traffic. Largest change; affects prompts/quality.

> A HK/SG mirror (option 1) avoids this entirely — the server is still outside the
> GFW, so providers stay reachable with no egress changes.

## In-repo changes already made (host-independent, env-gated, no-op until configured)

- **Map tiles** — `zh` locale uses `NEXT_PUBLIC_CN_TILE_URL` (a `{x}/{y}/{z}`
  raster template, e.g. Tianditu 天地图) instead of MapTiler/OSM.
- **Media** — `zh` locale rewrites media origin from `NEXT_PUBLIC_R2_PUBLIC_URL` to
  `NEXT_PUBLIC_CN_MEDIA_URL` (e.g. Aliyun OSS) via `localizeMediaUrl`.

See `.env.example` for the variables and a working Tianditu URL template.

### Tianditu notes

- Free key (`tk`) from https://console.tianditu.gov.cn/ (whitelist your domain).
- `vec_w` is web-mercator and uses CGCS2000 ≈ WGS84, so it aligns with the gallery's
  WGS84 coordinates (no GCJ-02 offset). Coverage is excellent for China, sparse
  internationally — acceptable for a CN-focused launch.
- For street labels, add a second annotation layer (`cva_w`); base tiles ship now.
