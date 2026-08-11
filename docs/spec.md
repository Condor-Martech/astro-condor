# SPEC técnica — Astro + Directus

## 1. Arquitetura

```
┌─────────────┐   readItems (@directus/sdk)   ┌──────────────────┐
│  Astro SSG  │ ◄──────────────────────────── │ Directus (nuvem, │
│  (build)    │                                │ self-hosted)     │
└──────┬──────┘                                └────────▲─────────┘
       │ astro build → estático                         │
       ▼                                                 │ Flow (webhook on publish)
┌──────────────┐        POST DEPLOY_HOOK_URL             │
│ Host estático│ ◄──────────────────────────────────────┘
│ (CDN)        │ ◄──── cron diário (rebuild expirações)
└──────────────┘
```

- **Front**: Astro 5, `output: 'static'`. Sem servidor Node em produção.
- **Dados**: lidos em build time do Directus via `@directus/sdk`.
- **Publicação**: um **Flow** do Directus (trigger: item publicado) faz `POST` para o `DEPLOY_HOOK_URL` do host → dispara rebuild. Um **cron diário** faz rebuild para aplicar expirações de tabloides.

## 2. Modelo de dados Directus

Coleções **reais** na nuvem (verificadas via MCP, já populadas). Modelo **plano**, sem M2M:

| Coleção | Campos-chave | Notas |
|---------|-------------|-------|
| `lojas` | nome, slug, cidade (string), telefone, link_maps, latitude, longitude, image, horarios (HTML), setores (CSV), servicos (CSV) | 73 · sem endereco, sem M2M |
| `noticias` | titulo, slug, data_publicacao, resumo, content (HTML), image | 758 · blog |
| `pages` | titulo, slug, categoria, image, content (HTML), seo (json) | 18 · institucionais |
| `menus` + `menu_items` | menus.position (header/bottom-1/2/3); menu_items: label, url, target, parent/children (tree) | navegação |
| `redes_sociais` | label, url, icon | 6 |
| `hero_slides` | title, subtitle, cta_label, cta_href, image_desktop, image_mobile | 2 · carrossel Home |

- Todas com `status` (published/draft/archived) + `sort` onde aplica → fetch filtra `status: published`.
- Taxonomias são **texto** (`cidade` string, `setores`/`servicos` CSV) — filtro do localizador faz split no client.
- **Não existem** no Directus atual: `ofertas`, `tabloides`, `campanhas`, `banners`, `depoimentos`, `autoposto`, taxonomias como coleção. Sem ETL (dados já na nuvem).

## 3. Design tokens (Tailwind v4, CSS-first)

Em `src/styles/global.css` com `@theme` (sem `tailwind.config.js`):

```css
@import "tailwindcss";
@theme {
  --color-navy: #01437D;      /* primário */
  --color-red: #c01100;       /* acento */
  --color-red-alt: #d10404;
  --color-ink: #484848;
  --color-slate: #54595F;
  --color-line: #e1e5eb;
  --font-display: "Montserrat", sans-serif;
  --font-body: "Nunito", sans-serif;
}
```

- Fonts self-hosted (`@fontsource` ou `astro:assets`), sem CDN do Google (LGPD + perf).
- Keyframes de entrada/saída definidos aqui (`@keyframes reveal-up`, etc.).

## 4. Contrato de fetching (`src/lib/directus.ts`)

- Cliente SDK único com `staticToken(DIRECTUS_TOKEN)`.
- Helpers tipados com `fields` EXPLÍCITOS (nunca `*`), sempre `filter: { status: 'published' }`:
  - `getLojas()` → 73 lojas (setores/servicos vêm como CSV, split no consumidor).
  - `getPage(slug)` / `getPages()` → institucionais + `seo`.
  - `getNoticias({ page, limit })` → lista paginada; `getNoticia(slug)` → detalhe.
  - `getMenu(position)` → menu + `menu_items` (tree via `parent`).
  - `getRedesSociais()`, `getHeroSlides()`.
- Tipos em `src/lib/types.ts`, gerados do schema real do Directus.

## 5. Animações (Astro View Transitions + CSS)

- `<ClientRouter />` no `BaseLayout` → transições entry/exit de página nativas.
- `transition:name` em elementos persistentes (logo/header) para morphing entre rotas.
- `Reveal.astro`: wrapper com `IntersectionObserver` que adiciona classe ao entrar no viewport → dispara `@keyframes`.
- **`prefers-reduced-motion: reduce`** desativa todas as animações (requisito de acessibilidade).
- Zero dependências JS de animação.

## 6. Guardrails de editor no Directus

Mitigação do risco (config, não código):

- **Role `Editor`**: access policy com permissões por coleção e por campo. Apenas read/create/update em coleções de conteúdo. System collections ocultas.
- **Presets/bookmarks** por role → aterrissa em views curadas, não no data model.
- **Campos técnicos** (`slug`, `id`, timestamps) → `hidden` ou `readonly`.
- **Interfaces adequadas**: WYSIWYG limitado, `select-dropdown-m2m` para taxonomias, validações, campos condicionais.
- Extensão custom **apenas se** um caso concreto exigir.
- Documentado em `directus/policies/editor.md`.

## 7. Publicação / SSG

- `astro build` → `dist/` estático.
- Flow `rebuild-on-publish` (export em `directus/flows/`): trigger on item publish → webhook `POST $DEPLOY_HOOK_URL`.
- Cron diário (host ou GitHub Action) → rebuild para expirações de tabloides.
- Schema-as-code: `directus schema snapshot` → `directus/schema/snapshot.yaml` (versionado no repo).

## 8. SEO / redirects

- Mapa de URLs WP → Astro (rotas que existem no modelo atual):
  - `/lojas_/{slug}/` → `/lojas/{slug}/`
  - `/{slug-noticia}/` → `/noticias/{slug}/`
  - institucionais → `/{slug}` (coleção `pages`)
  - Rotas de conteúdo não modelado (`/radar-de-ofertas/`, `/institucional/autoposto/`) só entram se as coleções forem criadas.
- `@astrojs/sitemap`.
- Redirects 301 via config do host (ou `astro:redirects`).
- Metadados por página (`<title>`, `description`, OG) a partir dos dados do Directus.

## 9. Variáveis de ambiente (`.env.example`)

```
DIRECTUS_URL=
DIRECTUS_TOKEN=
DEPLOY_HOOK_URL=
```
