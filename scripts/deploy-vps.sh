#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-ops@114.215.202.65}"
APP_DIR="${DEPLOY_DIR:-/opt/katalis}"
COMPOSE_FILE="docker-compose.prod.yml"

ssh "$HOST" "mkdir -p '$APP_DIR'"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.output' \
  --exclude '.vercel' \
  --exclude '.nitro' \
  --exclude '.tanstack' \
  --exclude '.vite' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'public/uploads' \
  --exclude '*.db' \
  --exclude '*.db-journal' \
  --exclude 'package-lock.json' \
  --exclude 'pnpm-lock.yaml' \
  --exclude '.agents' \
  --exclude '.claude' \
  --exclude '.codex' \
  --exclude '.factory' \
  --exclude '.pi' \
  --exclude '.planning' \
  --exclude '.atl' \
  ./ "$HOST:$APP_DIR/"

ssh "$HOST" "cd '$APP_DIR' && test -f .env.production || { echo 'Missing $APP_DIR/.env.production' >&2; exit 2; } && docker compose -f '$COMPOSE_FILE' up -d --build && docker compose -f '$COMPOSE_FILE' ps"
