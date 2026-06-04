#!/bin/bash
# Deploy Critter Feature web build to coquin → critterfeature.com.
# Usage: ./deploy.sh (run from web/)
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Building production bundle..."
npm run build

echo "→ Rsyncing dist/ to coquin..."
rsync -av --delete --chmod=D755,F644 dist/ coquin:/var/www/critterfeature/

echo "→ Syncing nginx vhost (cache-control + TLS)..."
scp nginx.conf coquin:/etc/nginx/sites-available/critterfeature.com
ssh coquin "nginx -t && systemctl reload nginx"

echo "→ Verifying..."
HTML_HEADERS=$(curl -sI "https://critterfeature.com/?v=$(date +%s)")
if echo "$HTML_HEADERS" | grep -qi "Cache-Control: no-cache"; then
  echo "✓ HTML serves Cache-Control: no-cache"
else
  echo "✗ HTML Cache-Control missing!"
  echo "$HTML_HEADERS"
  exit 1
fi
curl -sf -o /dev/null https://critterfeature.com/ && echo "✓ https://critterfeature.com responding 200 OK"

echo "→ Done."
