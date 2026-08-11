import {
  createDirectus,
  rest,
  staticToken,
  readItems,
  readFiles,
  readSingleton,
} from '@directus/sdk';
import type {
  DirectusSchema,
  Banner,
  CardHome,
  Global,
  Integracoes,
  HeroSlide,
  Loja,
  ModalHome,
  Noticia,
  Page,
  Publicacao,
  RedeSocial,
  MenuItem,
  MenuPosition,
  Cidade,
  Tabloide,
  CarroselOferta,
} from './types';

const URL = import.meta.env.DIRECTUS_URL ?? process.env.DIRECTUS_URL ?? '';
const TOKEN = import.meta.env.DIRECTUS_TOKEN ?? process.env.DIRECTUS_TOKEN ?? '';

const configured = Boolean(URL && TOKEN);
if (!configured) {
  // ponytail: sem credenciais o site ainda builda (estados vazios), em vez de quebrar.
  console.warn(
    '[directus] DIRECTUS_URL/DIRECTUS_TOKEN ausentes — fetches retornam vazio. Preencha .env.',
  );
}

const client = configured
  ? createDirectus<DirectusSchema>(URL).with(staticToken(TOKEN)).with(rest())
  : null;

const PUBLISHED = { status: { _eq: 'published' } } as const;

async function fetchItems<T>(fn: () => Promise<T[]>): Promise<T[]> {
  if (!client) return [];
  try {
    return await fn();
  } catch (err) {
    console.error('[directus] fetch falhou:', err);
    return [];
  }
}

/** URL de um asset do Directus a partir do id do arquivo. */
export function assetUrl(id: string | null | undefined, params = ''): string | null {
  if (!id || !URL) return null;
  return `${URL}/assets/${id}${params ? `?${params}` : ''}`;
}

/** Singleton `global` — logo, favicon, SEO, tags. Null se não configurado.
 *  Memoizado: BaseLayout roda por página; sem cache seriam N fetches no build. */
let globalCache: Promise<Global | null> | undefined;
export function getGlobal(): Promise<Global | null> {
  if (!client) return Promise.resolve(null);
  if (globalCache) return globalCache;
  globalCache = client
    .request(
      readSingleton('global', {
        fields: [
          'logo', 'favicon', 'seo',
          'topbar_ativo', 'topbar_texto', 'topbar_url', 'topbar_cor_fundo', 'topbar_cor_texto',
          'ofertas_disclaimer',
        ],
      }),
    )
    .catch((err) => {
      console.error('[directus] getGlobal falhou:', err);
      globalCache = undefined; // permite retry no próximo call
      return null;
    });
  return globalCache;
}

/** Singleton `integracoes` — tags/códigos de terceiros (GTM, Emarsys, scripts).
 *  Acesso restrito no Directus (policy só admin). Memoizado como `global`. */
let integCache: Promise<Integracoes | null> | undefined;
export function getIntegracoes(): Promise<Integracoes | null> {
  if (!client) return Promise.resolve(null);
  if (integCache) return integCache;
  integCache = client
    .request(
      readSingleton('integracoes', {
        fields: [
          'gtm_id', 'emarsys_merchant_id', 'head_code', 'body_code',
          'analytics_code', 'marketing_code',
        ],
      }),
    )
    .catch((err) => {
      console.error('[directus] getIntegracoes falhou:', err);
      integCache = undefined;
      return null;
    });
  return integCache;
}

/** Singleton `modal_home` — pop-up promocional da Home. Null se inativo ou fora da vigência. */
export async function getModalHome(): Promise<ModalHome | null> {
  if (!client) return null;
  try {
    const m = await client.request(
      readSingleton('modal_home', {
        fields: ['ativo', 'titulo', 'descricao', 'url', 'cta_label', 'cta_cor', 'imagem', 'data_inicio', 'data_fim'],
      }),
    );
    if (!m || !m.ativo) return null;
    if (!m.titulo && !m.imagem) return null; // singleton vazio → nada a exibir
    // Vigência: datas 'YYYY-MM-DD'. ponytail: data UTC; rebuild diário cobre a virada.
    const hoje = new Date().toISOString().slice(0, 10);
    if (m.data_inicio && m.data_inicio > hoje) return null;
    if (m.data_fim && m.data_fim < hoje) return null;
    return m;
  } catch (err) {
    console.error('[directus] getModalHome falhou:', err);
    return null;
  }
}

export async function getHeroSlides() {
  const slides = await fetchItems<HeroSlide>(() =>
    client!.request(
      readItems('hero_slides', {
        fields: ['id', 'title', 'url', 'image_desktop', 'image_mobile', 'data_inicio', 'data_fim'],
        filter: PUBLISHED,
        sort: ['sort'],
      }),
    ),
  );
  // Vigência: só banners válidos hoje (data_inicio ≤ hoje ≤ data_fim). Campos são 'YYYY-MM-DD'.
  const hoje = new Date().toISOString().slice(0, 10); // ponytail: data UTC; rebuild diário cobre a virada.
  return slides.filter(
    (s) => (!s.data_inicio || s.data_inicio <= hoje) && (!s.data_fim || s.data_fim >= hoje),
  );
}

/** Banners promocionais por posição (ex.: 'home-meio'). Editáveis no CMS. */
export function getBanners(position: string) {
  return fetchItems<Banner>(() =>
    client!.request(
      readItems('banners', {
        fields: ['id', 'position', 'alt', 'imagem', 'imagem_mobile', 'url', 'target'],
        filter: { ...PUBLISHED, position: { _eq: position } },
        sort: ['sort'],
        limit: -1,
      }),
    ),
  );
}

/** Cards promocionais da Home (substitui os tiles hardcoded). Imagem opcional. */
export function getCardsHome() {
  return fetchItems<CardHome>(() =>
    client!.request(
      readItems('card_home', {
        fields: ['id', 'title', 'url', 'image'],
        filter: PUBLISHED,
        sort: ['sort'],
        limit: -1,
      }),
    ),
  );
}

export function getLojas() {
  return fetchItems<Loja>(() =>
    client!.request(
      readItems('lojas', {
        fields: [
          'id', 'nome', 'slug', 'cidade', 'telefone', 'link_maps',
          'latitude', 'longitude', 'image', 'horarios', 'setores', 'servicos',
        ],
        filter: PUBLISHED,
        sort: ['nome'],
        limit: -1,
      }),
    ),
  );
}

export function getLoja(slug: string) {
  return fetchItems<Loja>(() =>
    client!.request(
      readItems('lojas', {
        fields: [
          'id', 'nome', 'slug', 'cidade', 'telefone', 'link_maps',
          'latitude', 'longitude', 'image', 'horarios', 'setores', 'servicos',
        ],
        filter: { ...PUBLISHED, slug: { _eq: slug } },
        limit: 1,
      }),
    ),
  ).then((r) => r[0] ?? null);
}

export function getNoticias(opts: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 12 } = opts;
  return fetchItems<Noticia>(() =>
    client!.request(
      readItems('noticias', {
        fields: ['id', 'titulo', 'slug', 'data_publicacao', 'resumo', 'image'],
        filter: PUBLISHED,
        sort: ['-data_publicacao'],
        limit,
        page,
      }),
    ),
  );
}

export function getNoticia(slug: string) {
  return fetchItems<Noticia>(() =>
    client!.request(
      readItems('noticias', {
        fields: ['id', 'titulo', 'slug', 'data_publicacao', 'resumo', 'content', 'image'],
        filter: { ...PUBLISHED, slug: { _eq: slug } },
        limit: 1,
      }),
    ),
  ).then((r) => r[0] ?? null);
}

/** Todas as notícias (campos de lista) — para paginação em build. */
export function getAllNoticias() {
  return fetchItems<Noticia>(() =>
    client!.request(
      readItems('noticias', {
        fields: ['id', 'titulo', 'slug', 'data_publicacao', 'resumo', 'image'],
        filter: PUBLISHED,
        sort: ['-data_publicacao'],
        limit: -1,
      }),
    ),
  );
}

/** Todas as notícias COM conteúdo — para getStaticPaths do detalhe (1 fetch, sem N+1). */
export function getAllNoticiasFull() {
  return fetchItems<Noticia>(() =>
    client!.request(
      readItems('noticias', {
        fields: ['id', 'titulo', 'slug', 'data_publicacao', 'resumo', 'content', 'image'],
        filter: PUBLISHED,
        sort: ['-data_publicacao'],
        limit: -1,
      }),
    ),
  );
}

export function getAllNoticiaSlugs() {
  return fetchItems<Pick<Noticia, 'slug'>>(() =>
    client!.request(
      readItems('noticias', {
        fields: ['slug'],
        filter: PUBLISHED,
        limit: -1,
      }),
    ),
  );
}

export function getPage(slug: string) {
  return fetchItems<Page>(() =>
    client!.request(
      readItems('pages', {
        fields: ['id', 'titulo', 'slug', 'categoria', 'image', 'content', 'seo'],
        filter: { ...PUBLISHED, slug: { _eq: slug } },
        limit: 1,
      }),
    ),
  ).then((r) => r[0] ?? null);
}

export function getPages() {
  return fetchItems<Page>(() =>
    client!.request(
      readItems('pages', {
        fields: ['id', 'titulo', 'slug', 'categoria', 'image', 'exibir_no_hub'],
        filter: PUBLISHED,
        limit: -1,
      }),
    ),
  );
}

/** Publicações institucionais: livros (PDF), relatórios e links externos. */
export function getPublicacoes() {
  return fetchItems<Publicacao>(() =>
    client!.request(
      readItems('publicacoes', {
        fields: ['id', 'titulo', 'tipo', 'imagem', 'arquivo', 'url', 'descricao', 'externo', 'target'],
        filter: PUBLISHED,
        sort: ['sort'],
        limit: -1,
      }),
    ),
  );
}

/** Todas as pages COM conteúdo + seo — para getStaticPaths do detalhe (1 fetch). */
export function getAllPagesFull() {
  return fetchItems<Page>(() =>
    client!.request(
      readItems('pages', {
        fields: ['id', 'titulo', 'slug', 'categoria', 'image', 'content', 'seo'],
        filter: PUBLISHED,
        limit: -1,
      }),
    ),
  );
}

/** Cidades COM região expandida — para roteamento e resolução em /ofertas (1 fetch). */
export function getCidadesFull() {
  return fetchItems<Cidade>(() =>
    client!.request(
      readItems('cidades', {
        fields: [
          'id', 'nome', 'slug',
          'regiao.id', 'regiao.nome', 'regiao.slug', 'regiao.video_url', 'regiao.descricao',
        ],
        filter: PUBLISHED,
        sort: ['nome'],
        limit: -1,
      }),
    ),
  );
}

/** Todos os tabloides (região como id) — filtra por região no build, sem N+1.
 *  Vigência gerada no build: hoje entre valido_de e valido_ate (inclusive). */
export function getTabloides() {
  const hoje = new Date().toISOString().slice(0, 10); // ponytail: data do build, granularidade de dia — o rebuild diário mantém em dia
  return fetchItems<Tabloide>(() =>
    client!.request(
      readItems('tabloides', {
        fields: ['id', 'titulo', 'capa', 'pdf', 'valido_de', 'valido_ate', 'paginas', 'regiao'],
        filter: {
          _and: [
            PUBLISHED,
            { valido_de: { _lte: hoje } },
            { valido_ate: { _gte: hoje } },
          ],
        },
        sort: ['sort'],
        limit: -1,
      }),
    ),
  );
}

/** Carrossel de ofertas (lote de imagens por linha, por região). Vigência no build:
 *  hoje entre data_inicio e data_fim (vazio = sem limite). Filtra por região no build. */
export function getCarroselOfertas() {
  const hoje = new Date().toISOString().slice(0, 10);
  return fetchItems<CarroselOferta>(() =>
    client!.request(
      readItems('carrosel_ofertas', {
        fields: ['id', 'regiao', 'data_inicio', 'data_fim', 'imagens.directus_files_id'],
        filter: {
          _and: [
            PUBLISHED,
            { _or: [{ data_inicio: { _null: true } }, { data_inicio: { _lte: hoje } }] },
            { _or: [{ data_fim: { _null: true } }, { data_fim: { _gte: hoje } }] },
          ],
        },
        sort: ['sort'],
        limit: -1,
      }),
    ),
  );
}

export function getRedesSociais() {
  return fetchItems<RedeSocial>(() =>
    client!.request(
      readItems('redes_sociais', {
        fields: ['id', 'label', 'url', 'icon'],
        filter: PUBLISHED,
        sort: ['sort'],
      }),
    ),
  );
}

export interface DirectusFile {
  id: string;
  title: string | null;
  filename_download: string;
  type: string | null;
  filesize: string | null;
}

/** Arquivos da biblioteca do Directus (para preview/diagnóstico). */
export function getFiles(limit = 60) {
  return fetchItems<DirectusFile>(() =>
    client!.request(
      readFiles({
        fields: ['id', 'title', 'filename_download', 'type', 'filesize'],
        sort: ['-uploaded_on'],
        limit,
      }),
    ),
  );
}

/** Menu por posição, montado em árvore (parent → children). */
export async function getMenu(position: MenuPosition): Promise<MenuItem[]> {
  const items = await fetchItems<MenuItem & { menu: { position: MenuPosition } }>(() =>
    client!.request(
      readItems('menu_items', {
        fields: ['id', 'label', 'url', 'target', 'parent', 'menu.position'],
        filter: { ...PUBLISHED, menu: { position: { _eq: position } } },
        sort: ['sort'],
        limit: -1,
      }),
    ),
  );

  const byId = new Map<string, MenuItem>();
  items.forEach((i) => byId.set(i.id, { ...i, children: [] }));
  const roots: MenuItem[] = [];
  byId.forEach((item) => {
    if (item.parent && byId.has(item.parent)) {
      byId.get(item.parent)!.children!.push(item);
    } else {
      roots.push(item);
    }
  });
  return roots;
}
