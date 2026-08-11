# TASKS — Migração institucional.condor.com.br

Checklist por milestone. `[ ]` pendente · `[x]` feito.

> **Fonte da verdade: o Directus na nuvem** (já populado). O modelo abaixo espelha
> as coleções reais, não o audit do WordPress. Ver §"Modelo de dados" no `CLAUDE.md`.

## M0 — Docs
- [x] PRD (`docs/prd.md`)
- [x] SPEC (`docs/spec.md`)
- [x] POC (`docs/poc.md`)
- [x] TASKS (`docs/tasks.md`)
- [ ] `directus/policies/editor.md` (guardrails de editor)

## M1 — Scaffold ✅
- [x] Scaffold Astro (output `static`, TS strict) — `package.json`, `astro.config.mjs`, `tsconfig.json`
- [x] Tailwind v4 via `@tailwindcss/vite` + `src/styles/global.css` com `@theme` (tokens, 2 temas)
- [x] Fonts self-hosted Montserrat + Nunito (`@fontsource`, importadas no BaseLayout)
- [x] `BaseLayout.astro` com `<ClientRouter />` + `<head>` (meta, OG, sitemap, tema pré-paint)
- [x] `src/lib/directus.ts` (cliente SDK + helpers tipados, degrada sem env) · `.env.example` bloqueado por guard → env documentado no CLAUDE.md
- [x] `src/lib/types.ts` (tipos do schema real) + `src/lib/format.ts`
- [x] `Header.astro` / `Footer.astro` — `menu_items` (tree) + `redes_sociais`

## M2 — POC (Home + Localizador de Lojas)
- [x] Reveal on scroll (IntersectionObserver + `prefers-reduced-motion`) — em `global.css` + `BaseLayout`
- [x] `src/pages/index.astro` — Home: hero + shortcuts + Notícias (4-up) + Lojas (4-up) + reveals
- [x] `NoticiaCard.astro` / `LojaCard.astro` (thumbnail centralizado, grade 4-up)
- [x] Filtro client-side por `cidade` (select) + `setores` (chips, facetas derivadas) + busca — em `nossas-lojas/index.astro`
- [x] `src/pages/nossas-lojas/index.astro` — fetch das **73 lojas** do Directus (grade 4-up)
- [x] `src/pages/nossas-lojas/[slug].astro` — detalhe (horários HTML, telefone, `link_maps`, lat/lng, setores, serviços)
- [~] Critérios de aceitação de `docs/poc.md` — dados reais ✅, filtros ✅, reveals/transições ✅; **falta** rodar Lighthouse

> **Rotas: URLs do CMS** (decisão). Lista `/nossas-lojas`, detalhe `/nossas-lojas/[slug]`, notícias `/noticias`, institucional `/institucional`. Menu do Directus não é tocado.

## M3 — Conteúdo (pages, notícias, navegação)
- [x] `noticias/index.astro` (pág. 1) + `noticias/pagina/[page].astro` (2…64) — lista paginada de **758**
- [x] `src/pages/noticias/[slug].astro` — detalhe (`content` HTML + prose, `image`, `data`, OG) — 1 fetch, sem N+1
- [x] `Pagination.astro` (janela + gaps) · `.prose-condor` em `global.css`
- [x] Navegação `menus` header (dropdowns) + **menu mobile** (drawer, submenus colapsáveis) + footer bottom-1/2
- [x] `redes_sociais` no footer + topbar
- [x] `pages` (18) em `/{categoria}/{slug}` + landing `/[categoria]/` (grid) — decisão: URL canônica `/{categoria}/{slug}`
- [x] Alinhamento de links do menu: "Nossa História" corrigido no CMS `/nossa-historia` → `/institucional/nossa-historia`. Varredura dos 7 menu_items internos → todos resolvem contra rotas reais (sem 404s).

## M4 — Directus schema-as-code + guardrails
- [ ] `directus schema snapshot` → `directus/schema/snapshot.yaml` (versionado)
- [ ] Role `Editor` + access policies por coleção/campo + presets/bookmarks
- [ ] Campos técnicos (`id`, `slug`, timestamps, `sort`) `hidden`/`readonly`; interfaces curadas
- [ ] System collections ocultas para o role Editor

## M5 — SEO, redirects e pipeline de publicação
- [ ] SEO por página a partir de `pages.seo` (json) + fallbacks; `@astrojs/sitemap`
- [ ] Redirects 301 (mapa URLs WP → Astro) via config do host / `astro:redirects`
- [ ] Flow `rebuild-on-publish` (webhook → `DEPLOY_HOOK_URL`) → `directus/flows/`
- [ ] Deploy produtivo (host estático + CDN)
- [ ] Corte de DNS + verificação de redirects (zero 404 nas URLs do WP)

## Fora do escopo atual (não modelado no Directus)

Estas coleções **não existem** na instância atual. Só entram se o cliente pedir e após modelagem:
`ofertas`, `tabloides` (PDF + vigência + cron de expiração), `campanhas`, `banners`,
`depoimentos`, `autoposto`. Enquanto não existirem, **não há** tasks de ETL nem cron de expiração.
