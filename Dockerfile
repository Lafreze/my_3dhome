FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_ASSET_BASE_URL=
ENV VITE_ASSET_BASE_URL=$VITE_ASSET_BASE_URL
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STUDIO_HOST=0.0.0.0
COPY --from=build --chown=node:node /app/dist/client ./dist/client
COPY --from=build --chown=node:node /app/scripts/serve-local.mjs ./scripts/serve-local.mjs
COPY --from=build --chown=node:node /app/scripts/seat-presence.mjs ./scripts/seat-presence.mjs
COPY --from=build --chown=node:node /app/scripts/house-settings.mjs ./scripts/house-settings.mjs
COPY --from=build --chown=node:node /app/config/house-defaults.json ./config/house-defaults.json
COPY --from=build --chown=node:node /app/config/wall-art-library.json ./config/wall-art-library.json
COPY --from=build /app/scripts/start-server.sh ./scripts/start-server.sh
COPY --from=build --chown=node:node /app/app/seat-catalog.json ./app/seat-catalog.json
COPY --from=build --chown=node:node /app/app/visitor-appearance.json ./app/visitor-appearance.json
COPY --from=build --chown=node:node /app/app/visitor-travel.mjs ./app/visitor-travel.mjs
COPY --from=build --chown=node:node /app/config/visitor-routes.json ./config/visitor-routes.json
ENV STUDIO_DATA_DIR=/data
RUN command -v runuser
EXPOSE 3000
CMD ["sh", "scripts/start-server.sh"]
