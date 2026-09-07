FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STUDIO_HOST=0.0.0.0
COPY --from=build --chown=node:node /app/dist/client ./dist/client
COPY --from=build --chown=node:node /app/scripts/serve-local.mjs ./scripts/serve-local.mjs
USER node
EXPOSE 3000
CMD ["node", "scripts/serve-local.mjs"]
