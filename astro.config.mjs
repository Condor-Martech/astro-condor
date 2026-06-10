// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

const SITE_URL = process.env.DIRECTUS_URL?.replace(/\/$/, '') || 'https://condor.cndr.me';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: true,
    },
  },

  integrations: [react(), icon({ include: { 'fa6-brands': ['*'] } })],
});
