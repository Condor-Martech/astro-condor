# CLAUDE.md — astro-condor

Migração do site institucional **institucional.condor.com.br** de WordPress+Elementor para **Astro 5 (SSG) + Directus (CMS self-hosted, na nuvem do cliente)**.

## Idioma (regra)

- **Arquivos/outputs escritos em disco** (docs, código, copy, comentários de conteúdo): **português do Brasil**.
- **Conversa com o usuário**: espanhol rioplatense.
- Termos técnicos (SSG, build, webhook, self-host, etc.) podem ficar em inglês.

## Stack

| Área | Decisão |
|------|---------|
| Front | Astro 5, `output: 'static'` (SSG) |
| Estilos | Tailwind v4 (CSS-first, `@theme`, sem `tailwind.config.js`) via `@tailwindcss/vite` |
| Animações | Astro View Transitions (`<ClientRouter />`) entry/exit + CSS `@keyframes` com `IntersectionObserver`. Respeita `prefers-reduced-motion`. Zero deps de animação. |
| CMS | Directus self-hosted (nuvem) — requisito LGPD |
| Data | `@directus/sdk`, lido em build time, `fields` explícitos (nunca `*`) |
| Publicação | SSG + Directus Flow (webhook) → deploy hook + cron diário (expirações de tabloides) |

Repo **monolítico**, **um único deployable** (o front). Sem pnpm workspaces. Directus vive fora, na nuvem.

## Identidade visual (fonte da verdade — CSS real verificado)

- Navy primário `#01437D` (**NÃO é vermelho** — suposição típica de supermercado, verificada falsa).
- Vermelho de acento `#c01100` / `#d10404`.
- Neutros `#54595F`, `#484848`; linha `#e1e5eb`.
- Tipografia: **Montserrat** (títulos) + **Nunito** (corpo), self-hosted.
- Amarelo do logo: ainda **não** é token (só imagem) → confirmar antes de usar.

## Modelo de dados (Directus na nuvem — fonte da verdade, verificado via MCP)

Coleções **reais** na instância (já populadas). O modelo é **plano** (sem M2M):

- `lojas` — **73**. `nome`, `slug`, `cidade` (string livre), `telefone`, `link_maps`, `latitude`, `longitude`, `image`, `horarios` (HTML), `setores` (CSV texto), `servicos` (CSV texto). **Sem `endereco`; sem M2M.**
- `noticias` — **758**. Blog: `titulo`, `slug`, `data_publicacao`, `resumo`, `content` (HTML), `image`.
- `pages` — **18**. Institucionais: `titulo`, `slug`, `categoria`, `image`, `content` (HTML), `seo` (json).
- `menus` (3) + `menu_items` — navegação. `menus.position`: `header`, `bottom-1/2/3`; `menu_items` com `parent`/`children` (tree), `label`, `url`, `target`.
- `redes_sociais` — **6**. `label`, `url`, `icon`.
- `hero_slides` — **2**. Carrossel da Home: `title`, `subtitle`, `cta_label`, `cta_href`, `image_desktop`, `image_mobile`.

Todas com `status` (published/draft/archived) + `sort` onde aplica → filtrar por `status: published` no fetch.

**NÃO existe** (fora do escopo atual): `ofertas`, `tabloides`, `campanhas`, `banners`, `depoimentos`, `autoposto`, coleções de taxonomia (`cidades`/`setores`/`conveniencias`). Sem ETL do WP (dados já na nuvem).

## Directus MCP

O MCP do Directus está configurado em `.mcp.json` (local server `@directus/content-mcp` via npx). Usado para **modelar coleções, campos e relações** por linguagem natural.

Variáveis de ambiente (expandidas pelo Claude Code a partir do shell — **não** commitar valores):
- `DIRECTUS_URL` — URL da instância na nuvem.
- `DIRECTUS_TOKEN` — static token de um usuário admin (User Directory → usuário → Token → Generate → **salvar**).

Ao modelar: taxonomias como **coleções + M2M** (não texto livre); campos técnicos (`slug`, `id`, timestamps) `hidden`/`readonly`.

## Guardrails de editor (risco conhecido)

Directus expõe o modelo de dados ao editor. Mitigar por **configuração, não código**: role `Editor` com access policies por coleção/campo, presets/bookmarks por role, system collections ocultas, interfaces curadas. Extensão custom só se um caso concreto exigir. Ver `directus/policies/editor.md`.

## Comandos

```bash
pnpm dev          # dev server
pnpm build        # build estático → dist/
pnpm astro check  # checagem de tipos
```

Regras: nunca rodar `build` após mudanças sem pedido explícito. Usar `bat`/`rg`/`fd`/`eza` no lugar de `cat`/`grep`/`find`/`ls`.

## Docs do projeto

- `docs/prd.md` — requisitos de produto
- `docs/spec.md` — spec técnica (arquitetura, modelo, tokens, fetching, SEO)
- `docs/poc.md` — POC (Home + Localizador de Lojas) e critérios de aceitação
- `docs/tasks.md` — checklist por milestone (M0→M5)

## Fora de escopo

E-commerce/carrinho (vive em `condoremcasa`, `clubecondor`, `campanha` — só links), redesign de marca, CPTs legados.
