#!/bin/sh
set -eu
mkdir -p "$STUDIO_DATA_DIR"
if [ "$(id -u)" = 0 ]; then
  chown node:node "$STUDIO_DATA_DIR"
  chmod 700 "$STUDIO_DATA_DIR"
  exec runuser -u node -- node scripts/serve-local.mjs
fi
exec node scripts/serve-local.mjs
