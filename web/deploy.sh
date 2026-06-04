#!/bin/bash
# Deploy Critter Feature web build to coquin → critterfeature.com.
# Usage: ./deploy.sh (run from web/)
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Building production bundle..."
npm run build

echo "→ Rsyncing dist/ to coquin..."
rsync -av --delete --chmod=D755,F644 dist/ coquin:/var/www/critterfeature/

echo "→ Verifying..."
curl -sf -o /dev/null https://critterfeature.com/ && echo "✓ https://critterfeature.com responding 200 OK"

echo "→ Done."
