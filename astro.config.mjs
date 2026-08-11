// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// ponytail: site URL provisório — trocar pelo domínio real no corte de DNS.
export default defineConfig({
  site: 'https://institucional.condor.com.br',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // ponytail: '.ngrok-free.app' cobre qualquer subdomínio do túnel (a URL free muda a cada sessão).
    server: { allowedHosts: ['.ngrok-free.app'] },
  },
});
