#!/bin/bash
set -e

cd /Users/enjat/Github/katalis

# Install dependencies (idempotent)
bun install 2>/dev/null || bun install

# Set up environment file if not exists
if [ ! -f ".env" ]; then
  cat > .env << 'EOF'
# AI (mocked for now)
OPENAI_API_KEY=sk-mock-openai-key
ANTHROPIC_API_KEY=sk-mock-anthropic-key
USE_MOCK_AI=true

# Cloudflare R2 (mocked for now)
R2_ACCOUNT_ID=mock-account-id
R2_ACCESS_KEY_ID=mock-access-key
R2_SECRET_ACCESS_KEY=mock-secret-key
R2_BUCKET_NAME=katalis-uploads
R2_PUBLIC_URL=http://localhost:3100/api/storage

# MapTiler
NEXT_PUBLIC_MAPTILER_KEY=mock-maptiler-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3100
DATABASE_URL=file:./prisma/dev.db
EOF
fi

# Push database schema (idempotent)
if [ -f "prisma/schema.prisma" ]; then
  bunx prisma generate
  bunx prisma db push --skip-generate
fi
