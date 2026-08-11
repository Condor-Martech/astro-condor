# PRD — Migração institucional.condor.com.br (WordPress → Astro + Directus)

## 1. Problema

O site institucional roda em **WordPress + Elementor**. As páginas são montadas quase 100% com imagens exportadas, sem HTML semântico real. Consequências:

- Performance e SEO ruins (conteúdo em imagens, não indexável).
- Manutenção cara: mudar um texto exige reexportar uma imagem do Elementor.
- Acessibilidade nula (sem estrutura, sem `alt` útil, sem foco).

## 2. Objetivo

Migrar para **Astro 5 (front, SSG) + Directus (CMS self-hosted, já implantado na nuvem do cliente)**, mantendo a identidade visual atual e melhorando-a com um sistema de design real (tokens, tipografia, animações de entrada/saída). Conteúdo editável por não técnicos sem quebrar o modelo.

## 3. Público

- **Usuário final**: cliente Condor buscando lojas, ofertas, tabloides, autoposto.
- **Editor interno** (não técnico): publica ofertas/tabloides, atualiza dados de lojas.

## 4. Escopo

**Dentro:**
- Home institucional.
- Localizador de lojas (`lojas`, 71 registros) com filtros.
- Radar de ofertas (`ofertas` por região).
- Tabloides (`tabloide`: capa + PDF, com vigência).
- Autoposto, campanhas, banners, depoimentos, páginas institucionais.

**Fora:**
- E-commerce / carrinho → vive em `condoremcasa`, `clubecondor`, `campanha` (apenas links).
- Redesign de marca (mantemos a identidade, melhoramos a execução).
- CPTs legados: `ofertas_94`, `lojas-sac`.

## 5. Requisitos não funcionais

| Req | Detalhe |
|-----|---------|
| **Legal** | Self-host do CMS (LGPD, dados no Brasil). Descarta SaaS. |
| **SEO** | Redirects 301 de todas as URLs do WP. Sitemap. Metadados por página. |
| **Performance** | Lighthouse Performance + SEO ≥ 90. |
| **Acessibilidade** | Semântica real, `alt`, ordem de foco, `prefers-reduced-motion`. |
| **Editável** | Editor não técnico publica sem acesso ao modelo de dados cru. |

## 6. Identidade visual (fonte da verdade — CSS real verificado)

- Navy primário `#01437D` (NÃO é vermelho — suposição típica de supermercado, verificada como falsa).
- Vermelho de acento Condor `#c01100` / `#d10404`.
- Neutros `#54595F`, `#484848`; linha `#e1e5eb`.
- Tipografia: **Montserrat** (títulos) + **Nunito** (corpo).
- Amarelo do logo: apenas imagem, ainda não é token → confirmar antes de usar.

## 7. Métricas de sucesso

1. Paridade visual com o site atual (inspeção lado a lado).
2. Editor publica uma oferta/tabloide sem ajuda técnica e sem quebrar nada.
3. Build reproduzível do zero (`pnpm build`).
4. Redirects 301 sem perda de ranking (zero 404 nas URLs do WP existentes).
5. Lighthouse ≥ 90.

## 8. Riscos

| Risco | Mitigação |
|-------|-----------|
| Editor quebra o modelo de dados (Directus expõe tudo) | Roles + access policies, presets, campos hidden/readonly, interfaces curadas. Ver `spec.md` §6 e `directus/policies/editor.md`. |
| Paridade de conteúdo image-based | ETL baixa mídia para o Directus Files; textos redigitados como conteúdo real. |
| Expiração de tabloides | Filtro por data no build + cron diário de rebuild. |

## 9. Fora de escopo explícito

Ver §4. Nada de e-commerce, redesign de marca, nem CPTs legados.
