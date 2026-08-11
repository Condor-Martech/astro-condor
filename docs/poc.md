# POC — Home + Localizador de Lojas

## Objetivo

Provar o pipeline completo **Directus → Astro (SSG)** com um vertical slice real: a Home institucional + o Localizador de Lojas. Se isso funcionar end-to-end, o resto do site é repetição do padrão.

## Escopo

### Home (`/`)
- Carrossel de `hero_slides` + seções com identidade visual real (tokens navy/vermelho, Montserrat/Nunito).
- View Transitions ativas (entry/exit de página).
- Reveals ao rolar (`IntersectionObserver`).
- Links para seções externas (condoremcasa, clubecondor) e para `/lojas`.

### Localizador de Lojas (`/lojas`)
- Fetch das **73 lojas** do Directus em build time.
- Filtro **client-side** por `cidade` (string) + `setores`/`servicos` (CSV → split em chips), sem recarregar.
- Cards com dados reais (nome, cidade, telefone, horários, `link_maps`).

## Critérios de aceitação

1. `astro build` gera estático sem erros; `astro check` passa os tipos do Directus.
2. As 73 lojas vêm do Directus (verificável no Network/DevTools em dev) — **zero hardcode**.
3. Filtros funcionam sem recarregar a página.
4. Transição entry/exit visível ao navegar `/` ↔ `/lojas`; scroll dispara reveals.
5. `prefers-reduced-motion: reduce` desativa todas as animações.
6. Paridade de identidade: navy `#01437D`, vermelho `#c01100`, Montserrat/Nunito corretos.
7. Lighthouse Performance + SEO ≥ 90 na Home.

## Pré-condição de dados

Já satisfeita: o Directus na nuvem tem `lojas` (73) populada. **Sem ETL** — os dados são a fonte da verdade.

## Como verificar

```bash
pnpm install
pnpm dev          # abrir / e /lojas, inspecionar Network → lojas do Directus
pnpm build        # estático sem erros
pnpm astro check  # tipos ok
# Lighthouse na home; toggle prefers-reduced-motion no DevTools
```

## O que o POC NÃO prova (fica para M3+)

Páginas institucionais (`pages`), blog de `noticias` (758, paginação), navegação por `menus`, redirects 301, pipeline de rebuild automático. Coleções não modeladas (ofertas, tabloides, autoposto) estão fora do escopo até serem criadas.
