// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// ponytail: site URL provisório — trocar pelo domínio real no corte de DNS.
export default defineConfig({
  site: 'https://institucional.condor.com.br',
  // SSR: dados do Directus são lidos por request (token via env de runtime).
  // Motivo: a imagem SSG (945 páginas) não passava no unpacking do Docker no deploy.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // ponytail: '.ngrok-free.app' cobre qualquer subdomínio do túnel (a URL free muda a cada sessão).
    server: { allowedHosts: ['.ngrok-free.app'] },
    // ponytail: preview serve arquivos estáticos atrás do proxy do Coolify — allowedHosts irrelevante aqui.
    preview: { allowedHosts: true },
  },
});
