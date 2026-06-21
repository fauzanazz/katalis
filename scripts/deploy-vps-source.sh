#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-ops@114.215.202.65}"
APP_DIR="${DEPLOY_DIR:-/opt/katalis}"
ARCHIVE="${ARCHIVE:-/tmp/katalis-source.tar.gz}"
REMOTE_ARCHIVE="/tmp/katalis-source.tar.gz"

log() { printf '\n==> %s\n' "$*"; }

log "creating clean source archive"
python3 - <<'PY'
import gzip
import os
import subprocess
import tarfile
from pathlib import Path

archive = Path(os.environ.get("ARCHIVE", "/tmp/katalis-source.tar.gz"))
raw_files = subprocess.check_output(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
    text=True,
).splitlines()

# Keep explicit deploy files even while they are still untracked in local work.
for extra in [
    "Dockerfile",
    ".dockerignore",
    "docker-compose.prod.yml",
    "docs/deployment/vps-docker.md",
    "scripts/deploy-vps-source.sh",
    "scripts/deploy-vps-image.sh",
]:
    if extra not in raw_files and Path(extra).exists():
        raw_files.append(extra)

skip_names = {"package-lock.json", "pnpm-lock.yaml", ".DS_Store"}
skip_prefixes = (
    ".git/",
    ".agents/",
    ".claude/",
    ".codex/",
    ".factory/",
    ".pi/",
    ".planning/",
    ".atl/",
    "node_modules/",
    "assets/",
    ".output/",
    ".vercel/",
    ".nitro/",
    ".tanstack/",
    ".vite/",
    "public/uploads/",
)

files = []
for name in sorted(set(raw_files)):
    path = Path(name)
    if not path.exists() or not path.is_file():
        continue
    if path.name.startswith("._") or path.name in skip_names:
        continue
    if name.startswith(".env") or name.endswith(".db") or name.endswith(".db-journal"):
        continue
    if name.startswith(skip_prefixes):
        continue
    files.append(name)

archive.parent.mkdir(parents=True, exist_ok=True)
with gzip.open(archive, "wb", compresslevel=6) as gz:
    with tarfile.open(fileobj=gz, mode="w") as tar:
        for name in files:
            tar.add(name, arcname=name, recursive=False)

size = archive.stat().st_size
print(f"archive={archive} files={len(files)} bytes={size}")
PY
ls -lh "$ARCHIVE"
shasum -a 256 "$ARCHIVE"

log "preparing remote $HOST:$APP_DIR"
ssh "$HOST" "mkdir -p '$APP_DIR'"

log "uploading source archive"
rsync -a --progress --partial "$ARCHIVE" "$HOST:$REMOTE_ARCHIVE"

log "verifying upload"
local_sha="$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"
remote_sha="$(ssh "$HOST" "sha256sum '$REMOTE_ARCHIVE' | cut -d ' ' -f 1")"
if [[ "$local_sha" != "$remote_sha" ]]; then
  echo "SHA mismatch: local=$local_sha remote=$remote_sha" >&2
  exit 1
fi

log "extracting source"
ssh "$HOST" "set -euo pipefail
  mkdir -p '$APP_DIR'
  cd '$APP_DIR'
  find . -mindepth 1 ! -name .env.production -exec rm -rf {} +
  tar -xzf '$REMOTE_ARCHIVE'
  test -f Dockerfile
  test -f docker-compose.prod.yml
  test -f src/types/gallery.ts
  test -f project.inlang/settings.json
  test -f vite/dev-mock-storage.ts
"

log "configuring Docker mirror if needed"
ssh "$HOST" "set -euo pipefail
  sudo mkdir -p /etc/docker
  if ! sudo test -s /etc/docker/daemon.json; then
    printf '%s\n' '{"registry-mirrors":["https://docker.1ms.run","https://docker.m.daocloud.io"]}' | sudo tee /etc/docker/daemon.json >/dev/null
    sudo systemctl restart docker
  fi
"

log "building app on VPS"
ssh "$HOST" "set -euo pipefail
  cd '$APP_DIR'
  test -f .env.production || { echo 'Missing $APP_DIR/.env.production' >&2; exit 2; }
  docker compose -f docker-compose.prod.yml build app
"

log "starting app"
ssh "$HOST" "set -euo pipefail
  cd '$APP_DIR'
  docker compose -f docker-compose.prod.yml up -d --no-build app
  docker compose -f docker-compose.prod.yml ps
"

log "smoke test"
ssh "$HOST" "set -euo pipefail
  for attempt in 1 2 3 4 5; do
    status=\$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/id || true)
    if [ \"\$status\" = 200 ]; then
      echo \"http_status=200\"
      exit 0
    fi
    echo \"attempt=\$attempt http_status=\${status:-failed}\"
    sleep 3
  done
  cd '$APP_DIR'
  docker compose -f docker-compose.prod.yml logs --tail=80 app
  exit 1
"
