#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-ops@114.215.202.65}"
APP_DIR="${DEPLOY_DIR:-/opt/katalis}"
IMAGE="${IMAGE:-katalis:latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
ARCHIVE="${ARCHIVE:-/tmp/katalis-image.tar.gz}"

log() { printf '\n==> %s\n' "$*"; }

log "building $IMAGE for $PLATFORM"
docker buildx build --platform "$PLATFORM" --progress=plain -t "$IMAGE" --load .

log "packing image to $ARCHIVE"
docker save "$IMAGE" | gzip -1 > "$ARCHIVE"
ls -lh "$ARCHIVE"

log "preparing remote $HOST:$APP_DIR"
ssh "$HOST" "mkdir -p '$APP_DIR'"

log "uploading compose files"
rsync -az --progress --partial \
  docker-compose.prod.yml \
  docs/deployment/vps-docker.md \
  "$HOST:$APP_DIR/"

log "uploading image archive"
# Archive is already gzip-compressed. Do not use rsync -z here: recompressing
# compressed bytes can crawl on older rsync/SSH stacks.
rsync -a --progress --partial "$ARCHIVE" "$HOST:/tmp/katalis-image.tar.gz"

log "loading image and restarting app"
ssh "$HOST" "set -euo pipefail
  cd '$APP_DIR'
  test -f .env.production || { echo 'Missing $APP_DIR/.env.production' >&2; exit 2; }
  docker load -i /tmp/katalis-image.tar.gz
  docker compose -f docker-compose.prod.yml up -d --no-build app
  docker compose -f docker-compose.prod.yml ps
"

log "smoke test"
ssh "$HOST" "node -e \"fetch('http://127.0.0.1:3000/id').then(r=>{console.log('http_status='+r.status); process.exit(r.ok?0:1)}).catch(e=>{console.error(e); process.exit(1)})\""
