FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_ASSET_BASE_URL=
ENV VITE_ASSET_BASE_URL=$VITE_ASSET_BASE_URL
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STUDIO_HOST=0.0.0.0
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist/client ./dist/client
COPY --from=build --chown=node:node /app/scripts/serve-local.mjs ./scripts/serve-local.mjs
COPY --from=build --chown=node:node /app/scripts/seat-presence.mjs ./scripts/seat-presence.mjs
COPY --from=build --chown=node:node /app/scripts/house-settings.mjs ./scripts/house-settings.mjs
COPY --from=build --chown=node:node /app/scripts/room-notes.mjs ./scripts/room-notes.mjs
COPY --from=build --chown=node:node /app/scripts/model-library.mjs ./scripts/model-library.mjs
COPY --from=build --chown=node:node /app/scripts/model-storage.mjs ./scripts/model-storage.mjs
COPY --from=build --chown=node:node /app/scripts/model-compression.mjs ./scripts/model-compression.mjs
COPY --from=build --chown=node:node /app/scripts/model-compression-worker.mjs ./scripts/model-compression-worker.mjs
COPY --from=build --chown=node:node /app/scripts/lib/r2-client.mjs ./scripts/lib/r2-client.mjs
COPY --from=build --chown=node:node /app/scripts/lib/asset-policy.mjs ./scripts/lib/asset-policy.mjs
COPY --from=build --chown=node:node /app/config/exhibit-catalog.json ./config/exhibit-catalog.json
COPY --from=build --chown=node:node /app/config/house-defaults.json ./config/house-defaults.json
COPY --from=build --chown=node:node /app/config/wall-art-library.json ./config/wall-art-library.json
COPY --from=build /app/scripts/start-server.sh ./scripts/start-server.sh
COPY --from=build --chown=node:node /app/app/seat-catalog.json ./app/seat-catalog.json
COPY --from=build --chown=node:node /app/app/visitor-appearance.json ./app/visitor-appearance.json
COPY --from=build --chown=node:node /app/app/visitor-expressions.json ./app/visitor-expressions.json
COPY --from=build --chown=node:node /app/app/visitor-social.json ./app/visitor-social.json
COPY --from=build --chown=node:node /app/app/visitor-activities.json ./app/visitor-activities.json
COPY --from=build --chown=node:node /app/app/visitor-travel.mjs ./app/visitor-travel.mjs
COPY --from=build --chown=node:node /app/app/seat-transfer.mjs ./app/seat-transfer.mjs
COPY --from=build --chown=node:node /app/app/character-scale.mjs ./app/character-scale.mjs
COPY --from=build --chown=node:node /app/config/visitor-routes.json ./config/visitor-routes.json
ENV STUDIO_DATA_DIR=/data
RUN command -v runuser
EXPOSE 3000
CMD ["sh", "scripts/start-server.sh"]
