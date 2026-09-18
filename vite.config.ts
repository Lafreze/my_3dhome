import { createStudioDatabase } from './scripts/studio-database.mjs';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { createVisitStore } from './scripts/visitor-analytics.mjs';
import { createHouseHandler } from './scripts/house-settings.mjs';
import { resolve } from 'node:path';
import { createPresenceHandler } from './scripts/seat-presence.mjs';

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  server: {
    host: '127.0.0.1',
    ...(process.env.CODEX_SANDBOX === 'seatbelt'
      ? { watch: { useFsEvents: false, usePolling: true } }
      : {}),
  },
  plugins: [
    {
      name: 'local-seat-presence',
      async configureServer(server) {
        const dataDir =
          process.env.STUDIO_DATA_DIR || resolve('output/server-data');
        const database = await createStudioDatabase(dataDir);
        const analytics = await createVisitStore(dataDir, Date.now, {
          database,
        });
        const handleHouse = await createHouseHandler({
          dataDir,
          analytics,
          database,
          secureCookies: false,
        });
        server.httpServer?.on('close', () => {
          void analytics.close();
          void database?.close();
        });
        const handlePresence = createPresenceHandler();
        server.middlewares.use((req, res, next) => {
          void (async () => {
            if (await handleHouse(req, res)) return;
            if (await handlePresence(req, res)) return;
            const path = new URL(req.url || '/', 'http://localhost').pathname;
            await analytics.page(req, res, path);
            next();
          })().catch(next);
        });
      },
    },
    vinext(),
  ],
});
