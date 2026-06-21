# VPS Docker deployment

Target host: `ops@114.215.202.65`
App directory: `/opt/katalis`
Runtime port: `127.0.0.1:3000`

## 1. Server prerequisites

```bash
ssh ops@114.215.202.65
sudo apt-get update
sudo apt-get install -y ca-certificates curl rsync
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ops
exit
```

Log in again after adding `ops` to the `docker` group.

## 2. Production env file

Create `/opt/katalis/.env.production` on the server. Do not commit this file.

Required baseline:

```dotenv
NODE_ENV=production
SESSION_SECRET=<openssl-rand-hex-32>
CRON_SECRET=<openssl-rand-hex-32>
DATABASE_URL=file:/data/prod.db
# Or use hosted Turso/libSQL instead:
# TURSO_DATABASE_URL=<turso-url>
# TURSO_AUTH_TOKEN=<turso-token>

AI_PROVIDER=openai
OPENAI_API_KEY=<key>
ANTHROPIC_API_KEY=<key-if-used>
GOOGLE_AI_API_KEY=<key-if-used>
GOOGLE_AI_MODEL=gemini-2.5-flash
USE_MOCK_AI=false

R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET_NAME=katalis-uploads
R2_PUBLIC_URL=<https://public-r2-domain>
NEXT_PUBLIC_R2_PUBLIC_URL=<https://public-r2-domain>
NEXT_PUBLIC_APP_URL=https://<domain>
NEXT_PUBLIC_MAPTILER_KEY=<key>
# NEXT_PUBLIC_CN_TILE_URL=
# NEXT_PUBLIC_CN_TILE_ATTRIBUTION=
# NEXT_PUBLIC_CN_MEDIA_URL=
```

Generate secrets:

```bash
openssl rand -hex 32
```

## 3. Deploy from local machine

```bash
./scripts/deploy-vps.sh
```

Override target if needed:

```bash
DEPLOY_HOST=ops@114.215.202.65 DEPLOY_DIR=/opt/katalis ./scripts/deploy-vps.sh
```

The script syncs source, requires existing `.env.production`, builds image on server, and runs:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 4. Database migration

Run after first deploy and before traffic if schema changed:

```bash
ssh ops@114.215.202.65
cd /opt/katalis
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

Preferred production database is Turso/libSQL via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.

## 5. Reverse proxy

Point Nginx/Caddy to `http://127.0.0.1:3000`.

Minimal Nginx server block:

```nginx
server {
  listen 80;
  server_name <domain>;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Add TLS with Certbot or use Caddy for automatic HTTPS.

## 6. Cron replacement

`vercel.ts` crons do not run on VPS. Add host crontab entries:

```cron
0 6 * * 1 curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/reliability-snapshot >/dev/null
0 4 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/cleanup-guests >/dev/null
0 3 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/data-retention-purge >/dev/null
```

## 7. Operations

```bash
ssh ops@114.215.202.65
cd /opt/katalis
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml restart app
```
