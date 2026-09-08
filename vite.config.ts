import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
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
      configureServer(server) {
        const handlePresence = createPresenceHandler();
        server.middlewares.use((req, res, next) => {
          void handlePresence(req, res)
            .then((handled) => {
              if (!handled) next();
            })
            .catch(next);
        });
      },
    },
    vinext(),
  ],
});
